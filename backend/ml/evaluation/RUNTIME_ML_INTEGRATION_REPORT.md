# Runtime ML Integration Report

## Model Information
- **Model file**: backend/ml/models/anomaly_model.joblib
- **Model type**: IsolationForest (n_estimators=200, contamination=0.1)
- **Trained at**: 2026-08-24T19:17:34.107785
- **Features used**: 16

## Feature Names (exact order)
1. latitude
2. longitude
3. depth
4. model_temperature
5. observed_temperature
6. temperature_difference
7. abs_temperature_difference
8. model_salinity
9. observed_salinity
10. salinity_difference
11. abs_salinity_difference
12. model_current_u
13. model_current_v
14. hour
15. day_of_year
16. spatial_distance_km

## Data Source
- **Source**: Copernicus Marine Global Analysis/Forecast (GLOBAL_ANALYSISFORECAST_PHY_001_024)
- **Observations**: Real Argo float profiles
- **Region**: Bay of Bengal (5-18°N, 80-92°E)

## Inference Results
- **Collocated records**: 1443
- **Records scored**: 1443 (100%)
- **NORMAL**: 1170 (81.1%)
- **WARNING**: 216 (15.0%)
- **HIGH**: 57 (4.0%)
- **Total anomalies (WARNING+HIGH)**: 273 (18.9%)

## Score Statistics
- **Min anomaly score**: 0.0000
- **Max anomaly score**: 1.0000
- **Mean anomaly score**: 0.4316
- **Raw decision_function range**: [-0.0445, 0.1032]

## Station Impact
- **Total stations**: 24
- **Stations with anomalies**: 19

## Feature Construction Verification
- Training features derived from: collocated data (same pipeline)
- Runtime features derived from: backend/data/processed/collocated.parquet
- Feature names: IDENTICAL to saved model
- Feature ordering: IDENTICAL to saved model
- Scaler: same StandardScaler fitted during training
- NaN handling: median fill (matches training procedure)
- All 16 features 100% available in collocated data

## Anomaly Classification Logic
- **HIGH**: model.predict() == -1 AND normalized_score >= 0.80
- **WARNING**: model.predict() == -1 AND normalized_score < 0.80, OR normalized_score >= 0.65
- **NORMAL**: model.predict() == 1 AND normalized_score < 0.65

Score normalization: (score_max - raw_score) / (score_max - score_min), clipped to [0, 1]
Higher normalized score = more anomalous.

## Integration Path
1. FastAPI startup → ml_service.load_model() → loads .joblib
2. anomaly_service.run_inference() → loads collocated.parquet → builds feature matrix → scales → runs decision_function()
3. Results cached in memory
4. GET /api/ocean/anomalies → returns cached ML results
5. GET /api/stations/frontend → station status derived from ML scores
6. Frontend fetches both endpoints → renders on 3D globe
