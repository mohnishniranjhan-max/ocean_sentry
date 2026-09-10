import logging
from typing import Optional
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings
from app.models.schemas import AnomalyStatus

logger = logging.getLogger(__name__)


class AnomalyService:
    """Runs Isolation Forest inference on collocated data at startup, caches results."""

    def __init__(self):
        self._results: Optional[pd.DataFrame] = None
        self._anomaly_count = 0
        self._data_source = "unknown"
        self._scored = False

    def run_inference(self, ml_service):
        """Score all collocated records using the trained model. Called once at startup."""
        collocated_qc_path = settings.data_dir / "processed" / "collocated_qc.parquet"
        collocated_path = settings.data_dir / "processed" / "collocated.parquet"

        if collocated_qc_path.exists():
            data_path = collocated_qc_path
            logger.info("Using QC-filtered collocated data for anomaly scoring.")
        elif collocated_path.exists():
            data_path = collocated_path
            logger.info("QC-filtered data not found; using unfiltered collocated data.")
        else:
            logger.warning("No collocated data for anomaly scoring.")
            return

        if not ml_service._model_loaded:
            logger.warning("ML model not loaded; anomaly scoring unavailable.")
            return

        try:
            df = pd.read_parquet(data_path)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        except Exception as e:
            logger.error(f"Failed to load collocated data: {e}")
            return

        feature_names = ml_service._feature_names
        scaler = ml_service._scaler
        model = ml_service._model

        missing = [f for f in feature_names if f not in df.columns]
        if missing:
            logger.error(f"Collocated data missing features: {missing}")
            return

        X = df[feature_names].values.astype(np.float64)
        nan_mask = np.isnan(X)
        if nan_mask.any():
            col_medians = np.nanmedian(X, axis=0)
            for col_idx in range(X.shape[1]):
                X[nan_mask[:, col_idx], col_idx] = col_medians[col_idx]

        X_scaled = scaler.transform(X)
        ort_sess = getattr(ml_service, "_ort_session", None)
        is_pytorch = "PyTorch" in getattr(ml_service, "_model_type", "")

        if ort_sess is not None:
            # DirectML GPU Batch Inference on NVIDIA RTX 5060
            out = ort_sess.run(None, {"input": X_scaled.astype(np.float32)})[0]
            errors = np.mean((X_scaled - out) ** 2, axis=1)

            err_min = getattr(ml_service, "_err_min", float(errors.min()))
            err_max = getattr(ml_service, "_err_max", float(errors.max()))
            err_range = max(1e-5, err_max - err_min)
            normalized = np.clip((errors - err_min) / err_range, 0.0, 1.0)
            scores = errors

            th_warn = getattr(ml_service, "_th_warning", float(np.percentile(errors, 85.0)))
            th_high = getattr(ml_service, "_th_high", float(np.percentile(errors, 95.0)))

            predictions = np.ones(len(df), dtype=int)
            statuses = []
            for i in range(len(df)):
                err = errors[i]
                norm = normalized[i]
                if err >= th_high or norm >= 0.80:
                    predictions[i] = -1
                    statuses.append(AnomalyStatus.HIGH)
                elif err >= th_warn or norm >= 0.60:
                    predictions[i] = -1
                    statuses.append(AnomalyStatus.WARNING)
                else:
                    statuses.append(AnomalyStatus.NORMAL)
        elif is_pytorch:
            import torch
            from ml.autoencoder import get_device
            device = get_device()
            x_tensor = torch.tensor(X_scaled, dtype=torch.float32).to(device)
            with torch.no_grad():
                errors = model.compute_reconstruction_error(x_tensor).cpu().numpy()


            err_min = getattr(ml_service, "_err_min", float(errors.min()))
            err_max = getattr(ml_service, "_err_max", float(errors.max()))
            err_range = max(1e-5, err_max - err_min)
            normalized = np.clip((errors - err_min) / err_range, 0.0, 1.0)
            scores = errors

            th_warn = getattr(ml_service, "_th_warning", float(np.percentile(errors, 85.0)))
            th_high = getattr(ml_service, "_th_high", float(np.percentile(errors, 95.0)))

            predictions = np.ones(len(df), dtype=int)
            statuses = []
            for i in range(len(df)):
                err = errors[i]
                norm = normalized[i]
                if err >= th_high or norm >= 0.80:
                    predictions[i] = -1
                    statuses.append(AnomalyStatus.HIGH)
                elif err >= th_warn or norm >= 0.60:
                    predictions[i] = -1
                    statuses.append(AnomalyStatus.WARNING)
                else:
                    statuses.append(AnomalyStatus.NORMAL)
        else:
            scores = model.decision_function(X_scaled)
            score_min = scores.min()
            score_max = scores.max()
            score_range = score_max - score_min if score_max != score_min else 1.0
            normalized = np.clip((score_max - scores) / score_range, 0.0, 1.0)

            predictions = model.predict(X_scaled)

            statuses = []
            for i in range(len(df)):
                if predictions[i] == -1 and normalized[i] >= 0.80:
                    statuses.append(AnomalyStatus.HIGH)
                elif predictions[i] == -1:
                    statuses.append(AnomalyStatus.WARNING)
                elif normalized[i] >= 0.65:
                    statuses.append(AnomalyStatus.WARNING)
                else:
                    statuses.append(AnomalyStatus.NORMAL)

        df = df.copy()
        df["anomaly_score"] = normalized
        df["raw_score"] = scores
        df["anomaly_status"] = statuses
        df["ml_prediction"] = predictions

        self._results = df
        self._anomaly_count = (df["anomaly_status"] != AnomalyStatus.NORMAL).sum()
        self._scored = True

        import json
        source_path = settings.data_dir / "processed" / "model_source.json"
        if source_path.exists():
            try:
                with open(source_path) as f:
                    meta = json.load(f)
                self._data_source = meta.get("source", "unknown")
            except Exception:
                pass

        n_high = (df["anomaly_status"] == AnomalyStatus.HIGH).sum()
        n_warn = (df["anomaly_status"] == AnomalyStatus.WARNING).sum()
        n_norm = (df["anomaly_status"] == AnomalyStatus.NORMAL).sum()
        logger.info(
            f"Anomaly scoring complete: {len(df)} records | "
            f"HIGH={n_high} WARNING={n_warn} NORMAL={n_norm}"
        )

    @property
    def is_available(self) -> bool:
        return self._scored and self._results is not None

    @property
    def total_anomaly_count(self) -> int:
        return int(self._anomaly_count)

    def get_anomalies(
        self,
        parameter: Optional[str] = None,
        status: Optional[str] = None,
        depth_min: Optional[float] = None,
        depth_max: Optional[float] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 50,
    ) -> dict:
        if not self.is_available:
            return {"count": 0, "anomalies": [], "data_source": "unavailable"}

        df = self._results.copy()

        # Only non-normal by default
        if status:
            df = df[df["anomaly_status"] == status]
        else:
            df = df[df["anomaly_status"] != AnomalyStatus.NORMAL]

        if lat_min is not None:
            df = df[df["latitude"] >= lat_min]
        if lat_max is not None:
            df = df[df["latitude"] <= lat_max]
        if lon_min is not None:
            df = df[df["longitude"] >= lon_min]
        if lon_max is not None:
            df = df[df["longitude"] <= lon_max]
        if depth_min is not None:
            df = df[df["depth"] >= depth_min]
        if depth_max is not None:
            df = df[df["depth"] <= depth_max]
        if start_time is not None:
            df = df[df["timestamp"] >= start_time]
        if end_time is not None:
            df = df[df["timestamp"] <= end_time]

        df = df.sort_values("anomaly_score", ascending=False).head(limit)

        anomalies = []
        for _, row in df.iterrows():
            record = {
                "station_id": self._station_id_for(row),
                "latitude": round(float(row["latitude"]), 4),
                "longitude": round(float(row["longitude"]), 4),
                "depth": round(float(row["depth"]), 1),
                "timestamp": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
                "parameter": "temperature",
                "observed_value": round(float(row["observed_temperature"]), 3) if pd.notna(row.get("observed_temperature")) else None,
                "model_value": round(float(row["model_temperature"]), 3) if pd.notna(row.get("model_temperature")) else None,
                "difference": round(float(row["temperature_difference"]), 3) if pd.notna(row.get("temperature_difference")) else None,
                "anomaly_score": round(float(row["anomaly_score"]), 4),
                "status": row["anomaly_status"].value if hasattr(row["anomaly_status"], "value") else str(row["anomaly_status"]),
                "confidence": round(float(row["anomaly_score"]), 2),
            }
            anomalies.append(record)

        source = "INCOIS Grid + Argo" if "copernicus" in self._data_source.lower() else "Prototype Ocean Model + Argo"
        return {
            "count": len(anomalies),
            "anomalies": anomalies,
            "data_source": source,
        }

    def get_station_anomaly_info(self, latitude: float, longitude: float) -> Optional[dict]:
        """Get aggregated ML anomaly info for a station location."""
        if not self.is_available:
            return None

        df = self._results
        tolerance = 0.01
        station_records = df[
            (df["latitude"].between(latitude - tolerance, latitude + tolerance))
            & (df["longitude"].between(longitude - tolerance, longitude + tolerance))
        ]

        if station_records.empty:
            return None

        max_score = float(station_records["anomaly_score"].max())
        anomaly_records = station_records[station_records["anomaly_status"] != AnomalyStatus.NORMAL]
        anomaly_count = len(anomaly_records)

        if anomaly_count == 0:
            status = AnomalyStatus.NORMAL
        else:
            statuses = anomaly_records["anomaly_status"].values
            if any(s == AnomalyStatus.HIGH for s in statuses):
                status = AnomalyStatus.HIGH
            else:
                status = AnomalyStatus.WARNING

        return {
            "anomaly_score": round(max_score, 4),
            "anomaly_count": anomaly_count,
            "status": status,
            "total_records": len(station_records),
        }

    def _station_id_for(self, row) -> str:
        lat = row["latitude"]
        lon = row["longitude"]
        if not self.is_available:
            return "UNKNOWN"
        df = self._results
        matches = df[
            (df["latitude"] == lat) & (df["longitude"] == lon)
        ]
        if matches.empty:
            return "UNKNOWN"
        idx = df[(df["latitude"] == lat) & (df["longitude"] == lon)].index[0]
        profiles = df.groupby(["latitude", "longitude"]).ngroup()
        group_id = profiles.iloc[idx]
        return f"ARGO-{group_id + 1:03d}"

    def get_summary(self) -> dict:
        """Return a summary for diagnostics."""
        if not self.is_available:
            return {"available": False}

        df = self._results
        return {
            "available": True,
            "total_records": int(len(df)),
            "total_anomalies": int(self._anomaly_count),
            "high_count": int((df["anomaly_status"] == AnomalyStatus.HIGH).sum()),
            "warning_count": int((df["anomaly_status"] == AnomalyStatus.WARNING).sum()),
            "normal_count": int((df["anomaly_status"] == AnomalyStatus.NORMAL).sum()),
            "score_min": float(round(float(df["anomaly_score"].min()), 4)),
            "score_max": float(round(float(df["anomaly_score"].max()), 4)),
            "score_mean": float(round(float(df["anomaly_score"].mean()), 4)),
            "data_source": str(self._data_source),
        }


anomaly_service = AnomalyService()
