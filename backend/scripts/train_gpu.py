"""GPU Training Script for Ocean Sentry Anomaly Detection.

Trains an OceanAnomalyAutoencoder PyTorch neural network on NVIDIA CUDA GPU
using collocated ocean observation and model data.
"""

import sys
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

# Ensure backend root is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))
from ml.autoencoder import OceanAnomalyAutoencoder, get_device, get_device_info

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"
MODEL_DIR = Path(__file__).parent.parent / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_NAMES = [
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


def load_dataset() -> pd.DataFrame:
    qc_path = DATA_DIR / "collocated_qc.parquet"
    raw_path = DATA_DIR / "collocated.parquet"

    if qc_path.exists():
        logger.info(f"Loading QC-filtered collocated data from {qc_path}")
        df = pd.read_parquet(qc_path)
    elif raw_path.exists():
        logger.info(f"Loading collocated data from {raw_path}")
        df = pd.read_parquet(raw_path)
    else:
        raise FileNotFoundError(f"No collocated dataset found in {DATA_DIR}")

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    logger.info(f"Loaded {len(df)} records across {len(df.columns)} columns.")
    return df


def prepare_features(df: pd.DataFrame):
    # Ensure all features exist
    for feat in FEATURE_NAMES:
        if feat not in df.columns:
            if feat == "abs_temperature_difference" and "temperature_difference" in df.columns:
                df[feat] = df["temperature_difference"].abs()
            elif feat == "abs_salinity_difference" and "salinity_difference" in df.columns:
                df[feat] = df["salinity_difference"].abs()
            elif feat == "hour":
                df[feat] = df["timestamp"].dt.hour
            elif feat == "day_of_year":
                df[feat] = df["timestamp"].dt.dayofyear
            elif feat == "spatial_distance_km":
                df[feat] = 0.0
            else:
                df[feat] = 0.0

    X = df[FEATURE_NAMES].values.astype(np.float32)

    # Impute missing values with column medians
    nan_mask = np.isnan(X)
    if nan_mask.any():
        col_medians = np.nanmedian(X, axis=0)
        for col_idx in range(X.shape[1]):
            X[nan_mask[:, col_idx], col_idx] = col_medians[col_idx]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X).astype(np.float32)

    return X_scaled, scaler


def train_gpu():
    logger.info("=" * 60)
    logger.info("OCEAN SENTRY - GPU ANOMALY AUTOENCODER TRAINING")
    logger.info("=" * 60)

    device = get_device()
    device_info = get_device_info()
    logger.info(f"Execution Target Device: {device.type.upper()}")
    if device.type == "cuda":
        logger.info(f"  GPU Name: {device_info.get('gpu_name', 'NVIDIA GPU')}")
        logger.info(f"  VRAM: {device_info.get('total_memory_mb', 0)} MB")
        logger.info(f"  Compute Capability: {device_info.get('cuda_capability', 'N/A')}")

    df = load_dataset()
    X_scaled, scaler = prepare_features(df)

    # Split into train (80%) and validation (20%)
    split_idx = int(len(X_scaled) * 0.8)
    X_train = torch.tensor(X_scaled[:split_idx], dtype=torch.float32)
    X_val = torch.tensor(X_scaled[split_idx:], dtype=torch.float32)

    train_dataset = TensorDataset(X_train)
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)

    input_dim = len(FEATURE_NAMES)
    latent_dim = 8
    model = OceanAnomalyAutoencoder(input_dim=input_dim, latent_dim=latent_dim).to(device)

    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5)

    epochs = 40
    logger.info(f"Beginning training ({epochs} epochs on {device.type.upper()})...")

    model.train()
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for batch in train_loader:
            x_batch = batch[0].to(device)
            optimizer.zero_grad()
            reconstruction = model(x_batch)
            loss = criterion(reconstruction, x_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(x_batch)

        avg_train_loss = total_loss / len(X_train)

        # Validation loss
        model.eval()
        with torch.no_grad():
            x_val_dev = X_val.to(device)
            val_recon = model(x_val_dev)
            val_loss = criterion(val_recon, x_val_dev).item()
        model.train()

        scheduler.step(val_loss)

        if epoch % 5 == 0 or epoch == 1 or epoch == epochs:
            vram_log = ""
            if device.type == "cuda":
                vram_used = torch.cuda.memory_allocated(0) / (1024 * 1024)
                vram_log = f" | VRAM: {vram_used:.1f} MB"
            logger.info(f"Epoch {epoch:2d}/{epochs:2d} | Train Loss: {avg_train_loss:.5f} | Val Loss: {val_loss:.5f}{vram_log}")

    # Evaluate full dataset to compute score calibration and anomaly thresholds
    model.eval()
    with torch.no_grad():
        all_tensors = torch.tensor(X_scaled, dtype=torch.float32).to(device)
        errors = model.compute_reconstruction_error(all_tensors).cpu().numpy()

    # Percentile thresholds: 85% Warning, 95% High
    th_warn = float(np.percentile(errors, 85.0))
    th_high = float(np.percentile(errors, 95.0))

    err_min = float(errors.min())
    err_max = float(errors.max())

    logger.info("=" * 60)
    logger.info("CALIBRATION & THRESHOLDS:")
    logger.info(f"  Error Min: {err_min:.5f} | Max: {err_max:.5f} | Mean: {errors.mean():.5f}")
    logger.info(f"  Warning Threshold (85th %ile): {th_warn:.5f}")
    logger.info(f"  High Threshold    (95th %ile): {th_high:.5f}")
    logger.info("=" * 60)

    # Save model bundle
    save_path = MODEL_DIR / "anomaly_model_gpu.pt"
    bundle = {
        "model_state_dict": model.state_dict(),
        "input_dim": input_dim,
        "latent_dim": latent_dim,
        "scaler_mean": scaler.mean_,
        "scaler_scale": scaler.scale_,
        "feature_names": FEATURE_NAMES,
        "threshold_warning": th_warn,
        "threshold_high": th_high,
        "error_min": err_min,
        "error_max": err_max,
        "trained_device": str(device),
        "device_name": device_info.get("gpu_name") or device_info.get("device_name", "GPU"),
        "trained_at": datetime.utcnow().isoformat(),
        "n_records": len(X_scaled),
    }

    torch.save(bundle, save_path)
    logger.info(f"GPU Model bundle successfully exported to: {save_path}")


if __name__ == "__main__":
    train_gpu()
