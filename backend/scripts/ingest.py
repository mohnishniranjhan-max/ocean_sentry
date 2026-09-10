"""
Data Ingestion Script - Ocean Sentry

Downloads small regional subsets of:
1. Copernicus Global Ocean Physics (model data)
2. Argo float observations

Target region: Bay of Bengal / Indian Ocean
Latitude: 5°N to 22°N
Longitude: 75°E to 95°E
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Region of interest: Bay of Bengal / Indian Ocean
REGION = {
    "lat_min": 5.0,
    "lat_max": 22.0,
    "lon_min": 75.0,
    "lon_max": 95.0,
}

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def download_argo_data():
    """
    Download Argo float profiles from the Argo GDAC.

    Uses the Argo index to find profiles in our region of interest.
    Downloads from Ifremer GDAC (one of the primary mirrors).
    """
    logger.info("=" * 60)
    logger.info("ARGO OBSERVATION DATA INGESTION")
    logger.info("=" * 60)
    logger.info(f"Region: {REGION}")

    argo_dir = DATA_DIR / "argo"
    argo_dir.mkdir(exist_ok=True)

    # Use ArgoVis API for programmatic access to Argo data
    # This provides JSON access to Argo profiles without bulk NetCDF downloads
    base_url = "https://argovis-api.colorado.edu"

    # Time window: last 30 days for development
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)

    logger.info(f"Time window: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

    params = {
        "startDate": start_date.strftime("%Y-%m-%dT00:00:00Z"),
        "endDate": end_date.strftime("%Y-%m-%dT23:59:59Z"),
        "polygon": f"[[{REGION['lon_min']},{REGION['lat_min']}],"
                   f"[{REGION['lon_max']},{REGION['lat_min']}],"
                   f"[{REGION['lon_max']},{REGION['lat_max']}],"
                   f"[{REGION['lon_min']},{REGION['lat_max']}],"
                   f"[{REGION['lon_min']},{REGION['lat_min']}]]",
        "data": "temperature,salinity,pressure",
    }

    logger.info("Querying ArgoVis API for profiles in Bay of Bengal (with data)...")

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.get(
                f"{base_url}/argo",
                params=params,
            )

            if response.status_code == 200:
                profiles = response.json()
                logger.info(f"Received {len(profiles)} Argo profiles")

                # Save raw JSON response
                import json
                output_path = argo_dir / "argo_profiles_bay_of_bengal.json"
                with open(output_path, "w") as f:
                    json.dump(profiles, f)
                logger.info(f"Saved to {output_path}")
                return profiles
            else:
                logger.warning(f"ArgoVis API returned status {response.status_code}")
                logger.warning(f"Response: {response.text[:500]}")
                return None

    except httpx.ConnectError as e:
        logger.warning(f"Cannot reach ArgoVis API: {e}")
        logger.info("Generating synthetic Argo data for development...")
        return generate_synthetic_argo()
    except Exception as e:
        logger.warning(f"Argo download failed: {e}")
        logger.info("Generating synthetic Argo data for development...")
        return generate_synthetic_argo()


def generate_synthetic_argo():
    """
    Generate realistic synthetic Argo profiles for development
    when the real API is unavailable.

    Based on typical Bay of Bengal oceanographic conditions.
    """
    import json

    logger.info("Generating synthetic Argo profiles based on Bay of Bengal climatology")

    argo_dir = DATA_DIR / "argo"
    argo_dir.mkdir(exist_ok=True)

    np.random.seed(42)
    num_profiles = 150
    end_date = datetime.utcnow()

    profiles = []
    depth_levels = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000]

    for i in range(num_profiles):
        lat = np.random.uniform(REGION["lat_min"], REGION["lat_max"])
        lon = np.random.uniform(REGION["lon_min"], REGION["lon_max"])
        days_ago = np.random.uniform(0, 30)
        timestamp = end_date - timedelta(days=days_ago)

        # Bay of Bengal temperature profile (realistic climatology)
        # Surface: 28-30°C, decreasing with depth
        surface_temp = 28.5 + np.random.normal(0, 0.8)
        # Bay of Bengal salinity profile
        # Surface: 31-34 PSU (fresher due to river input), increasing with depth
        surface_sal = 32.5 + np.random.normal(0, 1.0)

        temperatures = []
        salinities = []
        pressures = []

        for d in depth_levels:
            # Temperature decreases with depth (thermocline around 50-100m)
            temp_decay = surface_temp * np.exp(-d / 400.0) + 4.0 * (1 - np.exp(-d / 400.0))
            temp = temp_decay + np.random.normal(0, 0.2)

            # Salinity increases with depth in BoB
            sal = surface_sal + 2.0 * (1 - np.exp(-d / 300.0)) + np.random.normal(0, 0.1)
            sal = max(30.0, min(36.0, sal))

            temperatures.append(round(temp, 3))
            salinities.append(round(sal, 3))
            pressures.append(float(d))

        # Add some quality flags (1=good, 4=bad)
        temp_qc = [1] * len(depth_levels)
        sal_qc = [1] * len(depth_levels)
        # Randomly flag ~5% as questionable
        for j in range(len(depth_levels)):
            if np.random.random() < 0.05:
                temp_qc[j] = 4
            if np.random.random() < 0.05:
                sal_qc[j] = 4

        profile = {
            "_id": f"SYNTH_{i:04d}_{timestamp.strftime('%Y%m%d')}",
            "geolocation": {
                "type": "Point",
                "coordinates": [round(lon, 4), round(lat, 4)],
            },
            "timestamp": timestamp.isoformat() + "Z",
            "date": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "measurements": [
                {
                    "pres": pressures,
                    "temp": temperatures,
                    "psal": salinities,
                    "temp_qc": temp_qc,
                    "psal_qc": sal_qc,
                }
            ],
            "source": "synthetic_dev",
            "platform_number": f"29{np.random.randint(10000, 99999)}",
            "cycle_number": np.random.randint(1, 300),
        }
        profiles.append(profile)

    output_path = argo_dir / "argo_profiles_bay_of_bengal.json"
    with open(output_path, "w") as f:
        json.dump(profiles, f, indent=2, default=str)

    logger.info(f"Generated {num_profiles} synthetic profiles")
    logger.info(f"Saved to {output_path}")
    return profiles


def download_copernicus_model_data():
    """
    Download Copernicus Global Ocean Physics model data.

    Product: GLOBAL_ANALYSISFORECAST_PHY_001_024
    Variables: temperature, salinity, currents, sea level

    For development, generates a realistic synthetic model grid
    when Copernicus credentials are not configured.
    """
    logger.info("=" * 60)
    logger.info("COPERNICUS OCEAN MODEL DATA INGESTION")
    logger.info("=" * 60)
    logger.info(f"Region: {REGION}")

    model_dir = DATA_DIR / "copernicus"
    model_dir.mkdir(exist_ok=True)

    # Check for Copernicus credentials
    username = os.environ.get("COPERNICUS_USERNAME", "")
    password = os.environ.get("COPERNICUS_PASSWORD", "")

    if username and password:
        logger.info("Copernicus credentials found. Attempting real data download...")
        return download_copernicus_real(username, password, model_dir)
    else:
        logger.info("No Copernicus credentials configured.")
        logger.info("Generating synthetic model data for development...")
        return generate_synthetic_model_data(model_dir)


def download_copernicus_real(username: str, password: str, output_dir: Path):
    """
    Download real Copernicus data via the Copernicus Marine Data Store API.
    Uses copernicusmarine Python package if available, else falls back to MOTU.
    """
    try:
        import copernicusmarine
        logger.info("Using copernicusmarine package for download")

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)

        copernicusmarine.subset(
            dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i",
            variables=["thetao"],
            minimum_longitude=REGION["lon_min"],
            maximum_longitude=REGION["lon_max"],
            minimum_latitude=REGION["lat_min"],
            maximum_latitude=REGION["lat_max"],
            start_datetime=start_date.strftime("%Y-%m-%dT00:00:00"),
            end_datetime=end_date.strftime("%Y-%m-%dT00:00:00"),
            minimum_depth=0,
            maximum_depth=1000,
            output_directory=str(output_dir),
            output_filename="copernicus_temperature.nc",
            username=username,
            password=password,
        )
        logger.info("Copernicus temperature data downloaded successfully")
        return True
    except ImportError:
        logger.warning("copernicusmarine package not installed. Using synthetic data.")
        return generate_synthetic_model_data(output_dir)
    except Exception as e:
        logger.warning(f"Copernicus download failed: {e}")
        logger.info("Falling back to synthetic model data.")
        return generate_synthetic_model_data(output_dir)


def generate_synthetic_model_data(output_dir: Path):
    """
    Generate a realistic synthetic ocean model grid for development.

    Based on typical CMEMS Global Ocean Physics output structure:
    - 1/12° horizontal resolution
    - Multiple depth levels
    - 6-hourly temporal resolution
    - Variables: temperature, salinity, zonal/meridional currents, sea level
    """
    import xarray as xr

    logger.info("Generating synthetic Copernicus-like model grid")

    # Grid specification (subsampled for development)
    lat_res = 0.25  # Coarser than real 1/12° for dev speed
    lon_res = 0.25
    lats = np.arange(REGION["lat_min"], REGION["lat_max"] + lat_res, lat_res)
    lons = np.arange(REGION["lon_min"], REGION["lon_max"] + lon_res, lon_res)
    depths = np.array([0.5, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0, 750.0, 1000.0])

    # Time: 7 days at 6-hour intervals
    end_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(days=7)
    times = np.arange(
        np.datetime64(start_time.isoformat()),
        np.datetime64(end_time.isoformat()),
        np.timedelta64(6, 'h')
    )

    logger.info(f"Grid: {len(lats)} lats x {len(lons)} lons x {len(depths)} depths x {len(times)} times")

    np.random.seed(123)

    # Generate temperature field
    # Surface: ~28-30°C in BoB, decreasing with depth
    temp_data = np.zeros((len(times), len(depths), len(lats), len(lons)))
    for ti in range(len(times)):
        for di, d in enumerate(depths):
            surface_base = 29.0 + 0.5 * np.sin(2 * np.pi * (lats[:, None] - 10) / 20)
            depth_factor = np.exp(-d / 350.0)
            deep_temp = 4.5
            temp_field = surface_base * depth_factor + deep_temp * (1 - depth_factor)
            # Add some temporal variability
            temp_field += 0.3 * np.sin(2 * np.pi * ti / len(times))
            # Add spatial noise
            temp_field += np.random.normal(0, 0.1, temp_field.shape)
            temp_data[ti, di, :, :] = temp_field

    # Generate salinity field
    # BoB: fresher at surface (31-33) due to river input, saltier at depth (34.5-35)
    sal_data = np.zeros_like(temp_data)
    for ti in range(len(times)):
        for di, d in enumerate(depths):
            # Freshwater influence decreases with depth and distance from coast
            coast_distance = (lons[None, :] - 80.0) / 10.0
            river_effect = 2.0 * np.exp(-d / 100.0) * np.exp(-coast_distance ** 2)
            sal_field = 34.8 - river_effect + np.random.normal(0, 0.05, (len(lats), len(lons)))
            sal_data[ti, di, :, :] = np.clip(sal_field, 30.0, 36.0)

    # Generate current fields (u, v)
    uo_data = np.zeros_like(temp_data)
    vo_data = np.zeros_like(temp_data)
    for ti in range(len(times)):
        for di, d in enumerate(depths):
            depth_decay = np.exp(-d / 200.0)
            # Simplified gyre pattern
            uo_data[ti, di, :, :] = 0.2 * depth_decay * np.sin(np.pi * (lats[:, None] - 10) / 15) + np.random.normal(0, 0.02, (len(lats), len(lons)))
            vo_data[ti, di, :, :] = 0.15 * depth_decay * np.cos(np.pi * (lons[None, :] - 85) / 15) + np.random.normal(0, 0.02, (len(lats), len(lons)))

    # Generate sea level (2D field, no depth)
    zos_data = np.zeros((len(times), len(lats), len(lons)))
    for ti in range(len(times)):
        zos_data[ti, :, :] = 0.1 * np.sin(2 * np.pi * (lats[:, None] - 12) / 20) + np.random.normal(0, 0.02, (len(lats), len(lons)))

    # Create xarray Dataset (mimicking CMEMS structure)
    ds = xr.Dataset(
        {
            "thetao": (["time", "depth", "latitude", "longitude"], temp_data.astype(np.float32)),
            "so": (["time", "depth", "latitude", "longitude"], sal_data.astype(np.float32)),
            "uo": (["time", "depth", "latitude", "longitude"], uo_data.astype(np.float32)),
            "vo": (["time", "depth", "latitude", "longitude"], vo_data.astype(np.float32)),
            "zos": (["time", "latitude", "longitude"], zos_data.astype(np.float32)),
        },
        coords={
            "time": times,
            "depth": depths,
            "latitude": lats,
            "longitude": lons,
        },
        attrs={
            "title": "Synthetic Global Ocean Physics Analysis (Development)",
            "source": "synthetic_dev - based on CMEMS GLOBAL_ANALYSISFORECAST_PHY_001_024 structure",
            "region": "Bay of Bengal / Indian Ocean",
            "Conventions": "CF-1.6",
        },
    )

    output_path = output_dir / "copernicus_model_bay_of_bengal.nc"
    ds.to_netcdf(output_path)
    logger.info(f"Saved model data to {output_path}")
    logger.info(f"  Dimensions: {dict(ds.dims)}")
    logger.info(f"  Variables: {list(ds.data_vars)}")
    logger.info(f"  Time range: {str(times[0])} to {str(times[-1])}")
    logger.info(f"  Lat range: {lats[0]:.2f} to {lats[-1]:.2f}")
    logger.info(f"  Lon range: {lons[0]:.2f} to {lons[-1]:.2f}")
    logger.info(f"  Depth range: {depths[0]} to {depths[-1]} m")
    logger.info(f"  File size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")

    return ds


def main():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - DATA INGESTION")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)

    # Step 1: Download/generate model data
    model_result = download_copernicus_model_data()

    # Step 2: Download/generate observation data
    argo_result = download_argo_data()

    logger.info("")
    logger.info("=" * 60)
    logger.info("INGESTION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Model data: {'OK' if model_result is not None else 'FAILED'}")
    logger.info(f"Argo data: {'OK' if argo_result is not None else 'FAILED'}")
    logger.info(f"Output directory: {DATA_DIR}")
    logger.info("")
    logger.info("Next step: run scripts/preprocess.py")


if __name__ == "__main__":
    main()
