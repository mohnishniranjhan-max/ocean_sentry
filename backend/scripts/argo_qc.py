"""
Argo Quality Control Script - Ocean Sentry

Applies oceanographic QC filters to preprocessed Argo observations BEFORE
collocation and ML inference. Does NOT modify raw data or the trained model.

QC Tests Applied:
1. Global range check (GTSPP bounds)
2. Regional range check (Bay of Bengal specific)
3. Profile consistency check (entire profile flagged if sensor clearly failed)
4. Spike test (sudden jumps between adjacent depth levels)

Output:
- observations_qc.parquet (filtered observations, preserving raw)
- collocated_qc.parquet (collocation re-run on filtered observations)
- argo_qc_log.json (full QC statistics)
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.utils.calculations import haversine_distance

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
PROCESSED_DIR = DATA_DIR / "processed"
RAW_DIR = DATA_DIR / "raw"

# ─── QC BOUNDS ───────────────────────────────────────────────────────────────

# GTSPP global bounds (permissive outer envelope)
TEMP_GLOBAL_MIN = -2.5
TEMP_GLOBAL_MAX = 40.0
SAL_GLOBAL_MIN = 2.0
SAL_GLOBAL_MAX = 41.0

# Bay of Bengal regional bounds (tighter, based on WOA climatology)
# Even the most freshwater-influenced areas (Ganges delta) rarely go below 20 PSU
# at depth; surface minima ~25 PSU during monsoon peak. Using 15 PSU as conservative
# floor to avoid rejecting real freshwater events while catching sensor failures.
SAL_BOB_MIN = 15.0
SAL_BOB_MAX = 36.5
TEMP_BOB_MIN = 3.0  # deep water
TEMP_BOB_MAX = 33.0  # surface peak

# Profile-level consistency: if >80% of a profile's salinity values are below
# this threshold, the entire salinity profile is a sensor failure
SAL_PROFILE_FAILURE_THRESHOLD = 20.0
SAL_PROFILE_FAILURE_FRACTION = 0.8

# Spike test: |T(k) - (T(k-1)+T(k+1))/2| > threshold
TEMP_SPIKE_THRESHOLD_SHALLOW = 6.0  # deg C, for depth < 500m
TEMP_SPIKE_THRESHOLD_DEEP = 2.0     # deg C, for depth >= 500m
SAL_SPIKE_THRESHOLD = 0.9           # PSU


def load_observations() -> pd.DataFrame:
    """Load preprocessed observations (never modify raw data)."""
    obs_path = PROCESSED_DIR / "observations.parquet"
    if not obs_path.exists():
        logger.error(f"observations.parquet not found at {obs_path}")
        sys.exit(1)

    df = pd.read_parquet(obs_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    logger.info(f"Loaded {len(df)} observations from {obs_path}")
    return df


def qc_global_range(df: pd.DataFrame) -> pd.Series:
    """Test 1: Global range check. Returns boolean mask (True = pass)."""
    temp_ok = df["temperature"].isna() | df["temperature"].between(TEMP_GLOBAL_MIN, TEMP_GLOBAL_MAX)
    sal_ok = df["salinity"].isna() | df["salinity"].between(SAL_GLOBAL_MIN, SAL_GLOBAL_MAX)
    return temp_ok & sal_ok


def qc_regional_range(df: pd.DataFrame) -> pd.Series:
    """Test 2: Bay of Bengal regional range check."""
    temp_ok = df["temperature"].isna() | df["temperature"].between(TEMP_BOB_MIN, TEMP_BOB_MAX)
    sal_ok = df["salinity"].isna() | df["salinity"].between(SAL_BOB_MIN, SAL_BOB_MAX)
    return temp_ok & sal_ok


def qc_profile_consistency(df: pd.DataFrame) -> pd.Series:
    """Test 3: Profile consistency — flag entire profile if sensor clearly failed.

    A profile is identified by unique (latitude, longitude, timestamp).
    If >80% of salinity values in a profile are below SAL_PROFILE_FAILURE_THRESHOLD,
    the entire profile's salinity is considered a sensor failure.
    """
    mask = pd.Series(True, index=df.index)

    profiles = df.groupby(["latitude", "longitude", "timestamp"])
    bad_profiles = []

    for key, group in profiles:
        sal_values = group["salinity"].dropna()
        if len(sal_values) == 0:
            continue
        fraction_below = (sal_values < SAL_PROFILE_FAILURE_THRESHOLD).mean()
        if fraction_below >= SAL_PROFILE_FAILURE_FRACTION:
            bad_profiles.append(key)
            mask.loc[group.index] = False

    if bad_profiles:
        logger.info(f"  Profile consistency: {len(bad_profiles)} profiles flagged as sensor failure")
    return mask


def qc_spike_test(df: pd.DataFrame) -> pd.Series:
    """Test 4: Spike detection on depth-sorted profiles."""
    mask = pd.Series(True, index=df.index)
    spike_count = 0

    profiles = df.groupby(["latitude", "longitude", "timestamp"])

    for _, group in profiles:
        if len(group) < 3:
            continue

        sorted_group = group.sort_values("depth")
        indices = sorted_group.index.values
        temps = sorted_group["temperature"].values
        sals = sorted_group["salinity"].values
        depths = sorted_group["depth"].values

        for k in range(1, len(sorted_group) - 1):
            # Temperature spike
            if not (np.isnan(temps[k]) or np.isnan(temps[k-1]) or np.isnan(temps[k+1])):
                spike_val = abs(temps[k] - (temps[k-1] + temps[k+1]) / 2.0)
                threshold = TEMP_SPIKE_THRESHOLD_DEEP if depths[k] >= 500 else TEMP_SPIKE_THRESHOLD_SHALLOW
                if spike_val > threshold:
                    mask.loc[indices[k]] = False
                    spike_count += 1

            # Salinity spike
            if not (np.isnan(sals[k]) or np.isnan(sals[k-1]) or np.isnan(sals[k+1])):
                spike_val = abs(sals[k] - (sals[k-1] + sals[k+1]) / 2.0)
                if spike_val > SAL_SPIKE_THRESHOLD:
                    mask.loc[indices[k]] = False
                    spike_count += 1

    if spike_count > 0:
        logger.info(f"  Spike test: {spike_count} measurements flagged")
    return mask


def run_qc(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Apply all QC tests and return (filtered_df, statistics)."""
    logger.info("=" * 60)
    logger.info("ARGO QUALITY CONTROL")
    logger.info("=" * 60)

    total = len(df)
    stats = {
        "total_input": total,
        "timestamp": datetime.utcnow().isoformat(),
        "tests": {},
    }

    # Test 1: Global range
    logger.info("Test 1: Global range check...")
    mask_global = qc_global_range(df)
    n_fail_global = (~mask_global).sum()
    stats["tests"]["global_range"] = {
        "passed": int(mask_global.sum()),
        "failed": int(n_fail_global),
        "bounds": {
            "temperature": [TEMP_GLOBAL_MIN, TEMP_GLOBAL_MAX],
            "salinity": [SAL_GLOBAL_MIN, SAL_GLOBAL_MAX],
        },
    }
    logger.info(f"  Global range: {n_fail_global} failed ({n_fail_global/total*100:.1f}%)")

    # Test 2: Regional range
    logger.info("Test 2: Regional range check (Bay of Bengal)...")
    mask_regional = qc_regional_range(df)
    n_fail_regional = (~mask_regional).sum()
    stats["tests"]["regional_range"] = {
        "passed": int(mask_regional.sum()),
        "failed": int(n_fail_regional),
        "bounds": {
            "temperature": [TEMP_BOB_MIN, TEMP_BOB_MAX],
            "salinity": [SAL_BOB_MIN, SAL_BOB_MAX],
        },
    }
    logger.info(f"  Regional range: {n_fail_regional} failed ({n_fail_regional/total*100:.1f}%)")

    # Test 3: Profile consistency
    logger.info("Test 3: Profile consistency check...")
    mask_profile = qc_profile_consistency(df)
    n_fail_profile = (~mask_profile).sum()
    stats["tests"]["profile_consistency"] = {
        "passed": int(mask_profile.sum()),
        "failed": int(n_fail_profile),
        "threshold_psu": SAL_PROFILE_FAILURE_THRESHOLD,
        "fraction_required": SAL_PROFILE_FAILURE_FRACTION,
    }
    logger.info(f"  Profile consistency: {n_fail_profile} failed ({n_fail_profile/total*100:.1f}%)")

    # Test 4: Spike test
    logger.info("Test 4: Spike detection...")
    mask_spike = qc_spike_test(df)
    n_fail_spike = (~mask_spike).sum()
    stats["tests"]["spike_test"] = {
        "passed": int(mask_spike.sum()),
        "failed": int(n_fail_spike),
        "temp_threshold_shallow": TEMP_SPIKE_THRESHOLD_SHALLOW,
        "temp_threshold_deep": TEMP_SPIKE_THRESHOLD_DEEP,
        "sal_threshold": SAL_SPIKE_THRESHOLD,
    }
    logger.info(f"  Spike test: {n_fail_spike} failed ({n_fail_spike/total*100:.1f}%)")

    # Combine all masks
    mask_all = mask_global & mask_regional & mask_profile & mask_spike
    n_pass = mask_all.sum()
    n_fail = (~mask_all).sum()

    stats["total_passed"] = int(n_pass)
    stats["total_failed"] = int(n_fail)
    stats["pass_rate"] = round(n_pass / total * 100, 2)

    # Identify which profiles/locations were removed
    removed = df[~mask_all]
    if not removed.empty:
        removed_locs = removed.groupby(["latitude", "longitude"]).size().reset_index(name="count")
        stats["removed_locations"] = [
            {
                "latitude": round(float(row["latitude"]), 5),
                "longitude": round(float(row["longitude"]), 5),
                "records_removed": int(row["count"]),
            }
            for _, row in removed_locs.iterrows()
        ]

    logger.info("")
    logger.info("─" * 50)
    logger.info("QC SUMMARY")
    logger.info("─" * 50)
    logger.info(f"  Input records:  {total}")
    logger.info(f"  Passed QC:      {n_pass} ({n_pass/total*100:.1f}%)")
    logger.info(f"  Failed QC:      {n_fail} ({n_fail/total*100:.1f}%)")
    logger.info(f"  Records removed: {n_fail}")

    df_clean = df[mask_all].copy()
    df_clean["quality_flag"] = 1  # passed QC

    return df_clean, stats


def run_collocation(obs_qc: pd.DataFrame) -> pd.DataFrame:
    """Re-run collocation on QC-filtered observations."""
    from scripts.collocate import collocate

    model_path = PROCESSED_DIR / "model_data.parquet"
    if not model_path.exists():
        logger.error(f"Model data not found: {model_path}")
        return pd.DataFrame()

    model_df = pd.read_parquet(model_path)
    model_df["timestamp"] = pd.to_datetime(model_df["timestamp"], utc=True).dt.tz_localize(None)
    obs_qc = obs_qc.copy()
    obs_qc["timestamp"] = pd.to_datetime(obs_qc["timestamp"], utc=True).dt.tz_localize(None)

    collocated = collocate(model_df, obs_qc)
    return collocated


def run_ml_diagnostic(collocated_qc: pd.DataFrame) -> dict:
    """Run existing trained model on QC-cleaned data as diagnostic (no retraining)."""
    import joblib

    model_path = Path(__file__).parent.parent / "ml" / "models" / "anomaly_model.joblib"
    if not model_path.exists():
        logger.error("ML model not found — cannot run diagnostic")
        return {}

    bundle = joblib.load(model_path)
    model = bundle["model"]
    scaler = bundle["scaler"]
    feature_names = bundle["feature_names"]

    missing = [f for f in feature_names if f not in collocated_qc.columns]
    if missing:
        logger.error(f"Missing features for ML diagnostic: {missing}")
        return {}

    X = collocated_qc[feature_names].values.astype(np.float64)
    nan_mask = np.isnan(X)
    if nan_mask.any():
        col_medians = np.nanmedian(X, axis=0)
        for col_idx in range(X.shape[1]):
            X[nan_mask[:, col_idx], col_idx] = col_medians[col_idx]

    X_scaled = scaler.transform(X)
    scores = model.decision_function(X_scaled)
    predictions = model.predict(X_scaled)

    score_min = scores.min()
    score_max = scores.max()
    score_range = score_max - score_min if score_max != score_min else 1.0
    normalized = np.clip((score_max - scores) / score_range, 0.0, 1.0)

    n_if_anomaly = int((predictions == -1).sum())
    n_high = int(((predictions == -1) & (normalized >= 0.80)).sum())
    n_warning_if = int(((predictions == -1) & (normalized < 0.80)).sum())
    n_warning_thresh = int(((predictions == 1) & (normalized >= 0.65)).sum())
    n_normal = int(len(predictions) - n_high - n_warning_if - n_warning_thresh)

    result = {
        "total_records": int(len(collocated_qc)),
        "if_anomaly_count": n_if_anomaly,
        "if_anomaly_rate": round(n_if_anomaly / len(collocated_qc) * 100, 2),
        "high_count": n_high,
        "warning_count": n_warning_if + n_warning_thresh,
        "normal_count": n_normal,
        "total_flagged": n_high + n_warning_if + n_warning_thresh,
        "total_flagged_rate": round((n_high + n_warning_if + n_warning_thresh) / len(collocated_qc) * 100, 2),
        "score_stats": {
            "min": round(float(normalized.min()), 4),
            "max": round(float(normalized.max()), 4),
            "mean": round(float(normalized.mean()), 4),
            "median": round(float(np.median(normalized)), 4),
            "std": round(float(normalized.std()), 4),
        },
        "decision_function_stats": {
            "min": round(float(scores.min()), 6),
            "max": round(float(scores.max()), 6),
            "mean": round(float(scores.mean()), 6),
        },
        "note": "Model was NOT retrained — these are scores from the original model applied to QC-cleaned data. "
                "The model was trained on data that INCLUDED the bad-salinity records, so its internal "
                "boundaries are slightly biased. A retrained model on clean data would produce different results.",
    }

    logger.info("")
    logger.info("─" * 50)
    logger.info("ML DIAGNOSTIC (existing model on QC-cleaned data)")
    logger.info("─" * 50)
    logger.info(f"  Total records: {result['total_records']}")
    logger.info(f"  IF anomalies (predict=-1): {n_if_anomaly} ({result['if_anomaly_rate']}%)")
    logger.info(f"  HIGH: {n_high}")
    logger.info(f"  WARNING: {n_warning_if + n_warning_thresh}")
    logger.info(f"  NORMAL: {n_normal}")
    logger.info(f"  Score range: [{normalized.min():.4f}, {normalized.max():.4f}]")

    return result


def main():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - ARGO QUALITY CONTROL PIPELINE")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)
    logger.info("")

    # Step 1: Load observations
    df = load_observations()

    # Step 2: Apply QC
    df_clean, qc_stats = run_qc(df)

    # Step 3: Save QC-filtered observations (preserving original)
    obs_qc_path = PROCESSED_DIR / "observations_qc.parquet"
    df_clean.to_parquet(obs_qc_path, index=False)
    logger.info(f"Saved QC-filtered observations: {obs_qc_path} ({len(df_clean)} records)")

    # Step 4: Re-run collocation on filtered data
    logger.info("")
    logger.info("Re-running collocation on QC-filtered data...")
    collocated_qc = run_collocation(df_clean)

    if collocated_qc.empty:
        logger.error("Collocation produced no records after QC!")
        return

    collocated_qc_path = PROCESSED_DIR / "collocated_qc.parquet"
    collocated_qc.to_parquet(collocated_qc_path, index=False)
    logger.info(f"Saved QC-collocated data: {collocated_qc_path} ({len(collocated_qc)} records)")

    # Step 5: Run ML diagnostic on cleaned data
    logger.info("")
    ml_diagnostic = run_ml_diagnostic(collocated_qc)

    # Step 6: Compare with original (unfiltered) results
    original_collocated_path = PROCESSED_DIR / "collocated.parquet"
    comparison = {}
    if original_collocated_path.exists():
        orig = pd.read_parquet(original_collocated_path)
        comparison = {
            "original_records": int(len(orig)),
            "qc_records": int(len(collocated_qc)),
            "records_removed": int(len(orig) - len(collocated_qc)),
            "removal_rate": round((len(orig) - len(collocated_qc)) / len(orig) * 100, 2),
        }
        logger.info("")
        logger.info("─" * 50)
        logger.info("COMPARISON: Original vs QC-filtered")
        logger.info("─" * 50)
        logger.info(f"  Original collocated records: {len(orig)}")
        logger.info(f"  QC-filtered collocated records: {len(collocated_qc)}")
        logger.info(f"  Records removed: {len(orig) - len(collocated_qc)}")

    # Step 7: Save full QC log
    qc_log = {
        "pipeline": "argo_qc",
        "version": "1.0",
        "run_timestamp": datetime.utcnow().isoformat(),
        "qc_statistics": qc_stats,
        "collocation_comparison": comparison,
        "ml_diagnostic": ml_diagnostic,
    }

    log_path = PROCESSED_DIR / "argo_qc_log.json"
    with open(log_path, "w") as f:
        json.dump(qc_log, f, indent=2)
    logger.info(f"Saved QC log: {log_path}")

    # Final summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("ARGO QC PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Raw observations: {qc_stats['total_input']}")
    logger.info(f"  After QC: {qc_stats['total_passed']} ({qc_stats['pass_rate']}%)")
    logger.info(f"  Collocated (QC): {len(collocated_qc)}")
    if ml_diagnostic:
        logger.info(f"  ML anomaly rate (QC data): {ml_diagnostic['if_anomaly_rate']}%")
    logger.info("")
    logger.info("Output files:")
    logger.info(f"  {obs_qc_path}")
    logger.info(f"  {collocated_qc_path}")
    logger.info(f"  {log_path}")


if __name__ == "__main__":
    main()
