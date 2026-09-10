"""
ML Training Script - Ocean Sentry

Trains an Isolation Forest anomaly detection model on the collocated dataset.

The ML task: detect significant deviations between ocean model estimates and observations.

Steps:
1. Load training dataset
2. Compute baseline error statistics
3. Feature engineering
4. Train/validation split (temporal, NOT random)
5. Train Isolation Forest
6. Evaluate
7. Save model
"""

import sys
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
import joblib

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.utils.calculations import rmse, mae, mean_bias, median_absolute_error

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

TRAINING_DIR = Path(__file__).parent.parent / "data" / "training"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
MODEL_DIR = Path(__file__).parent.parent / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def baseline_analysis(df: pd.DataFrame):
    """Compute baseline error statistics before ML."""
    logger.info("=" * 60)
    logger.info("BASELINE ERROR ANALYSIS")
    logger.info("=" * 60)

    stats = {}

    # Temperature errors
    if "temperature_difference" in df.columns:
        temp_errors = df["temperature_difference"].dropna().values
        if len(temp_errors) > 0:
            stats["temperature"] = {
                "count": len(temp_errors),
                "MAE": mae(temp_errors),
                "RMSE": rmse(temp_errors),
                "Mean_Bias": mean_bias(temp_errors),
                "Median_AE": median_absolute_error(temp_errors),
                "Std": float(np.std(temp_errors)),
                "Min": float(np.min(temp_errors)),
                "Max": float(np.max(temp_errors)),
                "P5": float(np.percentile(temp_errors, 5)),
                "P95": float(np.percentile(temp_errors, 95)),
            }
            logger.info(f"\n  TEMPERATURE (obs - model):")
            for k, v in stats["temperature"].items():
                logger.info(f"    {k}: {v:.4f}" if isinstance(v, float) else f"    {k}: {v}")

    # Salinity errors
    if "salinity_difference" in df.columns:
        sal_errors = df["salinity_difference"].dropna().values
        if len(sal_errors) > 0:
            stats["salinity"] = {
                "count": len(sal_errors),
                "MAE": mae(sal_errors),
                "RMSE": rmse(sal_errors),
                "Mean_Bias": mean_bias(sal_errors),
                "Median_AE": median_absolute_error(sal_errors),
                "Std": float(np.std(sal_errors)),
                "Min": float(np.min(sal_errors)),
                "Max": float(np.max(sal_errors)),
                "P5": float(np.percentile(sal_errors, 5)),
                "P95": float(np.percentile(sal_errors, 95)),
            }
            logger.info(f"\n  SALINITY (obs - model):")
            for k, v in stats["salinity"].items():
                logger.info(f"    {k}: {v:.4f}" if isinstance(v, float) else f"    {k}: {v}")

    return stats


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Prepare feature matrix for ML training."""
    logger.info("Preparing feature matrix...")

    feature_candidates = [
        "latitude",
        "longitude",
        "depth",
        "model_temperature",
        "observed_temperature",
        "temperature_difference",
        "abs_temperature_difference",
        "model_salinity",
        "observed_salinity",
        "salinity_difference",
        "abs_salinity_difference",
        "model_current_u",
        "model_current_v",
        "hour",
        "day_of_year",
        "spatial_distance_km",
    ]

    # Only use features that exist and have data
    available_features = []
    for col in feature_candidates:
        if col in df.columns:
            non_null_pct = df[col].notna().mean()
            if non_null_pct > 0.5:
                available_features.append(col)

    logger.info(f"Using {len(available_features)} features: {available_features}")

    feature_df = df[available_features].copy()
    # NaN fill is deferred to train_model() using training-only medians

    return feature_df, available_features


def train_model(df: pd.DataFrame, feature_names: list[str]):
    """
    Train Isolation Forest on the feature dataset.

    Uses temporal split: earlier data for training, later for validation.
    The split is done by unique timestamp to prevent temporal leakage
    (no timestamp appears in both train and validation sets).
    """
    logger.info("=" * 60)
    logger.info("TRAINING ISOLATION FOREST")
    logger.info("=" * 60)

    if "timestamp" in df.columns:
        df_sorted = df.sort_values("timestamp").reset_index(drop=True)
    else:
        df_sorted = df.reset_index(drop=True)

    # Timestamp-based split: find cutoff so ~70% of records are in training,
    # but ALL records sharing the cutoff timestamp go to the same side.
    unique_ts = df_sorted["timestamp"].drop_duplicates().sort_values().reset_index(drop=True)
    cumulative_counts = df_sorted.groupby("timestamp").size().sort_index().cumsum()
    total = len(df_sorted)
    target = int(total * 0.7)

    # Find the last timestamp whose cumulative count <= target
    cutoff_ts = cumulative_counts[cumulative_counts <= target].index[-1]

    train_df = df_sorted[df_sorted["timestamp"] <= cutoff_ts].reset_index(drop=True)
    val_df = df_sorted[df_sorted["timestamp"] > cutoff_ts].reset_index(drop=True)

    # Verify no temporal leakage
    train_max_ts = train_df["timestamp"].max()
    val_min_ts = val_df["timestamp"].min()
    assert train_max_ts < val_min_ts, (
        f"Temporal leakage: train max {train_max_ts} >= val min {val_min_ts}"
    )
    logger.info(f"Temporal split cutoff: {cutoff_ts}")
    logger.info(f"  Train: {train_df['timestamp'].min()} to {train_max_ts}")
    logger.info(f"  Val:   {val_min_ts} to {val_df['timestamp'].max()}")
    logger.info(f"  Verified: max(train_ts) < min(val_ts) ✓")

    logger.info(f"Training set: {len(train_df)} records")
    logger.info(f"Validation set: {len(val_df)} records")

    # Fill NaN using ONLY training medians (prevents cross-set leakage)
    train_medians = train_df[feature_names].median()
    train_df = train_df.copy()
    val_df = val_df.copy()
    for col in feature_names:
        if train_df[col].isna().any():
            train_df[col] = train_df[col].fillna(train_medians[col])
        if val_df[col].isna().any():
            val_df[col] = val_df[col].fillna(train_medians[col])

    # Prepare feature matrices
    X_train = train_df[feature_names].values
    X_val = val_df[feature_names].values

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        contamination=0.1,  # Expect ~10% anomalies (adjustable)
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )

    logger.info("Fitting Isolation Forest...")
    model.fit(X_train_scaled)

    # Predict on training and validation
    train_scores = model.decision_function(X_train_scaled)
    val_scores = model.decision_function(X_val_scaled)

    train_predictions = model.predict(X_train_scaled)
    val_predictions = model.predict(X_val_scaled)

    # Isolation Forest: -1 = anomaly, 1 = normal
    train_anomaly_rate = (train_predictions == -1).mean()
    val_anomaly_rate = (val_predictions == -1).mean()

    logger.info(f"\nResults:")
    logger.info(f"  Training anomaly rate: {train_anomaly_rate:.3f} ({int(train_anomaly_rate * len(train_df))} anomalies)")
    logger.info(f"  Validation anomaly rate: {val_anomaly_rate:.3f} ({int(val_anomaly_rate * len(val_df))} anomalies)")
    logger.info(f"  Training score range: [{train_scores.min():.3f}, {train_scores.max():.3f}]")
    logger.info(f"  Validation score range: [{val_scores.min():.3f}, {val_scores.max():.3f}]")

    # Analyze what the model considers anomalous
    val_df_with_scores = val_df.copy()
    val_df_with_scores["anomaly_score"] = val_scores
    val_df_with_scores["is_anomaly"] = val_predictions == -1

    if "abs_temperature_difference" in val_df_with_scores.columns:
        anomalies = val_df_with_scores[val_df_with_scores["is_anomaly"]]
        normals = val_df_with_scores[~val_df_with_scores["is_anomaly"]]

        logger.info(f"\n  Temperature error in anomalies: mean={anomalies['abs_temperature_difference'].mean():.3f}°C")
        logger.info(f"  Temperature error in normals: mean={normals['abs_temperature_difference'].mean():.3f}°C")

    if "abs_salinity_difference" in val_df_with_scores.columns:
        anomalies = val_df_with_scores[val_df_with_scores["is_anomaly"]]
        normals = val_df_with_scores[~val_df_with_scores["is_anomaly"]]

        logger.info(f"  Salinity error in anomalies: mean={anomalies['abs_salinity_difference'].mean():.3f} PSU")
        logger.info(f"  Salinity error in normals: mean={normals['abs_salinity_difference'].mean():.3f} PSU")

    return model, scaler, feature_names, val_df_with_scores


def save_model(model, scaler, feature_names: list[str], baseline_stats: dict):
    """Save trained model and metadata."""
    output = {
        "model": model,
        "scaler": scaler,
        "feature_names": feature_names,
        "baseline_stats": baseline_stats,
        "trained_at": datetime.utcnow().isoformat(),
        "model_type": "IsolationForest",
        "note": "Prototype model - thresholds not scientifically validated",
    }

    model_path = MODEL_DIR / "anomaly_model.joblib"
    joblib.dump(output, model_path)
    logger.info(f"\nModel saved to: {model_path}")
    logger.info(f"Model size: {model_path.stat().st_size / 1024:.1f} KB")


def main():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - ML TRAINING")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)

    # Load training data
    training_path = TRAINING_DIR / "training.parquet"
    if not training_path.exists():
        logger.error(f"Training data not found: {training_path}")
        logger.error("Run scripts/collocate.py first")
        return

    df = pd.read_parquet(training_path)
    logger.info(f"Loaded training data: {df.shape}")
    logger.info(f"Columns: {list(df.columns)}")

    if len(df) < 50:
        logger.error(f"Insufficient training data ({len(df)} records). Need at least 50.")
        return

    # Step 1: Baseline error analysis
    baseline_stats = baseline_analysis(df)

    # Step 2: Prepare features
    feature_df, feature_names = prepare_features(df)

    # Merge timestamps back for temporal split
    feature_df["timestamp"] = df["timestamp"].values

    # Step 3: Train model
    model, scaler, feature_names, val_results = train_model(feature_df, feature_names)

    # Step 4: Save model
    save_model(model, scaler, feature_names, baseline_stats)

    # Step 5: Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Model type: Isolation Forest")
    logger.info(f"  Features used: {len(feature_names)}")
    logger.info(f"  Training records: {len(df)}")
    logger.info(f"  Model saved: ml/models/anomaly_model.joblib")
    logger.info("")
    logger.info("  NOTE: This is a prototype model.")
    logger.info("  Anomaly thresholds are NOT scientifically validated.")
    logger.info("  The model detects statistical outliers in model-observation differences.")


if __name__ == "__main__":
    main()
