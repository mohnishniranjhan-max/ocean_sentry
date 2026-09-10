"""
CLI Script for Ingesting ASCII / Text Ocean Observation Files.

Usage:
  python scripts/ingest_ascii.py --sample
  python scripts/ingest_ascii.py --sample --preview
  python scripts/ingest_ascii.py --file path/to/observations.txt
  python scripts/ingest_ascii.py --file path/to/observations.csv --station-id BUOY-BAY-01
"""

import sys
import argparse
import logging
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ascii_parser import parser_registry, BaseObservationParser
from app.services.ocean_service import ocean_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SAMPLE_PROMPT_INPUT = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20"""


def main():
    parser = argparse.ArgumentParser(description="Ocean Sentry ASCII Observation Ingestion")
    parser.add_argument("--file", "-f", type=str, help="Path to ASCII/text file to ingest")
    parser.add_argument("--sample", action="store_true", help="Run with the standard sample prompt data")
    parser.add_argument("--preview", action="store_true", help="Dry run: parse and validate without committing to store")
    parser.add_argument("--station-id", type=str, default=None, help="Custom station ID identifier")
    parser.add_argument("--delimiter", type=str, default=None, help="Force specific delimiter (e.g. ',' or '\t')")
    parser.add_argument("--source", type=str, default="ascii_cli", help="Source metadata label")

    args = parser.parse_args()

    if not args.file and not args.sample:
        parser.print_help()
        print("\nError: Please provide --file <path> or use --sample.")
        sys.exit(1)

    if args.sample:
        content = SAMPLE_PROMPT_INPUT
        source_name = "sample_prompt_ascii"
        print("\n" + "=" * 60)
        print("OCEAN SENTRY - INGESTING SAMPLE ASCII PROMPT INPUT")
        print("=" * 60)
        print(content)
        print("=" * 60)
    else:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found at {file_path}")
            sys.exit(1)
        content = file_path.read_text(encoding="utf-8", errors="replace")
        source_name = file_path.name

    # Parse
    print(f"\nParsing observation content ({len(content.splitlines())} lines)...")
    result = parser_registry.parse(
        content=content,
        source_name=source_name,
        station_id_override=args.station_id,
        delimiter_override=args.delimiter,
    )

    report = result.report
    print("\n" + "-" * 50)
    print("PARSING & VALIDATION REPORT")
    print("-" * 50)
    print(f"  Detected Delimiter : {result.detected_delimiter}")
    print(f"  Column Mappings    : {result.column_mapping}")
    print(f"  Variables Found    : {result.variables_found}")
    if result.header_metadata:
        print(f"  Header Metadata    : {result.header_metadata}")
    print(f"  Total Lines Read   : {report.records_received if report else len(content.splitlines())}")
    print(f"  Valid Observations : {len(result.valid_observations)}")
    print(f"  Rejected Rows      : {len(result.rejected_rows)}")

    if report:
        if report.lat_range:
            print(f"  Latitude Range     : {report.lat_range[0]} to {report.lat_range[1]}")
        if report.lon_range:
            print(f"  Longitude Range    : {report.lon_range[0]} to {report.lon_range[1]}")
        if report.depth_range:
            print(f"  Depth Range        : {report.depth_range[0]} to {report.depth_range[1]} m")
        if report.time_range:
            print(f"  Time Range         : {report.time_range[0]} to {report.time_range[1]}")

    if result.rejected_rows:
        print("\n[!] Rejected Rows Details:")
        for r in result.rejected_rows[:5]:
            print(f"   Line {r['line']}: {r['reason']} -> '{r['raw']}'")

    if args.preview:
        print("\n[PREVIEW MODE]: No changes committed to store.")
        print(f"Parsed {len(result.valid_observations)} valid records successfully.")
        return

    if not result.valid_observations:
        print("\n[X] Error: No valid observations parsed. Ingestion aborted.")
        sys.exit(1)

    # Ingest into OceanService
    print("\nIngesting into Ocean Data Store & collocating with model...")
    ingest_result = ocean_service.ingest_observations(
        observations=result.valid_observations,
        source_name=source_name,
    )

    created_stations = ingest_result.get("created_stations", [])
    records_added = ingest_result.get("records_added", 0)

    print("\n" + "=" * 60)
    print("INGESTION SUCCESSFUL")
    print("=" * 60)
    print(f"  Records Added: {records_added}")
    print(f"  Stations Created/Updated: {', '.join(created_stations) if created_stations else 'None'}")
    print(f"  Stations now live in 3D visualization cache.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
