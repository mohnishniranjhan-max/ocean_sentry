"""
Modular ASCII/Text Ocean Observation Parser.

Supports:
- Header metadata and comment rows (#, //, %, *, !)
- Comma, tab, semicolon, pipe, and whitespace-separated data
- Auto-mapping of recognized columns to standard ocean data schema
- Flexible date/time and coordinate parsing
- Missing value sentinel handling (-999, NaN, empty, etc.)
- Row-level fault isolation (logs bad rows without crashing)
- Pluggable parser registry for future ocean observation formats
"""

import re
import csv
import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Any

import dateutil.parser

from app.models.schemas import OceanObservation, DataIngestionReport
from app.utils.validation import (
    is_valid_coordinate,
    is_valid_depth,
    is_valid_temperature,
    is_valid_salinity,
)

logger = logging.getLogger(__name__)

# Missing value sentinel tokens in oceanographic ASCII files
SENTINEL_VALUES = {
    "-999", "-999.0", "-999.00", "-9999", "-9999.0", "-9999.00",
    "999", "999.0", "999.9", "9999", "9999.0", "99999",
    "nan", "na", "null", "none", "-", "--", "nd", "missing", "bad", ""
}

# Column aliases mapping to standardized internal schema fields
COLUMN_ALIASES: dict[str, list[str]] = {
    "latitude": [
        "lat", "latitude", "lat_deg", "lat_dd", "y", "lat_n",
        "latitude_degrees_north", "lat(n)", "latitude_deg", "latitude_dd"
    ],
    "longitude": [
        "lon", "long", "longitude", "lon_deg", "lon_dd", "x", "lon_e",
        "longitude_degrees_east", "lon(e)", "longitude_deg", "longitude_dd"
    ],
    "depth": [
        "depth", "depth_m", "dep", "pres", "pressure", "press", "p_dbar",
        "z", "depth(m)", "depth_meters", "pressure_dbar", "dep_m"
    ],
    "temperature": [
        "temp", "temperature", "t", "theta", "thetao", "sst", "temp_c",
        "t_degc", "t_c", "temperature_c", "temperature(c)", "sea_water_temperature",
        "votemper", "temp_deg_c"
    ],
    "salinity": [
        "sal", "salinity", "s", "psal", "so", "sal_psu", "psu",
        "salinity_psu", "salinity(psu)", "practical_salinity", "vosaline",
        "sea_water_salinity"
    ],
    "timestamp": [
        "time", "timestamp", "datetime", "date_time", "datetime_utc",
        "utc_time", "iso_time", "date_time_iso", "obs_time", "timestamp_utc"
    ],
    "date": [
        "date", "date_utc", "obs_date", "day", "yyyymmdd"
    ],
    "time_only": [
        "time_only", "time_utc", "hhmmss", "clock"
    ],
    "current_u": [
        "current_u", "u", "uo", "u_curr", "u_vel", "vozocrtx", "eastward_velocity"
    ],
    "current_v": [
        "current_v", "v", "vo", "v_curr", "v_vel", "vomecrty", "northward_velocity"
    ],
    "wave_height": [
        "wave_height", "wave", "waveheight", "hs", "swh", "wvht", "significant_wave_height"
    ],
    "sea_level": [
        "sea_level", "sealevel", "zos", "ssh", "sla", "sea_surface_height"
    ],
    "ph": [
        "ph", "ph_val", "ph_value", "sea_water_ph"
    ],
    "chlorophyll": [
        "chlorophyll", "chl", "chla", "chlorophyll_a", "chlor_a"
    ],
    "quality_flag": [
        "quality_flag", "quality", "qc", "qc_flag", "flag", "status_flag", "quality_code"
    ],
    "station_id": [
        "station_id", "station", "id", "platform", "float_id", "profile_id", "station_name"
    ],
}


def normalize_column_name(raw_name: str) -> str:
    """Normalize raw header string to standard column name."""
    clean = re.sub(r"[^a-zA-Z0-9]", "_", raw_name.strip()).lower().strip("_")
    for standard_name, aliases in COLUMN_ALIASES.items():
        if clean in aliases:
            return standard_name
        clean_no_under = clean.replace("_", "")
        for alias in aliases:
            if clean_no_under == alias.replace("_", ""):
                return standard_name
    return clean


def parse_float_safe(val: Any) -> Optional[float]:
    """Parse float value, handling nulls and oceanographic sentinels."""
    if val is None:
        return None
    val_str = str(val).strip().lower()
    if val_str in SENTINEL_VALUES:
        return None
    try:
        f = float(val_str)
        if f in (-999.0, -9999.0, 9999.0, 99999.0, 999.9):
            return None
        return f
    except (ValueError, TypeError):
        return None


def parse_timestamp_safe(val: Any) -> Optional[datetime]:
    """Parse timestamp safely supporting ISO-8601 and standard observation formats."""
    if not val:
        return None
    val_str = str(val).strip()
    if val_str.lower() in SENTINEL_VALUES:
        return None

    # Try dateutil parser
    try:
        dt = dateutil.parser.parse(val_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass

    # Try common formats explicitly
    formats = [
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y%m%d%H%M%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # Try numeric epoch
    try:
        epoch = float(val_str)
        if 0 < epoch < 2500000000:
            return datetime.fromtimestamp(epoch, tz=timezone.utc)
    except ValueError:
        pass

    return None


@dataclass
class ParseResult:
    valid_observations: list[OceanObservation] = field(default_factory=list)
    rejected_rows: list[dict] = field(default_factory=list)
    variables_found: list[str] = field(default_factory=list)
    detected_delimiter: str = "unknown"
    column_mapping: dict[str, str] = field(default_factory=dict)
    header_metadata: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    report: Optional[DataIngestionReport] = None


class BaseObservationParser(ABC):
    """Abstract base class for all observation parsers."""

    @abstractmethod
    def can_parse(self, content: str) -> bool:
        """Check if this parser can handle the given text content."""
        pass

    @abstractmethod
    def parse(
        self,
        content: str,
        source_name: str = "ascii_source",
        station_id_override: Optional[str] = None,
        delimiter_override: Optional[str] = None,
    ) -> ParseResult:
        """Parse content into standardized ocean observations."""
        pass


class StructuredAsciiParser(BaseObservationParser):
    """
    Parser for structured ASCII/text ocean observation files.
    Supports whitespace-separated, CSV, TSV, semicolon, and pipe-delimited data.
    """

    COMMENT_PREFIXES = ("#", "//", "%", "*", "!", ";", "rem")

    def can_parse(self, content: str) -> bool:
        return isinstance(content, str) and len(content.strip()) > 0

    def detect_delimiter(self, sample_lines: list[str]) -> str:
        """Detect the delimiter from sample data lines."""
        if not sample_lines:
            return r"\s+"

        candidates = [",", "\t", ";", "|"]
        counts = {c: [line.count(c) for line in sample_lines] for c in candidates}

        for c in candidates:
            c_counts = counts[c]
            if len(c_counts) > 0 and c_counts[0] > 0 and all(cnt == c_counts[0] for cnt in c_counts):
                return c

        if any(cnt > 1 for cnt in counts[","]):
            return ","
        if any(cnt > 1 for cnt in counts["\t"]):
            return "\t"
        if any(cnt > 1 for cnt in counts[";"]):
            return ";"
        if any(cnt > 1 for cnt in counts["|"]):
            return "|"

        return r"\s+"

    def _split_line(self, line: str, delimiter: str) -> list[str]:
        """Split a line into tokens using the specified delimiter."""
        line = line.strip()
        if not line:
            return []
        if delimiter in (r"\s+", "whitespace", " "):
            return [token.strip() for token in re.split(r"\s+", line) if token.strip()]
        else:
            try:
                reader = csv.reader([line], delimiter=delimiter)
                return [token.strip() for token in next(reader)]
            except Exception:
                return [token.strip() for token in line.split(delimiter)]

    def parse(
        self,
        content: str,
        source_name: str = "ascii_source",
        station_id_override: Optional[str] = None,
        delimiter_override: Optional[str] = None,
    ) -> ParseResult:
        result = ParseResult()
        lines = content.splitlines()

        header_metadata: dict[str, str] = {}
        data_lines: list[tuple[int, str]] = []
        header_tokens: list[str] = []
        header_line_index = -1

        for idx, raw_line in enumerate(lines):
            line_no = idx + 1
            line = raw_line.strip()
            if not line:
                continue

            is_comment = any(line.startswith(p) for p in self.COMMENT_PREFIXES)
            if is_comment:
                stripped = line.lstrip("#/%*!; ").strip()
                if ":" in stripped:
                    k, v = stripped.split(":", 1)
                    header_metadata[k.strip().lower()] = v.strip()
                elif "=" in stripped:
                    k, v = stripped.split("=", 1)
                    header_metadata[k.strip().lower()] = v.strip()
                continue

            if not header_tokens:
                potential_tokens = [t.strip() for t in re.split(r"[,;\t|\s]+", line) if t.strip()]
                normalized_candidates = [normalize_column_name(t) for t in potential_tokens]
                known_matches = sum(1 for c in normalized_candidates if c in COLUMN_ALIASES)

                if known_matches >= 2:
                    header_line_index = idx
                    continue

            if header_tokens or header_line_index >= 0:
                data_lines.append((line_no, line))
            else:
                data_lines.append((line_no, line))

        if delimiter_override:
            delimiter = delimiter_override
        else:
            sample_for_delim = [l[1] for l in data_lines[:5]]
            delimiter = self.detect_delimiter(sample_for_delim)
        result.detected_delimiter = "whitespace" if delimiter == r"\s+" else delimiter

        if header_line_index >= 0:
            header_tokens = self._split_line(lines[header_line_index], delimiter)
        elif data_lines:
            first_line_no, first_line = data_lines[0]
            first_tokens = self._split_line(first_line, delimiter)
            first_norm = [normalize_column_name(t) for t in first_tokens]
            if sum(1 for c in first_norm if c in COLUMN_ALIASES) >= 1:
                header_tokens = first_tokens
                data_lines.pop(0)

        if not header_tokens:
            result.warnings.append("No explicit header row found. Attempting default column layout (LAT LON DEPTH TEMP SAL TIME).")
            header_tokens = ["LAT", "LON", "DEPTH", "TEMP", "SAL", "TIME"]

        col_map: dict[int, str] = {}
        found_variables: set[str] = set()

        for idx, token in enumerate(header_tokens):
            norm = normalize_column_name(token)
            col_map[idx] = norm
            result.column_mapping[token] = norm
            if norm in ("latitude", "longitude", "depth", "temperature", "salinity",
                        "current_u", "current_v", "wave_height", "sea_level", "ph", "chlorophyll"):
                found_variables.add(norm)

        result.variables_found = sorted(list(found_variables))
        result.header_metadata = header_metadata

        inv_map = {v: k for k, v in col_map.items()}
        missing_required = []
        if "latitude" not in inv_map and "latitude" not in header_metadata:
            missing_required.append("latitude (LAT)")
        if "longitude" not in inv_map and "longitude" not in header_metadata:
            missing_required.append("longitude (LON)")

        if missing_required:
            err_msg = f"Missing mandatory coordinate columns: {', '.join(missing_required)}"
            result.warnings.append(err_msg)
            logger.warning(err_msg)

        meta_lat = parse_float_safe(header_metadata.get("lat") or header_metadata.get("latitude"))
        meta_lon = parse_float_safe(header_metadata.get("lon") or header_metadata.get("longitude"))
        meta_station = (
            station_id_override
            or header_metadata.get("station")
            or header_metadata.get("station_id")
            or header_metadata.get("platform")
            or f"ASCII-{datetime.now(timezone.utc).strftime('%m%d-%H%M')}"
        )
        meta_time = parse_timestamp_safe(
            header_metadata.get("date") or header_metadata.get("time") or header_metadata.get("datetime")
        )

        valid_records: list[OceanObservation] = []
        rejected_rows: list[dict] = []
        records_missing_count = 0

        min_lat, max_lat = float("inf"), float("-inf")
        min_lon, max_lon = float("inf"), float("-inf")
        min_depth, max_depth = float("inf"), float("-inf")
        min_time, max_time = None, None

        for line_no, raw_line in data_lines:
            tokens = self._split_line(raw_line, delimiter)
            if not tokens:
                continue

            row_dict: dict[str, Any] = {}
            for col_idx, token in enumerate(tokens):
                field_name = col_map.get(col_idx, f"col_{col_idx}")
                row_dict[field_name] = token

            lat_val = parse_float_safe(row_dict.get("latitude")) if "latitude" in row_dict else meta_lat
            lon_val = parse_float_safe(row_dict.get("longitude")) if "longitude" in row_dict else meta_lon

            if lat_val is None or lon_val is None:
                rejected_rows.append({
                    "line": line_no,
                    "raw": raw_line,
                    "reason": "Missing or non-numeric latitude/longitude coordinates",
                })
                continue

            if not is_valid_coordinate(lat_val, lon_val):
                rejected_rows.append({
                    "line": line_no,
                    "raw": raw_line,
                    "reason": f"Coordinates out of valid range: LAT={lat_val}, LON={lon_val}",
                })
                continue

            depth_val = parse_float_safe(row_dict.get("depth"))
            if depth_val is None:
                depth_val = 0.0
            if not is_valid_depth(depth_val):
                rejected_rows.append({
                    "line": line_no,
                    "raw": raw_line,
                    "reason": f"Depth value out of range: DEPTH={depth_val} (must be 0-11000m)",
                })
                continue

            row_ts = None
            if "date" in row_dict and ("timestamp" in row_dict or "time_only" in row_dict):
                time_val = row_dict.get("timestamp") or row_dict.get("time_only")
                combined_str = f"{row_dict.get('date')} {time_val}"
                row_ts = parse_timestamp_safe(combined_str)
            elif "timestamp" in row_dict:
                row_ts = parse_timestamp_safe(row_dict.get("timestamp"))
            elif "date" in row_dict:
                row_ts = parse_timestamp_safe(row_dict.get("date"))

            if row_ts is None:
                row_ts = meta_time or datetime.now(timezone.utc)

            temp_val = parse_float_safe(row_dict.get("temperature"))
            sal_val = parse_float_safe(row_dict.get("salinity"))
            wave_val = parse_float_safe(row_dict.get("wave_height"))
            u_val = parse_float_safe(row_dict.get("current_u"))
            v_val = parse_float_safe(row_dict.get("current_v"))
            ph_val = parse_float_safe(row_dict.get("ph"))
            chl_val = parse_float_safe(row_dict.get("chlorophyll"))
            qc_flag = int(parse_float_safe(row_dict.get("quality_flag")) or 1)

            if temp_val is not None and not is_valid_temperature(temp_val):
                rejected_rows.append({
                    "line": line_no,
                    "raw": raw_line,
                    "reason": f"Temperature out of valid physical range: TEMP={temp_val}°C (must be -3 to 45°C)",
                })
                continue

            if sal_val is not None and not is_valid_salinity(sal_val):
                rejected_rows.append({
                    "line": line_no,
                    "raw": raw_line,
                    "reason": f"Salinity out of valid range: SAL={sal_val} PSU (must be 0 to 45 PSU)",
                })
                continue

            if temp_val is None and sal_val is None:
                records_missing_count += 1

            row_station = (
                station_id_override
                or row_dict.get("station_id")
                or meta_station
            )
            obs_id = f"{row_station}_L{line_no}_D{int(depth_val)}"

            observation = OceanObservation(
                id=obs_id,
                source=source_name,
                timestamp=row_ts,
                latitude=round(lat_val, 4),
                longitude=round(lon_val, 4),
                depth=round(depth_val, 2),
                temperature=round(temp_val, 2) if temp_val is not None else None,
                salinity=round(sal_val, 2) if sal_val is not None else None,
                wave_height=round(wave_val, 2) if wave_val is not None else None,
                current_u=round(u_val, 3) if u_val is not None else None,
                current_v=round(v_val, 3) if v_val is not None else None,
                ph=round(ph_val, 2) if ph_val is not None else None,
                chlorophyll=round(chl_val, 2) if chl_val is not None else None,
                quality_flag=qc_flag,
            )
            valid_records.append(observation)

            min_lat = min(min_lat, lat_val)
            max_lat = max(max_lat, lat_val)
            min_lon = min(min_lon, lon_val)
            max_lon = max(max_lon, lon_val)
            min_depth = min(min_depth, depth_val)
            max_depth = max(max_depth, depth_val)

            ts_iso = row_ts.isoformat()
            if min_time is None or ts_iso < min_time:
                min_time = ts_iso
            if max_time is None or ts_iso > max_time:
                max_time = ts_iso

        total_received = len(data_lines)
        report = DataIngestionReport(
            source=source_name,
            records_received=total_received,
            records_valid=len(valid_records),
            records_removed=len(rejected_rows),
            records_missing=records_missing_count,
            variables_found=result.variables_found,
            time_range=(min_time, max_time) if min_time and max_time else None,
            lat_range=(round(min_lat, 4), round(max_lat, 4)) if min_lat != float("inf") else None,
            lon_range=(round(min_lon, 4), round(max_lon, 4)) if min_lon != float("inf") else None,
            depth_range=(round(min_depth, 2), round(max_depth, 2)) if min_depth != float("inf") else None,
            detected_delimiter=result.detected_delimiter,
            column_mapping=result.column_mapping,
            rejected_rows=rejected_rows[:50],
            warnings=result.warnings,
            station_ids=[meta_station] if valid_records else [],
        )

        result.valid_observations = valid_records
        result.rejected_rows = rejected_rows
        result.report = report

        logger.info(
            f"ASCII Ingestion complete for '{source_name}': "
            f"{len(valid_records)} valid, {len(rejected_rows)} rejected of {total_received} rows."
        )
        return result


class ObservationParserRegistry:
    """Registry of observation parsers with auto-detection."""

    def __init__(self):
        self._parsers: list[BaseObservationParser] = [StructuredAsciiParser()]

    def register(self, parser: BaseObservationParser):
        """Register a new parser."""
        self._parsers.insert(0, parser)

    def parse(
        self,
        content: str,
        source_name: str = "ascii_source",
        station_id_override: Optional[str] = None,
        delimiter_override: Optional[str] = None,
    ) -> ParseResult:
        for parser in self._parsers:
            if parser.can_parse(content):
                return parser.parse(
                    content=content,
                    source_name=source_name,
                    station_id_override=station_id_override,
                    delimiter_override=delimiter_override,
                )
        raise ValueError("No suitable observation parser found for content.")


parser_registry = ObservationParserRegistry()
