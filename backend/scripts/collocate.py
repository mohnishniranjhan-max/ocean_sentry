"""
Collocation Script - Ocean Sentry

THE CORE DATA PIPELINE.

For each valid observation, find the corresponding model state:
1. Nearest spatial location (within max distance threshold)
2. Nearest/appropriate timestamp (within max time threshold)
3. Matching/interpolated depth

Produces a collocated dataset where each row has:
- observation values
- model values at the same approximate location/time/depth
- computed differences
"""

import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.utils.calculations import haversine_distance, absolute_difference, percentage_difference

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
TRAINING_DIR = Path(__file__).parent.parent / "data" / "training"
TRAINING_DIR.mkdir(parents=True, exist_ok=True)

# Collocation thresholds
MAX_SPATIAL_DISTANCE_KM = 50.0
MAX_TIME_DIFFERENCE_HOURS = 12.0
MAX_DEPTH_DIFFERENCE_M = 20.0


def build_model_index(model_df: pd.DataFrame) -> dict:
    """
    Build spatial-temporal index for efficient model lookup.

    Groups model data by (rounded_time, depth) and builds a KD-tree
    for each group for fast nearest-neighbor spatial lookup.
    """
    logger.info("Building model spatial-temporal index...")

    # Round model timestamps to 6-hour intervals for grouping
    model_df = model_df.copy()
    model_df["time_group"] = model_df["timestamp"].dt.floor("6h")

    # Group by time and depth
    index = {}
    groups = model_df.groupby(["time_group", "depth"])

    for (time_group, depth), group in groups:
        coords = group[["latitude", "longitude"]].values
        if len(coords) < 1:
            continue
        tree = cKDTree(coords)
        index[(time_group, depth)] = {
            "tree": tree,
            "data": group.reset_index(drop=True),
        }

    logger.info(f"Built index with {len(index)} (time, depth) groups")
    return index


def find_nearest_model_state(
    obs_lat: float,
    obs_lon: float,
    obs_time: datetime,
    obs_depth: float,
    model_index: dict,
    model_df: pd.DataFrame,
) -> dict | None:
    """
    Find the nearest model grid point to an observation.

    Strategy:
    1. Find the closest time group
    2. Find the closest depth level
    3. Use KD-tree for spatial nearest neighbor
    4. Validate distance thresholds
    """
    # Find closest time group
    time_groups = sorted(set(k[0] for k in model_index.keys()))
    if not time_groups:
        return None

    obs_time_ts = pd.Timestamp(obs_time)
    time_diffs = [abs((obs_time_ts - tg).total_seconds()) / 3600.0 for tg in time_groups]
    closest_time_idx = np.argmin(time_diffs)
    closest_time = time_groups[closest_time_idx]
    time_diff_hours = time_diffs[closest_time_idx]

    if time_diff_hours > MAX_TIME_DIFFERENCE_HOURS:
        return None

    # Find closest depth level
    depth_levels = sorted(set(k[1] for k in model_index.keys() if k[0] == closest_time))
    if not depth_levels:
        return None

    depth_diffs = [abs(obs_depth - d) for d in depth_levels]
    closest_depth_idx = np.argmin(depth_diffs)
    closest_depth = depth_levels[closest_depth_idx]
    depth_diff = depth_diffs[closest_depth_idx]

    if depth_diff > MAX_DEPTH_DIFFERENCE_M:
        return None

    # Spatial lookup using KD-tree
    key = (closest_time, closest_depth)
    if key not in model_index:
        return None

    entry = model_index[key]
    tree = entry["tree"]
    data = entry["data"]

    query_point = np.array([[obs_lat, obs_lon]])
    dist, idx = tree.query(query_point, k=1)
    dist = dist[0]
    idx = idx[0]

    # Convert approximate degree distance to km
    spatial_dist_km = haversine_distance(obs_lat, obs_lon, data.iloc[idx]["latitude"], data.iloc[idx]["longitude"])

    if spatial_dist_km > MAX_SPATIAL_DISTANCE_KM:
        return None

    model_row = data.iloc[idx]
    return {
        "model_latitude": model_row["latitude"],
        "model_longitude": model_row["longitude"],
        "model_timestamp": model_row["timestamp"],
        "model_depth": model_row["depth"],
        "model_temperature": model_row.get("temperature"),
        "model_salinity": model_row.get("salinity"),
        "model_current_u": model_row.get("current_u"),
        "model_current_v": model_row.get("current_v"),
        "model_sea_level": model_row.get("sea_level"),
        "spatial_distance_km": spatial_dist_km,
        "time_difference_hours": time_diff_hours,
        "depth_difference_m": depth_diff,
    }


def collocate(model_df: pd.DataFrame, obs_df: pd.DataFrame) -> pd.DataFrame:
    """
    Perform model-observation collocation.

    For each observation, find the matching model state and compute differences.
    """
    logger.info("=" * 60)
    logger.info("MODEL-OBSERVATION COLLOCATION")
    logger.info("=" * 60)
    logger.info(f"Model records: {len(model_df)}")
    logger.info(f"Observation records: {len(obs_df)}")

    # Build spatial-temporal index
    model_index = build_model_index(model_df)

    # Collocate each observation
    collocated_records = []
    matched = 0
    unmatched_time = 0
    unmatched_space = 0
    unmatched_depth = 0

    total = len(obs_df)
    report_interval = max(1, total // 10)

    for i, obs in obs_df.iterrows():
        if (i + 1) % report_interval == 0:
            logger.info(f"  Processing observation {i + 1}/{total} ({matched} matched so far)")

        model_state = find_nearest_model_state(
            obs_lat=obs["latitude"],
            obs_lon=obs["longitude"],
            obs_time=obs["timestamp"],
            obs_depth=obs["depth"],
            model_index=model_index,
            model_df=model_df,
        )

        if model_state is None:
            continue

        matched += 1

        # Compute differences
        record = {
            "timestamp": obs["timestamp"],
            "latitude": obs["latitude"],
            "longitude": obs["longitude"],
            "depth": obs["depth"],
            "observation_id": obs.get("id", f"obs_{i}"),
            "observation_source": obs.get("source", "unknown"),
            "observation_quality": obs.get("quality_flag"),

            # Model values
            "model_temperature": model_state.get("model_temperature"),
            "model_salinity": model_state.get("model_salinity"),
            "model_current_u": model_state.get("model_current_u"),
            "model_current_v": model_state.get("model_current_v"),
            "model_sea_level": model_state.get("model_sea_level"),

            # Observation values
            "observed_temperature": obs.get("temperature"),
            "observed_salinity": obs.get("salinity"),
            "observed_current_u": obs.get("current_u"),
            "observed_current_v": obs.get("current_v"),

            # Differences
            "temperature_difference": absolute_difference(obs.get("temperature"), model_state.get("model_temperature")),
            "salinity_difference": absolute_difference(obs.get("salinity"), model_state.get("model_salinity")),

            # Absolute differences
            "abs_temperature_difference": abs(absolute_difference(obs.get("temperature"), model_state.get("model_temperature")) or 0),
            "abs_salinity_difference": abs(absolute_difference(obs.get("salinity"), model_state.get("model_salinity")) or 0),

            # Percentage differences
            "temperature_pct_difference": percentage_difference(obs.get("temperature"), model_state.get("model_temperature")),
            "salinity_pct_difference": percentage_difference(obs.get("salinity"), model_state.get("model_salinity")),

            # Collocation metadata
            "spatial_distance_km": model_state["spatial_distance_km"],
            "time_difference_hours": model_state["time_difference_hours"],
            "depth_difference_m": model_state["depth_difference_m"],

            # Temporal features
            "hour": obs["timestamp"].hour if hasattr(obs["timestamp"], "hour") else pd.Timestamp(obs["timestamp"]).hour,
            "day_of_year": obs["timestamp"].timetuple().tm_yday if hasattr(obs["timestamp"], "timetuple") else pd.Timestamp(obs["timestamp"]).day_of_year,
        }

        collocated_records.append(record)

    df = pd.DataFrame(collocated_records)

    logger.info("")
    logger.info("─" * 50)
    logger.info("COLLOCATION RESULTS")
    logger.info("─" * 50)
    logger.info(f"  Total observations: {total}")
    logger.info(f"  Successfully collocated: {matched}")
    logger.info(f"  Match rate: {matched / max(1, total) * 100:.1f}%")
    logger.info(f"  Unmatched: {total - matched}")

    if not df.empty:
        logger.info(f"  Time range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        logger.info(f"  Lat range: {df['latitude'].min():.3f} to {df['latitude'].max():.3f}")
        logger.info(f"  Lon range: {df['longitude'].min():.3f} to {df['longitude'].max():.3f}")
        logger.info(f"  Depth range: {df['depth'].min():.1f} to {df['depth'].max():.1f} m")

        # Column availability
        non_null_cols = {col: df[col].notna().sum() for col in df.columns if "temperature" in col or "salinity" in col}
        logger.info(f"  Variable availability:")
        for col, count in sorted(non_null_cols.items()):
            logger.info(f"    {col}: {count}/{len(df)} ({count/len(df)*100:.0f}%)")

    return df


def main():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - COLLOCATION PIPELINE")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)

    # Load processed data
    model_path = PROCESSED_DIR / "model_data.parquet"
    obs_path = PROCESSED_DIR / "observations.parquet"

    if not model_path.exists():
        logger.error(f"Model data not found: {model_path}")
        logger.error("Run scripts/preprocess.py first")
        return

    if not obs_path.exists():
        logger.error(f"Observation data not found: {obs_path}")
        logger.error("Run scripts/preprocess.py first")
        return

    model_df = pd.read_parquet(model_path)
    obs_df = pd.read_parquet(obs_path)

    logger.info(f"Loaded model data: {model_df.shape}")
    logger.info(f"Loaded observations: {obs_df.shape}")

    # Ensure timestamp columns are datetime and timezone-naive (UTC assumed)
    model_df["timestamp"] = pd.to_datetime(model_df["timestamp"], utc=True).dt.tz_localize(None)
    obs_df["timestamp"] = pd.to_datetime(obs_df["timestamp"], utc=True).dt.tz_localize(None)

    # Perform collocation
    collocated_df = collocate(model_df, obs_df)

    if collocated_df.empty:
        logger.error("No collocated records produced!")
        logger.error("Check time/space overlap between model and observation data.")
        return

    # Save collocated dataset
    collocation_output = PROCESSED_DIR / "collocated.parquet"
    collocated_df.to_parquet(collocation_output, index=False)
    logger.info(f"Saved collocated data: {collocation_output}")

    # Also save as CSV for easy inspection
    csv_output = PROCESSED_DIR / "collocated_sample.csv"
    collocated_df.head(100).to_csv(csv_output, index=False)
    logger.info(f"Saved CSV sample: {csv_output}")

    # Create training dataset (subset of columns useful for ML)
    training_cols = [
        "timestamp", "latitude", "longitude", "depth",
        "model_temperature", "observed_temperature", "temperature_difference", "abs_temperature_difference",
        "model_salinity", "observed_salinity", "salinity_difference", "abs_salinity_difference",
        "model_current_u", "model_current_v",
        "hour", "day_of_year",
        "observation_quality", "spatial_distance_km",
    ]
    available_cols = [c for c in training_cols if c in collocated_df.columns]
    training_df = collocated_df[available_cols].copy()

    training_output = TRAINING_DIR / "training.parquet"
    training_df.to_parquet(training_output, index=False)
    logger.info(f"Saved training dataset: {training_output} ({len(training_df)} records)")

    # Final summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("COLLOCATION PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Model records loaded: {len(model_df)}")
    logger.info(f"  Observation records loaded: {len(obs_df)}")
    logger.info(f"  Collocated records: {len(collocated_df)}")
    logger.info(f"  Training records: {len(training_df)}")
    logger.info(f"  Available training features: {available_cols}")
    logger.info("")
    logger.info("Next step: run scripts/train.py")


if __name__ == "__main__":
    main()
