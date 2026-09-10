"""
Data Preprocessing Script - Ocean Sentry

Processes raw data into standardized, quality-controlled format:
1. Load raw Copernicus NetCDF model data (synthetic OR real)
2. Load raw Argo JSON observation data
3. Apply quality control
4. Standardize to internal schema
5. Save processed data

Usage:
  python preprocess.py               # Auto-detect source (prefers real Copernicus)
  python preprocess.py --source copernicus  # Force real Copernicus data
  python preprocess.py --source synthetic   # Force synthetic data
"""

import sys
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import xarray as xr

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.utils.validation import (
    is_valid_coordinate,
    is_valid_depth,
    is_valid_temperature,
    is_valid_salinity,
    filter_nan,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
RAW_COPERNICUS_REAL_DIR = RAW_DIR / "copernicus_real"
RAW_COPERNICUS_SYNTH_DIR = RAW_DIR / "copernicus"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def inspect_dataset(ds: xr.Dataset, name: str):
    """Inspect and log dataset structure."""
    logger.info(f"\n{'─' * 50}")
    logger.info(f"DATASET: {name}")
    logger.info(f"{'─' * 50}")
    logger.info(f"  Dimensions: {dict(ds.dims)}")
    logger.info(f"  Coordinates: {list(ds.coords)}")
    logger.info(f"  Variables: {list(ds.data_vars)}")

    if "time" in ds.coords:
        logger.info(f"  Time range: {str(ds.time.values[0])} to {str(ds.time.values[-1])}")
    if "latitude" in ds.coords:
        logger.info(f"  Lat range: {float(ds.latitude.min()):.3f} to {float(ds.latitude.max()):.3f}")
    if "longitude" in ds.coords:
        logger.info(f"  Lon range: {float(ds.longitude.min()):.3f} to {float(ds.longitude.max()):.3f}")
    if "depth" in ds.coords:
        logger.info(f"  Depth range: {float(ds.depth.min())} to {float(ds.depth.max())} m")
        logger.info(f"  Depth levels: {ds.depth.values.tolist()}")

    for var in ds.data_vars:
        arr = ds[var]
        logger.info(f"  {var}: shape={arr.shape}, dtype={arr.dtype}, "
                    f"min={float(arr.min()):.3f}, max={float(arr.max()):.3f}")


def load_netcdf(path: Path) -> xr.Dataset:
    """Load a NetCDF file."""
    logger.info(f"Loading NetCDF: {path}")
    ds = xr.open_dataset(path)
    return ds


def process_copernicus_model(model_path: Path) -> pd.DataFrame:
    """
    Process Copernicus model data into standardized DataFrame.

    Extracts: temperature, salinity, currents, sea level
    at all available depths and times.
    """
    logger.info("=" * 60)
    logger.info("PROCESSING COPERNICUS MODEL DATA")
    logger.info("=" * 60)

    ds = load_netcdf(model_path)
    inspect_dataset(ds, "Copernicus Model")

    # Variable name mapping (adapt to actual dataset)
    var_map = {
        "thetao": "temperature",
        "so": "salinity",
        "uo": "current_u",
        "vo": "current_v",
        "zos": "sea_level",
        # Common alternative names
        "votemper": "temperature",
        "vosaline": "salinity",
        "vozocrtx": "current_u",
        "vomecrty": "current_v",
    }

    # Find available variables
    available_vars = {}
    for nc_name, std_name in var_map.items():
        if nc_name in ds.data_vars:
            available_vars[nc_name] = std_name

    logger.info(f"Available model variables: {available_vars}")

    # Extract data into records
    records = []
    total_points = 0
    valid_points = 0

    times = ds.time.values
    lats = ds.latitude.values
    lons = ds.longitude.values
    depths = ds.depth.values if "depth" in ds.coords else np.array([0.0])

    logger.info(f"Processing {len(times)} timesteps x {len(depths)} depths...")

    # Sample subset for processing speed (every other time step, subset of depths)
    time_indices = range(0, len(times), 2)
    depth_indices = range(len(depths))

    for ti in time_indices:
        timestamp = pd.Timestamp(times[ti]).to_pydatetime()
        for di in depth_indices:
            depth_val = float(depths[di]) if len(depths) > 1 else 0.0

            # Extract 2D slices for this time/depth
            values = {}
            for nc_name, std_name in available_vars.items():
                var_data = ds[nc_name]
                if "depth" in var_data.dims:
                    slice_data = var_data.isel(time=ti, depth=di).values
                else:
                    slice_data = var_data.isel(time=ti).values
                values[std_name] = slice_data

            # Create records for each grid point (subsample for dev)
            lat_step = max(1, len(lats) // 30)
            lon_step = max(1, len(lons) // 30)

            for lat_i in range(0, len(lats), lat_step):
                for lon_i in range(0, len(lons), lon_step):
                    total_points += 1
                    lat = float(lats[lat_i])
                    lon = float(lons[lon_i])

                    if not is_valid_coordinate(lat, lon):
                        continue

                    record = {
                        "source": "copernicus_model",
                        "timestamp": timestamp,
                        "latitude": lat,
                        "longitude": lon,
                        "depth": depth_val,
                    }

                    for std_name, data_2d in values.items():
                        if data_2d.ndim == 2:
                            val = float(data_2d[lat_i, lon_i])
                        else:
                            val = float(data_2d)
                        record[std_name] = filter_nan(val)

                    # Validate temperature if present
                    if record.get("temperature") is not None:
                        if not is_valid_temperature(record["temperature"]):
                            continue

                    if record.get("salinity") is not None:
                        if not is_valid_salinity(record["salinity"]):
                            continue

                    valid_points += 1
                    records.append(record)

    ds.close()

    df = pd.DataFrame(records)
    logger.info(f"Model processing complete:")
    logger.info(f"  Total grid points examined: {total_points}")
    logger.info(f"  Valid records: {valid_points}")
    logger.info(f"  Removed: {total_points - valid_points}")
    logger.info(f"  DataFrame shape: {df.shape}")

    return df


def process_real_copernicus(data_dir: Path) -> pd.DataFrame:
    """
    Process real Copernicus Marine NetCDF files into standardized DataFrame.

    Handles multiple files (one per variable group) downloaded by ingest_copernicus.py.

    Uses vectorized xarray operations instead of nested Python loops to handle
    the ~500 MB 4-D dataset (time × depth × lat × lon) without exhausting memory
    or running for hours.

    Subsampling strategy (keeps output manageable for collocation):
      - Every 4th time step (6-hourly → 24-hourly effective, ~10 samples over 10 days)
      - Every 3rd lat/lon point (~0.25° effective resolution from 1/12° native)
      - All depth levels ≤ 1000 m
    """
    logger.info("=" * 60)
    logger.info("PROCESSING REAL COPERNICUS MARINE DATA")
    logger.info("=" * 60)

    nc_files = sorted(data_dir.glob("*.nc"))
    if not nc_files:
        logger.error(f"No NetCDF files found in {data_dir}")
        return pd.DataFrame()

    logger.info(f"Found {len(nc_files)} NetCDF files: {[f.name for f in nc_files]}")

    # ------------------------------------------------------------------
    # Open all files lazily and inspect
    # ------------------------------------------------------------------
    datasets = {}
    for f in nc_files:
        ds = xr.open_dataset(f)
        inspect_dataset(ds, f.name)
        datasets[f.stem] = ds

    # ------------------------------------------------------------------
    # Resolve coordinate names from the first dataset
    # All three files share the same grid, so we only need to do this once.
    # ------------------------------------------------------------------
    first_ds = list(datasets.values())[0]

    time_coord = next((n for n in ["time", "time_counter"] if n in first_ds.coords), None)
    lat_coord  = next((n for n in ["latitude", "lat", "nav_lat"] if n in first_ds.coords), None)
    lon_coord  = next((n for n in ["longitude", "lon", "nav_lon"] if n in first_ds.coords), None)
    depth_coord = next((n for n in ["depth", "deptht", "lev"] if n in first_ds.coords), None)

    if time_coord is None:
        logger.error("No time coordinate found in dataset")
        for ds in datasets.values():
            ds.close()
        return pd.DataFrame()

    logger.info(f"Coordinates: time={time_coord}, lat={lat_coord}, lon={lon_coord}, depth={depth_coord}")

    times  = first_ds[time_coord].values
    lats   = first_ds[lat_coord].values
    lons   = first_ds[lon_coord].values
    depths = first_ds[depth_coord].values if depth_coord else np.array([0.5])

    n_t, n_d, n_lat, n_lon = len(times), len(depths), len(lats), len(lons)
    logger.info(f"Native grid: {n_t} times × {n_d} depths × {n_lat} lats × {n_lon} lons")

    # ------------------------------------------------------------------
    # Subsampling indices
    # ------------------------------------------------------------------
    # Spatial: every 3rd point → ~0.25° effective resolution
    lat_step  = 3
    lon_step  = 3
    # Temporal: every 4th step → 24-hourly
    time_step = 4

    lat_idx   = np.arange(0, n_lat, lat_step)
    lon_idx   = np.arange(0, n_lon, lon_step)
    time_idx  = np.arange(0, n_t, time_step)
    # Depth: all levels ≤ 1000 m
    depth_idx = np.where(depths <= 1000.0)[0]

    logger.info(
        f"Subsampling → {len(time_idx)} times × {len(depth_idx)} depths × "
        f"{len(lat_idx)} lats × {len(lon_idx)} lons"
    )
    logger.info(f"  Estimated output rows: {len(time_idx)*len(depth_idx)*len(lat_idx)*len(lon_idx):,}")

    # ------------------------------------------------------------------
    # Variable mapping
    # ------------------------------------------------------------------
    var_map = {
        "thetao": "temperature",
        "so":     "salinity",
        "uo":     "current_u",
        "vo":     "current_v",
        "zos":    "sea_level",
    }

    # Map nc variable name → (standard name, dataset object)
    all_vars: dict[str, tuple[str, xr.Dataset]] = {}
    for ds in datasets.values():
        for nc_name, std_name in var_map.items():
            if nc_name in ds.data_vars and nc_name not in all_vars:
                all_vars[nc_name] = (std_name, ds)

    logger.info(f"Available variables: {list(all_vars.keys())} → {[v[0] for v in all_vars.values()]}")

    # ------------------------------------------------------------------
    # Vectorized extraction — process one time step at a time to cap RAM
    # ------------------------------------------------------------------
    chunk_dfs = []
    total_raw  = 0
    total_valid = 0

    for ti in time_idx:
        timestamp = pd.Timestamp(times[ti])

        # Build per-variable arrays for this time slice (lat_sub × lon_sub × depth_sub)
        arrays: dict[str, np.ndarray] = {}
        for nc_name, (std_name, ds) in all_vars.items():
            var = ds[nc_name]
            if depth_coord and depth_coord in var.dims:
                # Select time, then subsample depth/lat/lon using isel
                sliced = var.isel(
                    **{
                        time_coord:  int(ti),
                        depth_coord: depth_idx.tolist(),
                        lat_coord:   lat_idx.tolist(),
                        lon_coord:   lon_idx.tolist(),
                    }
                ).values  # shape: (n_d_sub, n_lat_sub, n_lon_sub)
            else:
                sliced = var.isel(
                    **{
                        time_coord: int(ti),
                        lat_coord:  lat_idx.tolist(),
                        lon_coord:  lon_idx.tolist(),
                    }
                ).values  # shape: (n_lat_sub, n_lon_sub)
                # Broadcast to (1, n_lat_sub, n_lon_sub) so shape is consistent
                sliced = sliced[np.newaxis, :, :]

            arrays[std_name] = sliced  # (n_d_sub, n_lat_sub, n_lon_sub)

        n_d_sub   = len(depth_idx)
        n_lat_sub = len(lat_idx)
        n_lon_sub = len(lon_idx)

        # Build mesh coordinate arrays (each of length n_d_sub × n_lat_sub × n_lon_sub)
        depth_vals = depths[depth_idx]          # (n_d_sub,)
        lat_vals   = lats[lat_idx]              # (n_lat_sub,)
        lon_vals   = lons[lon_idx]              # (n_lon_sub,)

        # meshgrid → each shape (n_d_sub, n_lat_sub, n_lon_sub)
        g_depth, g_lat, g_lon = np.meshgrid(depth_vals, lat_vals, lon_vals, indexing="ij")

        n_points = g_depth.size
        total_raw += n_points

        chunk = {
            "source":    "copernicus_marine",
            "timestamp": timestamp,
            "latitude":  g_lat.ravel().astype(np.float32),
            "longitude": g_lon.ravel().astype(np.float32),
            "depth":     g_depth.ravel().astype(np.float32),
        }

        for std_name, arr in arrays.items():
            chunk[std_name] = arr.ravel().astype(np.float64)

        cdf = pd.DataFrame(chunk)

        # ------------------------------------------------------------------
        # Quality filtering (vectorized)
        # ------------------------------------------------------------------
        # Drop rows where ALL variables are NaN (land/masked)
        var_cols = [c for c in cdf.columns if c not in ("source", "timestamp", "latitude", "longitude", "depth")]
        valid_mask = cdf[var_cols].notna().any(axis=1)
        cdf = cdf[valid_mask].copy()

        # Temperature range filter
        if "temperature" in cdf.columns:
            t_mask = cdf["temperature"].isna() | (
                (cdf["temperature"] >= -5) & (cdf["temperature"] <= 40)
            )
            cdf = cdf[t_mask]

        # Salinity range filter
        if "salinity" in cdf.columns:
            s_mask = cdf["salinity"].isna() | (
                (cdf["salinity"] >= 0) & (cdf["salinity"] <= 45)
            )
            cdf = cdf[s_mask]

        total_valid += len(cdf)
        chunk_dfs.append(cdf)

    # Close all datasets
    for ds in datasets.values():
        ds.close()

    if not chunk_dfs:
        logger.error("No valid data extracted from Copernicus NetCDF files")
        return pd.DataFrame()

    df = pd.concat(chunk_dfs, ignore_index=True)

    logger.info(f"Real Copernicus processing complete:")
    logger.info(f"  Raw grid points examined: {total_raw:,}")
    logger.info(f"  Valid records:            {total_valid:,}")
    logger.info(f"  Removed (land/QC):        {total_raw - total_valid:,}")
    logger.info(f"  DataFrame shape:          {df.shape}")

    if not df.empty:
        logger.info(f"  Time range:   {df['timestamp'].min()} → {df['timestamp'].max()}")
        logger.info(f"  Lat range:    {df['latitude'].min():.4f} → {df['latitude'].max():.4f}")
        logger.info(f"  Lon range:    {df['longitude'].min():.4f} → {df['longitude'].max():.4f}")
        logger.info(f"  Depth range:  {df['depth'].min():.4f} → {df['depth'].max():.4f} m")
        for col in ["temperature", "salinity", "current_u", "current_v"]:
            if col in df.columns:
                non_null = df[col].notna().sum()
                logger.info(
                    f"  {col}: {non_null:,}/{len(df):,} non-null "
                    f"({100*non_null/len(df):.0f}%)  "
                    f"min={df[col].min():.4f}  max={df[col].max():.4f}"
                )

    return df


def process_argo_observations(argo_path: Path) -> pd.DataFrame:
    """
    Process Argo JSON profiles into standardized DataFrame.

    Handles two formats:
    - ArgoVis API format (data_info + data arrays)
    - Synthetic development format (measurements array)

    Applies quality control:
    - Remove profiles with QC flag = 4 (bad)
    - Validate coordinates and depths
    - Validate temperature and salinity ranges
    """
    logger.info("=" * 60)
    logger.info("PROCESSING ARGO OBSERVATION DATA")
    logger.info("=" * 60)

    with open(argo_path) as f:
        profiles = json.load(f)

    logger.info(f"Loaded {len(profiles)} profiles from {argo_path}")

    # Detect format
    if profiles and "data_info" in profiles[0]:
        return _process_argovis_format(profiles)
    else:
        return _process_synthetic_format(profiles)


def _process_argovis_format(profiles: list) -> pd.DataFrame:
    """Process real ArgoVis API response format."""
    logger.info("Detected ArgoVis API format")

    records = []
    total_measurements = 0
    valid_measurements = 0
    removed_qc = 0
    removed_range = 0
    removed_coord = 0
    skipped_no_data = 0

    for profile in profiles:
        # Extract coordinates
        coords = profile.get("geolocation", {}).get("coordinates", [None, None])
        if len(coords) < 2 or coords[0] is None:
            removed_coord += 1
            continue

        lon = float(coords[0])
        lat = float(coords[1])

        if not is_valid_coordinate(lat, lon):
            removed_coord += 1
            continue

        # Parse timestamp
        ts_str = profile.get("timestamp")
        if not ts_str:
            continue
        try:
            timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        # Parse data_info to find variable indices
        data_info = profile.get("data_info", [])
        data = profile.get("data")

        if not data_info or not data or len(data_info) < 1:
            skipped_no_data += 1
            continue

        # data_info[0] is the list of variable names
        var_names = data_info[0]

        # Find indices of variables we need
        temp_idx = None
        sal_idx = None
        pres_idx = None
        temp_qc_idx = None
        sal_qc_idx = None

        for idx, name in enumerate(var_names):
            name_lower = name.lower() if name else ""
            if name_lower == "temperature":
                temp_idx = idx
            elif name_lower == "salinity":
                sal_idx = idx
            elif name_lower == "pressure":
                pres_idx = idx
            elif name_lower == "temperature_argoqc":
                temp_qc_idx = idx
            elif name_lower == "salinity_argoqc":
                sal_qc_idx = idx

        if pres_idx is None:
            skipped_no_data += 1
            continue

        # data is a list of arrays, one per variable
        # Each array has values at different depth levels
        if not isinstance(data, list) or len(data) == 0:
            skipped_no_data += 1
            continue

        # Determine number of levels from pressure data
        pres_data = data[pres_idx] if pres_idx < len(data) else None
        if pres_data is None:
            skipped_no_data += 1
            continue

        num_levels = len(pres_data)
        profile_id = profile.get("_id", "unknown")

        for i in range(num_levels):
            total_measurements += 1

            # Get pressure (depth)
            pres_val = pres_data[i]
            if pres_val is None:
                continue
            depth = float(pres_val)

            if not is_valid_depth(depth):
                removed_range += 1
                continue

            # Temperature
            temp = None
            if temp_idx is not None and temp_idx < len(data):
                temp_data = data[temp_idx]
                if i < len(temp_data) and temp_data[i] is not None:
                    # Check QC
                    qc_ok = True
                    if temp_qc_idx is not None and temp_qc_idx < len(data):
                        qc_data = data[temp_qc_idx]
                        if i < len(qc_data) and qc_data[i] is not None:
                            if int(qc_data[i]) == 4:
                                qc_ok = False
                                removed_qc += 1
                    if qc_ok:
                        t = float(temp_data[i])
                        if is_valid_temperature(t):
                            temp = t
                        else:
                            removed_range += 1

            # Salinity
            sal = None
            if sal_idx is not None and sal_idx < len(data):
                sal_data = data[sal_idx]
                if i < len(sal_data) and sal_data[i] is not None:
                    qc_ok = True
                    if sal_qc_idx is not None and sal_qc_idx < len(data):
                        qc_data = data[sal_qc_idx]
                        if i < len(qc_data) and qc_data[i] is not None:
                            if int(qc_data[i]) == 4:
                                qc_ok = False
                    if qc_ok:
                        s = float(sal_data[i])
                        if is_valid_salinity(s):
                            sal = s

            if temp is None and sal is None:
                continue

            valid_measurements += 1
            records.append({
                "id": f"{profile_id}_d{i}",
                "source": "argo",
                "timestamp": timestamp,
                "latitude": lat,
                "longitude": lon,
                "depth": depth,
                "temperature": temp,
                "salinity": sal,
                "current_u": None,
                "current_v": None,
                "quality_flag": 1,
            })

    df = pd.DataFrame(records)
    logger.info(f"Argo processing complete (ArgoVis format):")
    logger.info(f"  Total profiles: {len(profiles)}")
    logger.info(f"  Profiles with no data: {skipped_no_data}")
    logger.info(f"  Total measurements: {total_measurements}")
    logger.info(f"  Valid measurements: {valid_measurements}")
    logger.info(f"  Removed (QC flag): {removed_qc}")
    logger.info(f"  Removed (range): {removed_range}")
    logger.info(f"  Removed (coordinates): {removed_coord}")
    logger.info(f"  DataFrame shape: {df.shape}")

    if not df.empty:
        logger.info(f"  Time range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        logger.info(f"  Lat range: {df['latitude'].min():.3f} to {df['latitude'].max():.3f}")
        logger.info(f"  Lon range: {df['longitude'].min():.3f} to {df['longitude'].max():.3f}")
        logger.info(f"  Depth range: {df['depth'].min():.1f} to {df['depth'].max():.1f} m")
        logger.info(f"  Temperature non-null: {df['temperature'].notna().sum()}")
        logger.info(f"  Salinity non-null: {df['salinity'].notna().sum()}")

    return df


def _process_synthetic_format(profiles: list) -> pd.DataFrame:
    """Process synthetic development data format."""
    logger.info("Detected synthetic format")

    records = []
    total_measurements = 0
    valid_measurements = 0

    for profile in profiles:
        coords = profile.get("geolocation", {}).get("coordinates", [None, None])
        if len(coords) < 2 or coords[0] is None:
            continue

        lon = float(coords[0])
        lat = float(coords[1])

        if not is_valid_coordinate(lat, lon):
            continue

        ts_str = profile.get("timestamp") or profile.get("date")
        if not ts_str:
            continue
        try:
            timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        measurements = profile.get("measurements", [])
        if not measurements:
            continue

        meas = measurements[0]
        pressures = meas.get("pres", [])
        temperatures = meas.get("temp", [])
        salinities = meas.get("psal", [])
        profile_id = profile.get("_id", "unknown")

        for i, pres in enumerate(pressures):
            total_measurements += 1
            depth = float(pres)
            if not is_valid_depth(depth):
                continue

            temp = float(temperatures[i]) if i < len(temperatures) and temperatures[i] is not None else None
            sal = float(salinities[i]) if i < len(salinities) and salinities[i] is not None else None

            if temp is not None and not is_valid_temperature(temp):
                temp = None
            if sal is not None and not is_valid_salinity(sal):
                sal = None

            if temp is None and sal is None:
                continue

            valid_measurements += 1
            records.append({
                "id": f"{profile_id}_d{i}",
                "source": "argo_synthetic",
                "timestamp": timestamp,
                "latitude": lat,
                "longitude": lon,
                "depth": depth,
                "temperature": temp,
                "salinity": sal,
                "current_u": None,
                "current_v": None,
                "quality_flag": 1,
            })

    df = pd.DataFrame(records)
    logger.info(f"Synthetic Argo processing: {total_measurements} measurements, {valid_measurements} valid")
    return df


def detect_source() -> str:
    """Auto-detect whether real Copernicus data is available."""
    real_files = list(RAW_COPERNICUS_REAL_DIR.glob("*.nc"))
    if real_files:
        return "copernicus"
    synth_path = RAW_COPERNICUS_SYNTH_DIR / "copernicus_model_bay_of_bengal.nc"
    if synth_path.exists():
        return "synthetic"
    return "none"


def main():
    parser = argparse.ArgumentParser(description="Ocean Sentry Data Preprocessing")
    parser.add_argument(
        "--source", choices=["copernicus", "synthetic", "auto"],
        default="auto",
        help="Model data source: 'copernicus' (real CMEMS), 'synthetic', or 'auto' (default)"
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - DATA PREPROCESSING")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)

    # Determine model data source
    if args.source == "auto":
        source = detect_source()
        logger.info(f"Auto-detected source: {source}")
    else:
        source = args.source

    # Process model data
    model_df = pd.DataFrame()

    if source == "copernicus":
        if RAW_COPERNICUS_REAL_DIR.exists() and list(RAW_COPERNICUS_REAL_DIR.glob("*.nc")):
            model_df = process_real_copernicus(RAW_COPERNICUS_REAL_DIR)
        else:
            logger.error(f"Real Copernicus data not found in {RAW_COPERNICUS_REAL_DIR}")
            logger.error("Run scripts/ingest_copernicus.py first")
    elif source == "synthetic":
        model_path = RAW_COPERNICUS_SYNTH_DIR / "copernicus_model_bay_of_bengal.nc"
        if model_path.exists():
            model_df = process_copernicus_model(model_path)
        else:
            logger.error(f"Synthetic model data not found at {model_path}")
            logger.error("Run scripts/ingest.py first")
    else:
        logger.error("No model data available. Run ingest first.")

    if not model_df.empty:
        model_output = PROCESSED_DIR / "model_data.parquet"
        model_df.to_parquet(model_output, index=False)
        logger.info(f"Saved processed model data: {model_output}")

        # Write a metadata file so downstream knows the source
        import json as json_mod
        if source == "copernicus":
            meta = {
                "source": "Copernicus Marine",
                "product": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
                "datasets": {
                    "temperature": "cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i",
                    "salinity":    "cmems_mod_glo_phy-so_anfc_0.083deg_PT6H-i",
                    "currents":    "cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i",
                },
                "region": "Bay of Bengal",
                "bounding_box": {
                    "latitude_min": 5.0,
                    "latitude_max": 18.0,
                    "longitude_min": 80.0,
                    "longitude_max": 92.0,
                },
                "time_range": {
                    "start": "2026-08-10T00:00:00",
                    "end":   "2026-08-20T00:00:00",
                },
                "depth_range": {
                    "description": "Model levels ~0.5 m to ~902 m (all levels ≤ 1000 m selected)",
                    "min_m": 0.494,
                    "max_m": 902.339,
                },
                "native_resolution_deg": 0.08334,
                "temporal_resolution": "6-hourly native (subsampled to 24-hourly for processing)",
                "records": len(model_df),
                "processed_at": datetime.utcnow().isoformat(),
            }
        else:
            meta = {
                "source": source,
                "records": len(model_df),
                "processed_at": datetime.utcnow().isoformat(),
            }
        with open(PROCESSED_DIR / "model_source.json", "w") as f:
            json_mod.dump(meta, f, indent=2)

    # Process Argo observations
    argo_path = RAW_DIR / "argo" / "argo_profiles_bay_of_bengal.json"
    if argo_path.exists():
        obs_df = process_argo_observations(argo_path)
        obs_output = PROCESSED_DIR / "observations.parquet"
        obs_df.to_parquet(obs_output, index=False)
        logger.info(f"Saved processed observations: {obs_output}")
    else:
        logger.error(f"Argo data not found at {argo_path}")
        logger.error("Run scripts/ingest.py first")
        obs_df = pd.DataFrame()

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("PREPROCESSING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Model source: {source}")
    logger.info(f"Model records: {len(model_df)}")
    logger.info(f"Observation records: {len(obs_df)}")
    logger.info(f"Output directory: {PROCESSED_DIR}")
    logger.info("")
    logger.info("Next step: run scripts/collocate.py")


if __name__ == "__main__":
    main()
