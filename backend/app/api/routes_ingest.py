"""
API Routes for Ocean Data Ingestion (ASCII/Text files, multipart upload, preview).
"""

import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status

from app.models.schemas import (
    AsciiPreviewResponse,
    AsciiIngestResponse,
)
from app.services.ascii_parser import parser_registry, COLUMN_ALIASES, SENTINEL_VALUES
from app.services.ocean_service import ocean_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocean/ingest", tags=["ingest"])

SAMPLE_PROMPT_INPUT = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20"""


async def _extract_content_and_options(request: Request) -> tuple[str, str, Optional[str], Optional[str]]:
    """Extract content, source_name, station_id, and delimiter from JSON, multipart, or raw text."""
    content_type = request.headers.get("content-type", "")
    content = ""
    source_name = "ascii_input"
    station_override = None
    delim_override = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            content = body.get("text_content", "") or body.get("text", "")
            source_name = body.get("source_name", source_name)
            station_override = body.get("station_id_override") or body.get("station_id")
            delim_override = body.get("delimiter_override") or body.get("delimiter")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON payload: {e}")

    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            upload = form.get("file")
            if upload and hasattr(upload, "read"):
                raw_bytes = await upload.read()
                content = raw_bytes.decode("utf-8", errors="replace")
                source_name = getattr(upload, "filename", "uploaded_ascii") or "uploaded_ascii"
            else:
                content = str(form.get("text_content", "") or form.get("text", ""))

            source_name = form.get("source_name") or source_name
            station_override = form.get("station_id") or form.get("station_id_override")
            delim_override = form.get("delimiter") or form.get("delimiter_override")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid form data: {e}")
    else:
        # Raw body
        raw_bytes = await request.body()
        content = raw_bytes.decode("utf-8", errors="replace")

    return content, source_name, station_override, delim_override


@router.get("/formats")
async def get_supported_formats():
    """Returns documentation of supported formats, column aliases, and sample data."""
    return {
        "supported_formats": [
            {
                "name": "Whitespace-Separated ASCII",
                "extensions": [".txt", ".dat", ".ascii"],
                "description": "Standard space-separated tabular ocean observations (single or variable whitespace)",
            },
            {
                "name": "Comma-Separated Values (CSV)",
                "extensions": [".csv"],
                "description": "Comma-delimited observation tables with header row",
            },
            {
                "name": "Tab-Separated Values (TSV)",
                "extensions": [".tsv", ".tab"],
                "description": "Tab-delimited observation tables",
            },
            {
                "name": "Semicolon/Pipe-Delimited",
                "extensions": [".txt", ".csv"],
                "description": "European style semicolon or pipe-separated files",
            },
            {
                "name": "Metadata Comment Header Files",
                "extensions": [".txt", ".cnv", ".dat"],
                "description": "Observation files prefixed with '#' or '//' metadata header lines",
            },
        ],
        "recognized_parameters": [
            "latitude (LAT)", "longitude (LON)", "depth (DEPTH/PRES)",
            "temperature (TEMP/T)", "salinity (SAL/PSAL)", "timestamp (TIME/DATE)",
            "current_u (U)", "current_v (V)", "wave_height (WAVE/HS)",
            "sea_level (SSH/SLA)", "ph (PH)", "chlorophyll (CHL)", "quality_flag (QC)"
        ],
        "missing_value_sentinels": sorted(list(SENTINEL_VALUES))[:12],
        "column_aliases": {k: v[:5] for k, v in COLUMN_ALIASES.items()},
        "sample_input": SAMPLE_PROMPT_INPUT,
    }


@router.post("/ascii/preview", response_model=AsciiPreviewResponse)
async def preview_ascii_data(request: Request):
    """
    Dry-run preview: Parse and validate an ASCII observation file without saving.
    Supports JSON body {"text_content": "..."}, multipart file upload, or form-data.
    """
    content, source_name, station_override, delim_override = await _extract_content_and_options(request)

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text content provided. Please upload a file or submit text_content."
        )

    result = parser_registry.parse(
        content=content,
        source_name=source_name,
        station_id_override=station_override,
        delimiter_override=delim_override,
    )

    preview_records = [
        obs.model_dump(mode="json") for obs in result.valid_observations[:10]
    ]

    return AsciiPreviewResponse(
        success=True,
        report=result.report,
        preview_records=preview_records,
        detected_delimiter=result.detected_delimiter,
        column_mapping=result.column_mapping,
        header_metadata=result.header_metadata,
    )


@router.post("/ascii", response_model=AsciiIngestResponse)
async def ingest_ascii_data(request: Request):
    """
    Ingest an ASCII/text observation file into Ocean Sentry:
    1. Parse & validate records
    2. Convert to standard ocean data schema
    3. Persist to database/parquet store
    4. Collocate with Copernicus model data
    5. Update 3D visualization stations cache
    Supports JSON body, multipart file upload, or form-data.
    """
    content, source_name, station_override, delim_override = await _extract_content_and_options(request)

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text content provided. Please upload a file or submit text_content."
        )

    # Parse through modular registry
    result = parser_registry.parse(
        content=content,
        source_name=source_name,
        station_id_override=station_override,
        delimiter_override=delim_override,
    )

    if not result.valid_observations:
        err_detail = "No valid ocean observation records could be parsed."
        if result.rejected_rows:
            reasons = [f"Line {r['line']}: {r['reason']}" for r in result.rejected_rows[:3]]
            err_detail += f" Sample errors: {'; '.join(reasons)}"
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err_detail
        )

    # Ingest into OceanService
    ingest_res = ocean_service.ingest_observations(
        observations=result.valid_observations,
        source_name=source_name,
    )

    created_stations = ingest_res.get("created_stations", [])
    if result.report:
        result.report.station_ids = created_stations

    return AsciiIngestResponse(
        success=True,
        message=(
            f"Successfully ingested {len(result.valid_observations)} observation records. "
            f"{len(result.rejected_rows)} malformed rows skipped. "
            f"Created/updated {len(created_stations)} station(s): {', '.join(created_stations) if created_stations else 'None'}."
        ),
        report=result.report,
        created_stations=created_stations,
    )
