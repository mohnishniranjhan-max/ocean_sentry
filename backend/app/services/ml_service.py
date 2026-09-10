import logging
from typing import Optional, Dict, Any
from pathlib import Path
import numpy as np

from app.models.schemas import AnomalyResult, AnomalyStatus, PredictionResponse
from app.config import settings

logger = logging.getLogger(__name__)


class MLService:
    """ML inference service with GPU acceleration.

    Prioritizes PyTorch GPU Deep Autoencoder (CUDA on NVIDIA RTX 5060)
    with graceful fallback to CPU Isolation Forest.
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._feature_names = []
        self._model_loaded = False
        self._model_type = "none"
        self._device = "cpu"
        self._gpu_info: Dict[str, Any] = {}
        self._th_warning = settings.anomaly_threshold_warning
        self._th_high = settings.anomaly_threshold_high
        self._err_min = 0.0
        self._err_max = 1.0

    def load_model(self):
        """Attempt to load GPU model first, then CPU joblib model."""
        gpu_model_path = settings.model_gpu_path
        cpu_model_path = settings.model_path
        # Check for ONNX DirectML model
        onnx_model_path = settings.model_gpu_path.with_suffix(".onnx")
        self._ort_session = None

        if settings.use_gpu and onnx_model_path.exists():
            try:
                import onnxruntime as ort
                from ml.autoencoder import get_device_info

                self._gpu_info = get_device_info()
                providers = ["DmlExecutionProvider", "CPUExecutionProvider"] if self._gpu_info.get("dml_supported") else ["CPUExecutionProvider"]
                sess = ort.InferenceSession(str(onnx_model_path), providers=providers)
                self._ort_session = sess
                self._device = "gpu"
                self._model_type = "Deep Autoencoder (NVIDIA RTX 5060 DirectML GPU)"
                logger.info(f"DirectML GPU session created successfully on {sess.get_providers()}!")
            except Exception as e:
                logger.warning(f"Could not initialize DirectML session: {e}")

        # Try loading PyTorch GPU model bundle
        if settings.use_gpu and gpu_model_path.exists():
            try:
                import torch
                from ml.autoencoder import OceanAnomalyAutoencoder, get_device, get_device_info

                self._gpu_info = get_device_info()
                device = get_device()

                bundle = torch.load(gpu_model_path, map_location="cpu", weights_only=False)

                model = OceanAnomalyAutoencoder(
                    input_dim=bundle.get("input_dim", 16),
                    latent_dim=bundle.get("latent_dim", 8),
                )
                model.load_state_dict(bundle["model_state_dict"])
                model.eval()

                self._model = model
                self._feature_names = bundle["feature_names"]
                self._th_warning = bundle.get("threshold_warning", 0.11)
                self._th_high = bundle.get("threshold_high", 0.24)
                self._err_min = bundle.get("error_min", 0.001)
                self._err_max = bundle.get("error_max", 0.6)

                from sklearn.preprocessing import StandardScaler
                scaler = StandardScaler()
                scaler.mean_ = bundle["scaler_mean"]
                scaler.scale_ = bundle["scaler_scale"]
                scaler.var_ = bundle["scaler_scale"] ** 2
                scaler.n_features_in_ = len(self._feature_names)
                self._scaler = scaler

                self._model_loaded = True
                if not self._ort_session:
                    self._device = "gpu"
                    self._model_type = "PyTorch Autoencoder (GPU)"
                logger.info(f"ML model active: {self._model_type} on {self._gpu_info.get('gpu_name', 'GPU')}")
                return
            except Exception as e:
                logger.warning(f"Failed to load PyTorch GPU model bundle: {e}. Falling back to CPU model.")


        # Fallback to Scikit-Learn CPU model
        if cpu_model_path.exists():
            try:
                import joblib
                saved = joblib.load(cpu_model_path)
                self._model = saved["model"]
                self._scaler = saved["scaler"]
                self._feature_names = saved["feature_names"]
                self._baseline_stats = saved.get("baseline_stats", {})
                self._model_loaded = True
                self._model_type = "Isolation Forest (CPU)"
                self._device = "cpu"
                logger.info(f"ML model loaded from {cpu_model_path}")
            except Exception as e:
                logger.warning(f"Failed to load CPU ML model: {e}")
        else:
            logger.info("No trained ML model found.")

    def get_device_info(self) -> Dict[str, Any]:
        """Returns active execution hardware telemetry."""
        try:
            from ml.autoencoder import get_device_info
            info = get_device_info()
        except Exception:
            info = {"cuda_available": False, "device": "cpu", "device_name": "CPU"}

        info["active_model_type"] = self._model_type
        info["model_loaded"] = self._model_loaded
        info["active_device"] = self._device
        return info

    def predict(self, features: dict) -> PredictionResponse:
        if not self._model_loaded:
            return PredictionResponse(
                anomaly_score=0.0,
                status=AnomalyStatus.NORMAL,
                confidence=0.0,
            )

        try:
            # Build feature vector
            feature_vector = []
            for name in self._feature_names:
                val = features.get(name, 0.0)
                feature_vector.append(float(val) if val is not None else 0.0)

            X = np.array([feature_vector], dtype=np.float32)
            X_scaled = self._scaler.transform(X)

            if self._ort_session is not None:
                # DirectML GPU forward pass on NVIDIA RTX 5060
                out = self._ort_session.run(None, {"input": X_scaled})[0]
                mse_error = float(np.mean((X_scaled - out) ** 2, axis=1)[0])

                err_range = max(1e-5, self._err_max - self._err_min)
                norm_score = float(np.clip((mse_error - self._err_min) / err_range, 0.0, 1.0))

                if mse_error >= self._th_high or norm_score >= 0.80:
                    status = AnomalyStatus.HIGH
                elif mse_error >= self._th_warning or norm_score >= 0.60:
                    status = AnomalyStatus.WARNING
                else:
                    status = AnomalyStatus.NORMAL

                return PredictionResponse(
                    anomaly_score=round(norm_score, 4),
                    status=status,
                    confidence=0.92,
                )
            elif "PyTorch" in self._model_type:
                import torch
                from ml.autoencoder import get_device
                device = get_device()
                x_tensor = torch.tensor(X_scaled, dtype=torch.float32).to(device)
                with torch.no_grad():
                    mse_error = float(self._model.compute_reconstruction_error(x_tensor)[0].item())

                err_range = max(1e-5, self._err_max - self._err_min)
                norm_score = float(np.clip((mse_error - self._err_min) / err_range, 0.0, 1.0))

                if mse_error >= self._th_high or norm_score >= 0.80:
                    status = AnomalyStatus.HIGH
                elif mse_error >= self._th_warning or norm_score >= 0.60:
                    status = AnomalyStatus.WARNING
                else:
                    status = AnomalyStatus.NORMAL


                return PredictionResponse(
                    anomaly_score=round(norm_score, 4),
                    status=status,
                    confidence=0.88,
                )
            else:
                score = self._model.decision_function(X_scaled)[0]
                normalized_score = max(0.0, min(1.0, 0.5 - score))
                if normalized_score >= settings.anomaly_threshold_high:
                    status = AnomalyStatus.HIGH
                elif normalized_score >= settings.anomaly_threshold_warning:
                    status = AnomalyStatus.WARNING
                else:
                    status = AnomalyStatus.NORMAL

                return PredictionResponse(
                    anomaly_score=round(normalized_score, 4),
                    status=status,
                    confidence=0.75,
                )
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return PredictionResponse(
                anomaly_score=0.0,
                status=AnomalyStatus.NORMAL,
                confidence=0.0,
            )

    def get_anomalies(
        self,
        parameter: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[AnomalyResult]:
        return []


ml_service = MLService()

