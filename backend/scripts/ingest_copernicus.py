"""
Real Copernicus Marine Data Ingestion - Ocean Sentry

Downloads actual CMEMS Global Ocean Physics Analysis and Forecast data
for the Bay of Bengal region.

Product: GLOBAL_ANALYSISFORECAST_PHY_001_024
Variables: thetao (temperature), so (salinity), uo (eastward current), vo (northward current)
Resolution: 1/12° (~8km), 6-hourly
Depth: Surface to 1000m (50 standard levels)

Prerequisites:
  - pip install copernicusmarine
  - Copernicus Marine account (free): https://data.marine.copernicus.eu/register
  - Credentials configured via:
      copernicusmarine login
    (stores credentials in ~/.copernicusmarine/.copernicusmarine-credentials)
  - Or via environment variables:
      COPERNICUSMARINE_SERVICE_USERNAME / COPERNICUSMARINE_SERVICE_PASSWORD
"""

import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = BACKEND_DIR / "data" / "raw" / "copernicus_real"
DATA_DIR.mkdir(parents=True, exist_ok=True)

REGION = {
    "lat_min": 5.0,
    "lat_max": 18.0,
    "lon_min": 80.0,
    "lon_max": 92.0,
}

DEPTH_MIN = 0.0
DEPTH_MAX = 1000.0

DATASETS = {
    "temperature": {
        "dataset_id": "cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i",
        "variables": ["thetao"],
        "filename": "copernicus_temperature.nc",
    },
    "salinity": {
        "dataset_id": "cmems_mod_glo_phy-so_anfc_0.083deg_PT6H-i",
        "variables": ["so"],
        "filename": "copernicus_salinity.nc",
    },
    "currents": {
        "dataset_id": "cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i",
        "variables": ["uo", "vo"],
        "filename": "copernicus_currents.nc",
    },
}


def test_authentication() -> bool:
    """
    Lightweight authentication test using the copernicusmarine Python API.

    The toolbox discovers credentials automatically from (in priority order):
      1. Environment variables: COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD
      2. Credentials file:      ~/.copernicusmarine/.copernicusmarine-credentials
                                (written by `copernicusmarine login`)
      3. Legacy netrc / motuclient files

    No username/password are read or printed here; the toolbox handles it.
    """
    try:
        from copernicusmarine.core_functions.credentials_utils import (
            _retrieve_credential_from_default_configuration_files,
            _retrieve_credential_from_environment_variable,
            _validate_and_get_user,
        )

        # Attempt to resolve credentials the same way the toolbox does internally.
        username = _retrieve_credential_from_environment_variable("username")
        password = _retrieve_credential_from_environment_variable("password")

        if not username:
            username, _ = _retrieve_credential_from_default_configuration_files("username")
        if not password:
            password, _ = _retrieve_credential_from_default_configuration_files("password")

        if not username or not password:
            return False

        # Validate against the Copernicus Marine auth system.
        user = _validate_and_get_user(username, password)
        return user is not None

    except Exception as e:
        logger.debug(f"Auth test internal error: {e}")
        return False


def download_dataset(
    name: str,
    config: dict,
    start_date: str,
    end_date: str,
) -> Path | None:
    """
    Download a single CMEMS dataset subset.

    Credentials are NOT passed explicitly — the copernicusmarine toolbox
    resolves them from the stored configuration created by `copernicusmarine login`
    or from COPERNICUSMARINE_SERVICE_USERNAME/PASSWORD environment variables.
    """
    import copernicusmarine

    output_path = DATA_DIR / config["filename"]
    logger.info(f"Downloading {name}: {config['dataset_id']}")
    logger.info(f"  Variables: {config['variables']}")
    logger.info(f"  Region: {REGION['lat_min']}-{REGION['lat_max']}N, {REGION['lon_min']}-{REGION['lon_max']}E")
    logger.info(f"  Time: {start_date} to {end_date}")
    logger.info(f"  Depth: {DEPTH_MIN}-{DEPTH_MAX}m")

    try:
        result = copernicusmarine.subset(
            dataset_id=config["dataset_id"],
            variables=config["variables"],
            minimum_longitude=REGION["lon_min"],
            maximum_longitude=REGION["lon_max"],
            minimum_latitude=REGION["lat_min"],
            maximum_latitude=REGION["lat_max"],
            start_datetime=start_date,
            end_datetime=end_date,
            minimum_depth=DEPTH_MIN,
            maximum_depth=DEPTH_MAX,
            output_directory=str(DATA_DIR),
            output_filename=config["filename"],
            overwrite=True,
        )
        if result and output_path.exists():
            size_mb = output_path.stat().st_size / 1024 / 1024
            logger.info(f"  Downloaded: {output_path} ({size_mb:.1f} MB)")
            return output_path
        else:
            logger.error(f"  Download returned None or file not found at {output_path}")
            return None
    except Exception as e:
        logger.error(f"  Download failed: {type(e).__name__}: {e}")
        return None


def main():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - REAL COPERNICUS DATA INGESTION")
    logger.info("=" * 60)

    # ------------------------------------------------------------------
    # Authentication check
    # ------------------------------------------------------------------
    # The copernicusmarine toolbox (v2.4.1) discovers credentials from:
    #   1. Env vars: COPERNICUSMARINE_SERVICE_USERNAME / _SERVICE_PASSWORD
    #   2. ~/.copernicusmarine/.copernicusmarine-credentials  (copernicusmarine login)
    #   3. Legacy ~/.netrc / motuclient files
    #
    # We do NOT require the user to pass credentials to this script.
    # We rely entirely on the toolbox's own credential discovery mechanism.
    # ------------------------------------------------------------------

    logger.info("Testing Copernicus Marine authentication...")
    auth_ok = test_authentication()

    if not auth_ok:
        logger.error("")
        logger.error("=" * 60)
        logger.error("COPERNICUS MARINE AUTHENTICATION FAILED")
        logger.error("=" * 60)
        logger.error("")
        logger.error("The copernicusmarine toolbox could not find valid credentials.")
        logger.error("")
        logger.error("To fix this, run the following command and follow the prompts:")
        logger.error("")
        logger.error("    copernicusmarine login")
        logger.error("")
        logger.error("This writes credentials to:")
        logger.error("    ~/.copernicusmarine/.copernicusmarine-credentials")
        logger.error("")
        logger.error("Alternatively, export environment variables before running:")
        logger.error("    export COPERNICUSMARINE_SERVICE_USERNAME=<your_username>")
        logger.error("    export COPERNICUSMARINE_SERVICE_PASSWORD=<your_password>")
        logger.error("")
        logger.error("Then re-run: python scripts/ingest_copernicus.py")
        logger.error("=" * 60)
        sys.exit(1)

    logger.info("Authentication: OK")
    logger.info("")

    # ------------------------------------------------------------------
    # Time window
    # ------------------------------------------------------------------
    # Argo data: 2026-07-25 to 2026-08-24
    # 10-day window for manageable download size:
    start_date = "2026-08-10T00:00:00"
    end_date = "2026-08-20T00:00:00"

    logger.info(f"Target time window: {start_date} to {end_date}")
    logger.info(f"Target region: {REGION}")
    logger.info("")

    # ------------------------------------------------------------------
    # Download each variable dataset
    # ------------------------------------------------------------------
    results = {}
    for name, config in DATASETS.items():
        path = download_dataset(name, config, start_date, end_date)
        results[name] = path

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    logger.info("")
    logger.info("=" * 60)
    logger.info("DOWNLOAD SUMMARY")
    logger.info("=" * 60)
    success_count = sum(1 for p in results.values() if p is not None)
    for name, path in results.items():
        if path and path.exists():
            status = f"OK ({path.stat().st_size / 1024 / 1024:.1f} MB)"
        else:
            status = "FAILED"
        logger.info(f"  {name}: {status}")
    logger.info(f"  Total: {success_count}/{len(results)} datasets downloaded")
    logger.info(f"  Output directory: {DATA_DIR}")

    if success_count == 0:
        logger.error("No data downloaded. Check credentials and network.")
        sys.exit(1)

    logger.info("")
    logger.info("Next step: python scripts/preprocess.py --source copernicus")


if __name__ == "__main__":
    main()
