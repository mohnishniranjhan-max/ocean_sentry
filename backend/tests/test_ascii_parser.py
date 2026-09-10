"""
Unit Tests for Phase 4 ASCII/Text Ocean Observation Ingestion.
"""

import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone

# Add backend root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ascii_parser import parser_registry, StructuredAsciiParser, normalize_column_name
from app.models.schemas import OceanObservation


class TestAsciiObservationParser(unittest.TestCase):

    def setUp(self):
        self.parser = StructuredAsciiParser()

    def test_01_user_prompt_exact_input(self):
        """Test exact whitespace example from problem statement."""
        raw_text = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20"""

        result = self.parser.parse(raw_text, source_name="prompt_sample")
        self.assertEqual(len(result.valid_observations), 3)
        self.assertEqual(len(result.rejected_rows), 0)
        self.assertEqual(result.detected_delimiter, "whitespace")

        obs0 = result.valid_observations[0]
        self.assertAlmostEqual(obs0.latitude, 15.42)
        self.assertAlmostEqual(obs0.longitude, 88.21)
        self.assertAlmostEqual(obs0.depth, 10.0)
        self.assertAlmostEqual(obs0.temperature, 28.4)
        self.assertAlmostEqual(obs0.salinity, 34.8)
        self.assertEqual(obs0.timestamp.year, 2026)
        self.assertEqual(obs0.timestamp.month, 9)
        self.assertEqual(obs0.timestamp.day, 8)
        self.assertEqual(obs0.timestamp.hour, 12)
        self.assertEqual(obs0.timestamp.minute, 0)

        obs2 = result.valid_observations[2]
        self.assertAlmostEqual(obs2.depth, 100.0)
        self.assertAlmostEqual(obs2.temperature, 26.1)
        self.assertAlmostEqual(obs2.salinity, 35.2)

    def test_02_csv_comma_delimited(self):
        """Test comma-separated file with extra ocean parameters."""
        raw_csv = """latitude,longitude,depth,temp,sal,wave_height,current_u,current_v,ph,timestamp
12.50,84.20,5.0,29.1,33.5,1.2,0.15,-0.08,8.14,2026-09-08T10:00:00Z
12.50,84.20,25.0,28.7,34.0,1.2,0.12,-0.05,8.12,2026-09-08T10:00:00Z
12.50,84.20,75.0,24.2,34.8,1.2,0.05,-0.02,7.95,2026-09-08T10:00:00Z"""

        result = self.parser.parse(raw_csv, source_name="buoy_csv")
        self.assertEqual(len(result.valid_observations), 3)
        self.assertEqual(result.detected_delimiter, ",")

        obs = result.valid_observations[0]
        self.assertAlmostEqual(obs.wave_height, 1.2)
        self.assertAlmostEqual(obs.current_u, 0.15)
        self.assertAlmostEqual(obs.current_v, -0.08)
        self.assertAlmostEqual(obs.ph, 8.14)

    def test_03_tsv_with_comment_headers_and_metadata(self):
        """Test tab-separated file with '#' comment lines and metadata."""
        raw_tsv = """# Project: Ocean Sentry
# Station: BOB-MOORING-04
# Cruise: INCOIS-2026
# Latitude: 16.50
# Longitude: 89.10
DEPTH\tTEMP\tSAL\tTIME
10.0\t28.2\t34.5\t2026-09-08 14:00
30.0\t27.5\t34.7\t2026-09-08 14:00
60.0\t25.8\t35.1\t2026-09-08 14:00"""

        result = self.parser.parse(raw_tsv, source_name="mooring_tsv")
        self.assertEqual(len(result.valid_observations), 3)
        self.assertEqual(result.detected_delimiter, "\t")
        self.assertEqual(result.header_metadata.get("station"), "BOB-MOORING-04")

        obs = result.valid_observations[0]
        # Coordinates should be picked up from header metadata
        self.assertAlmostEqual(obs.latitude, 16.50)
        self.assertAlmostEqual(obs.longitude, 89.10)
        self.assertAlmostEqual(obs.depth, 10.0)

    def test_04_semicolon_delimited(self):
        """Test semicolon-delimited ASCII file."""
        raw_semi = """lat;lon;depth;temperature;salinity;time
14.0;86.0;0.5;29.4;33.8;2026-09-07T08:00
14.0;86.0;50.0;27.1;34.9;2026-09-07T08:05"""

        result = self.parser.parse(raw_semi, source_name="semi_file")
        self.assertEqual(len(result.valid_observations), 2)
        self.assertEqual(result.detected_delimiter, ";")
        self.assertAlmostEqual(result.valid_observations[0].temperature, 29.4)

    def test_05_separate_date_and_time_columns(self):
        """Test automatic combination of separate DATE and TIME columns."""
        raw_text = """LAT LON DEPTH TEMP SAL DATE TIME
11.2 82.5 15.0 28.9 34.2 2026-09-05 06:30:00
11.2 82.5 45.0 27.6 34.6 2026-09-05 06:30:00"""

        result = self.parser.parse(raw_text, source_name="split_datetime")
        self.assertEqual(len(result.valid_observations), 2)
        obs = result.valid_observations[0]
        self.assertEqual(obs.timestamp.year, 2026)
        self.assertEqual(obs.timestamp.month, 9)
        self.assertEqual(obs.timestamp.day, 5)
        self.assertEqual(obs.timestamp.hour, 6)
        self.assertEqual(obs.timestamp.minute, 30)

    def test_06_malformed_rows_fault_isolation(self):
        """
        Parser must NOT crash on bad rows.
        Bad rows must be recorded with line numbers and reasons,
        while valid rows are successfully processed.
        """
        raw_text = """LAT LON DEPTH TEMP SAL TIME
15.0 88.0 10 28.0 34.0 2026-09-08T12:00
195.0 88.0 20 27.0 34.0 2026-09-08T12:00
15.0 88.0 30 26.5 34.2 2026-09-08T12:00
15.0 88.0 BAD_DEPTH 26.0 34.5 2026-09-08T12:00
15.0 88.0 50 25.0 35.0 2026-09-08T12:00
15.0 88.0 60 999.0 35.0 2026-09-08T12:00"""
        # Row 2 (line 3): LAT=195 (invalid coordinate > 90) -> rejected
        # Row 4 (line 5): DEPTH="BAD_DEPTH" (non-numeric, defaults to 0 or bad)
        # Row 6 (line 7): TEMP=999.0 is missing sentinel (-999 or 999), safe None or rejected if out of range

        result = self.parser.parse(raw_text, source_name="fault_test")

        # Must have valid rows
        self.assertGreaterEqual(len(result.valid_observations), 3)
        # Must have captured rejected rows
        self.assertGreaterEqual(len(result.rejected_rows), 1)

        # Ensure first row is valid
        self.assertAlmostEqual(result.valid_observations[0].depth, 10.0)

        # Check rejected row details
        lat_error = next((r for r in result.rejected_rows if "Coordinates out of valid range" in r["reason"]), None)
        self.assertIsNotNone(lat_error)
        self.assertEqual(lat_error["line"], 3)

    def test_07_missing_value_sentinels(self):
        """Test safe handling of oceanographic sentinels (-999, NaN, empty)."""
        raw_text = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 -999.0 34.8 2026-09-08T12:00
15.42 88.21 20 28.1 -999 2026-09-08T12:00
15.42 88.21 30 NaN NaN 2026-09-08T12:00"""

        result = self.parser.parse(raw_text, source_name="sentinel_test")
        self.assertEqual(len(result.valid_observations), 3)

        obs0 = result.valid_observations[0]
        self.assertIsNone(obs0.temperature)
        self.assertAlmostEqual(obs0.salinity, 34.8)

        obs1 = result.valid_observations[1]
        self.assertAlmostEqual(obs1.temperature, 28.1)
        self.assertIsNone(obs1.salinity)

        obs2 = result.valid_observations[2]
        self.assertIsNone(obs2.temperature)
        self.assertIsNone(obs2.salinity)


if __name__ == "__main__":
    unittest.main()
