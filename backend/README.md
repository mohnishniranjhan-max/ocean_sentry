# Ocean Sentry Backend 🌊
### Real-Time Ocean Model-Observation Collocation, Deep Autoencoder Anomaly Detection & Telemetry API

![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![PyTorch](https://img.shields.io/badge/PyTorch-DirectML%20%2F%20CUDA-EE4C2C?style=flat-square&logo=pytorch)
![NVIDIA RTX 5060](https://img.shields.io/badge/GPU-RTX%205060%20(DirectML)-76B900?style=flat-square&logo=nvidia)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)

The **Ocean Sentry Backend** is a high-performance Python FastAPI service providing real-time data ingestion, quality-control filtering, spatiotemporal model-observation collocation, and GPU-accelerated deep learning anomaly detection for the Ocean Sentry 3D digital twin.

---

## 🏗️ Architecture & Data Pipeline

```text
Raw Oceanographic Data Sources (INCOIS, ArgoVis API, Copernicus CMEMS)
                           ↓
               scripts/ingest.py
   (Downloads real ARGO float profiles & CMEMS numerical grids)
                           ↓
              scripts/preprocess.py
   (QC flag filtering [QC=1,2], despiking, standard depth interpolation)
                           ↓
               scripts/collocate.py
   (KD-Tree spatiotemporal collocation: nearest spatial grid within 0.25° & ±12h)
                           ↓
                scripts/train.py
   (Trains PyTorch Deep Autoencoder & Isolation Forest models)
                           ↓
               app/services/ml_service.py
   (GPU-accelerated inference via DirectML / CUDA: sub-15ms latency)
                           ↓
             FastAPI Application (app/main.py)
                           ↓
          Ocean Sentry 3D WebGL Frontend Client
```

---

## 🚀 Quick Setup & Execution

### Prerequisites
* **Python** 3.10 or 3.11
* **Windows with NVIDIA GPU** (DirectML / CUDA acceleration enabled)

### Step 1: Environment Setup

```bash
cd backend

# Create and activate virtual environment
# Windows:
python -m venv venv_gpu
.\venv_gpu\Scripts\activate

# Linux/macOS:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Run Data Pipelines (Optional / Maintenance)

```bash
# 1. Ingest raw float and model data
python scripts/ingest.py

# 2. Quality-control & standardize depth levels
python scripts/preprocess.py

# 3. Collocate model predictions with physical observations
python scripts/collocate.py

# 4. Train Autoencoder and Isolation Forest models
python scripts/train.py
```

### Step 3: Start the FastAPI Server

```bash
# Launch server with hot reload
python -m uvicorn app.main:app --port 8000 --reload
```

* **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 REST & Streaming API Endpoints

### 1. Health & Hardware Telemetry
* `GET /api/health` — System status, database connection, and ML service state.
* `GET /api/ml/device` — Dedicated GPU telemetry (NVIDIA GeForce RTX 5060, DirectML D3D12 / CUDA compute status, VRAM allocation).

### 2. Observation Stations & Buoys
* `GET /api/stations` — All ARGO floats and observation stations with filter parameters (`region`, `type`).
* `GET /api/stations/frontend` — Formatted station payloads mapped directly to the 3D WebGL scene.
* `GET /api/stations/{id}` — Single station metadata, latest sensor values, and status.
* `GET /api/stations/{id}/detail` — Detailed vertical profile telemetry and depth observations.

### 3. Ocean Observations & Models
* `GET /api/ocean/observations` — Multi-depth physical observations (Temperature, Salinity, Current Speed, Wave Height).
* `GET /api/ocean/model` — INCOIS numerical forecast fields (with CMEMS assimilation).
* `GET /api/ocean/grid` — Spatiotemporal model grid coordinates.
* `GET /api/ocean/comparison` — Collocated discrepancies between numerical model predictions and physical sensor ground-truth.

### 4. Anomaly Detection & ML Inference
* `GET /api/ocean/anomalies` — List of detected anomalies with anomaly scores, depth, coordinates, and severity badges (`NORMAL`, `WARNING`, `HIGH`).
* `GET /api/ocean/anomalies/summary` — Aggregated fleet statistics (Total Records, Anomaly Counts, Mean Anomaly Score).
* `POST /api/ml/predict` — Real-time sensor anomaly scoring on the Deep Autoencoder model.

### 5. Real-Time ARGO Telemetry Stream
* `GET /api/argo/stream` — Live streaming endpoint for continuous real-time float updates.

---

## 🧠 Machine Learning Engine

| Component | Specification |
| :--- | :--- |
| **Model Architecture** | PyTorch Deep Autoencoder (Multi-layer bottleneck reconstruction) |
| **Secondary Model** | Isolation Forest (Unsupervised tree-based outlier scoring) |
| **Feature Space** | 16 features (lat, lon, depth, model temp/sal/curr, observed temp/sal/curr, deltas, temporal factors) |
| **Hardware Execution** | DirectML (`DmlExecutionProvider`) / CUDA on **NVIDIA RTX 5060** |
| **Latency** | < 15 ms per batch inference |
| **Thresholds** | Reconstruction MSE & statistical variance thresholds for coastal anomaly detection |

---

## 📂 Backend File Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── routes_anomalies.py   # Anomaly listing & summary routes
│   │   ├── routes_argo.py        # Live ARGO streaming route
│   │   ├── routes_comparison.py  # Model vs observation comparison
│   │   ├── routes_health.py      # Health & GPU device telemetry
│   │   ├── routes_ocean.py       # Observations, models & grids
│   │   └── routes_stations.py    # Station endpoints & 3D frontend mapper
│   ├── config.py                 # Application settings & environment paths
│   ├── main.py                   # FastAPI app entry point & startup hooks
│   ├── models/
│   │   └── schemas.py            # Pydantic data schemas & response models
│   └── services/
│       ├── anomaly_service.py    # Anomaly aggregation & querying service
│       ├── ml_service.py         # PyTorch GPU model loader & inference engine
│       └── ocean_service.py      # Data collocation loader & station builder
├── ml/
│   ├── autoencoder.py            # PyTorch Deep Autoencoder class definition
│   └── models/                   # Serialized model weights (.pt / .onnx / .pkl)
├── scripts/
│   ├── collocate.py              # Spatiotemporal collocation algorithm
│   ├── ingest.py                 # ArgoVis & CMEMS data downloaders
│   ├── preprocess.py             # QC filtering & standardization
│   └── train.py                  # Autoencoder & Isolation Forest training
├── requirements.txt              # Python dependencies
└── README.md
```
