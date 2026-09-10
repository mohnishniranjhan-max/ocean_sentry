"""
Integration tests for ASCII Ingestion Endpoints.
"""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Add backend root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app


class TestApiIngest(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_01_get_formats(self):
        response = self.client.get("/api/ocean/ingest/formats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("supported_formats", data)
        self.assertIn("recognized_parameters", data)
        self.assertIn("sample_input", data)

    def test_02_preview_endpoint(self):
        prompt_input = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20"""

        response = self.client.post(
            "/api/ocean/ingest/ascii/preview",
            json={"text_content": prompt_input, "source_name": "preview_test"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["detected_delimiter"], "whitespace")
        self.assertEqual(data["report"]["records_valid"], 3)
        self.assertEqual(data["report"]["records_removed"], 0)
        self.assertEqual(len(data["preview_records"]), 3)
        self.assertEqual(data["preview_records"][0]["temperature"], 28.4)

    def test_03_ingest_endpoint(self):
        prompt_input = """LAT LON DEPTH TEMP SAL TIME
15.42 88.21 10 28.4 34.8 2026-09-08T12:00
15.42 88.21 50 27.8 35.0 2026-09-08T12:10
15.42 88.21 100 26.1 35.2 2026-09-08T12:20"""

        response = self.client.post(
            "/api/ocean/ingest/ascii",
            json={
                "text_content": prompt_input,
                "source_name": "ascii_prompt_test",
                "station_id_override": "ASCII-TEST-001"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["report"]["records_valid"], 3)
        self.assertIn("ASCII-TEST-001", data["created_stations"])

        # Verify the newly ingested station exists in frontend stations list
        stations_resp = self.client.get("/api/stations/frontend")
        self.assertEqual(stations_resp.status_code, 200)
        stations = stations_resp.json()
        station_ids = [s["id"] for s in stations]
        self.assertIn("ASCII-TEST-001", station_ids)

        # Check detail of station
        matching = next(s for s in stations if s["id"] == "ASCII-TEST-001")
        self.assertAlmostEqual(matching["latitude"], 15.42)
        self.assertAlmostEqual(matching["longitude"], 88.21)
        self.assertAlmostEqual(matching["temperature"], 28.4)
        self.assertAlmostEqual(matching["salinity"], 34.8)


if __name__ == "__main__":
    unittest.main()
