# Argo Quality Control Report

**Date**: 2026-08-25  
**Pipeline**: `backend/scripts/argo_qc.py`  
**Input**: `backend/data/processed/observations.parquet` (25,161 records)  
**Output**: `backend/data/processed/collocated_qc.parquet` (3,268 records)  
**Model**: NOT retrained — existing `anomaly_model.joblib` used as diagnostic only

---

## 1. Problem Statement

The ML Sanity Audit (2026-08-25) identified that 32.6% of all flagged anomalies in the collocated dataset originated from a single Argo float with a malfunctioning conductivity sensor. The float reported salinity of 3.7 PSU across all depth levels — physically impossible for open Bay of Bengal water (typical range: 28–35 PSU).

This data passed through the existing pipeline because:
1. **No ArgoVis QC flags were available** — the API returned only `temperature`, `salinity`, `pressure` (no `temperature_argoqc` or `salinity_argoqc` fields)
2. **The validation range was too permissive** — `is_valid_salinity()` accepts [0, 45] PSU, which technically includes 3.7
3. **The quality_flag column was hardcoded to 1** (line 602 of `preprocess.py`) — never populated from actual QC metadata

---

## 2. Root Cause: Argo Float 2903434

Three consecutive cycles from WMO float **2903434** have systematic conductivity sensor failure:

| Cycle | Profile ID | Location | Salinity Range | Depth Levels |
|-------|-----------|----------|---------------|--------------|
| 083 | 2903434_083 | (12.791, 86.482) | 3.686–3.767 PSU | 1,008 |
| 084 | 2903434_084 | (13.170, 86.846) | 3.703–3.797 PSU | 1,008 |
| 085 | 2903434_085 | (13.136, 86.953) | 3.726–3.808 PSU | 1,008 |

**Total bad measurements**: 3,024 (across all depth levels of 3 profiles)

The salinity values are nearly constant (3.7 ± 0.06 PSU) regardless of depth — a clear signature of sensor failure rather than ocean variability. Normal Bay of Bengal profiles show salinity increasing from ~32 PSU at the surface to ~35 PSU at depth.

---

## 3. QC Tests Implemented

### Test 1: Global Range Check (GTSPP Bounds)
- Temperature: [-2.5, 40.0] °C
- Salinity: [2.0, 41.0] PSU
- **Result**: 0 failures (the bad data is above 2.0 PSU)

### Test 2: Regional Range Check (Bay of Bengal)
- Temperature: [3.0, 33.0] °C
- Salinity: [15.0, 36.5] PSU
- **Result**: 3,832 failures (15.2%)
- This catches the bad salinity (3.7 < 15.0) plus some edge cases

### Test 3: Profile Consistency
- If >80% of a profile's salinity values fall below 20.0 PSU → entire profile flagged as sensor failure
- **Result**: 3 profiles flagged (3,024 records, 12.0%)
- All three are float 2903434 cycles 083–085

### Test 4: Spike Detection
- Temperature spike threshold: 6.0°C (shallow), 2.0°C (deep ≥500m)
- Salinity spike threshold: 0.9 PSU
- **Result**: 9 individual measurements flagged (0.04%)

### Combined Result

| Metric | Value |
|--------|-------|
| Input records | 25,161 |
| Passed all QC tests | 21,320 (84.7%) |
| Failed QC | 3,841 (15.3%) |
| Removed locations | 3 (all from float 2903434) |

---

## 4. QC-Filtered Collocation Results

After QC filtering, re-running the collocation pipeline produces:

| Metric | Original | QC-Filtered |
|--------|----------|-------------|
| Input observations | 25,161 | 21,320 |
| Collocated records | 1,443 | 3,268 |
| Unique station locations | 24 | 34 |
| Bad salinity records | 188 (13%) | 0 (0%) |
| Salinity range | [3.73, 35.16] PSU | [30.89, 35.16] PSU |
| Temperature range | [6.30, 29.82] °C | [6.89, 29.75] °C |

The QC-filtered collocation produces **more** records because the re-run matches all valid observations against the model grid (the original 1,443 records came from a previous pipeline execution with different matching parameters/coverage).

---

## 5. ML Diagnostic (Existing Model, NOT Retrained)

The trained Isolation Forest (contamination=0.1, n_estimators=200) was applied to the QC-cleaned collocated data WITHOUT retraining.

### Full QC Dataset (3,268 records)

| Classification | Count | Rate |
|---------------|-------|------|
| HIGH | 128 | 3.9% |
| WARNING | 1,896 | 58.0% |
| NORMAL | 1,244 | 38.1% |
| IF predict=-1 | 2,024 | 61.9% |

### Why the Anomaly Rate Is High

The model was trained on 1,443 records that **included** the bad-salinity data. The bad records shaped the model's isolation boundaries. When those records are removed and 1,825 new (clean) records are added, many fall into regions the model considers anomalous because:

1. The model's feature space was partially defined by the extreme salinity values
2. New locations (10 additional stations) were never seen during training
3. The expanded depth/time coverage includes regimes the model hasn't learned

### Apples-to-Apples Comparison (Original 1,443 minus bad salinity)

For a fair comparison, removing only the 188 bad-salinity records from the original dataset:

| Metric | With Bad Data (1,443) | Without Bad Data (1,255) |
|--------|----------------------|--------------------------|
| IF anomalies (predict=-1) | 166 (11.5%) | 104 (8.3%) |
| HIGH | 57 | 83 |
| WARNING | 216 | 190 |
| NORMAL | 1,170 | 982 |
| Application anomaly rate | 18.9% | 21.8% |

The IF anomaly rate drops from 11.5% → 8.3% (below contamination=0.1), confirming the model was partially calibrated against the bad data. The application-level rate increases slightly because the normalization rescales without the extreme values.

---

## 6. Data Preserved

| File | Status | Purpose |
|------|--------|---------|
| `data/raw/argo/argo_profiles_bay_of_bengal.json` | UNCHANGED | Original raw Argo data |
| `data/processed/observations.parquet` | UNCHANGED | Original preprocessed observations |
| `data/processed/collocated.parquet` | UNCHANGED | Original collocated dataset |
| `data/processed/observations_qc.parquet` | NEW | QC-filtered observations |
| `data/processed/collocated_qc.parquet` | NEW | QC-filtered collocated data |
| `data/processed/argo_qc_log.json` | NEW | Full QC statistics and ML diagnostic |

No raw or previously processed data was modified or overwritten.

---

## 7. Application Integration

The backend services (`anomaly_service.py`, `ocean_service.py`) now prefer `collocated_qc.parquet` over `collocated.parquet` when available. This is a graceful fallback — if QC data doesn't exist, the application uses the original unfiltered data.

The frontend was NOT modified (per milestone requirements).

---

## 8. Recommendations (Not Implemented)

1. **Retrain the model on QC-clean data** — The current model's boundaries are biased by the bad-salinity records it was trained on. Retraining on the 3,268 clean records would produce more meaningful anomaly detection.

2. **Add real-time QC to the ingestion pipeline** — Apply the same QC tests in `preprocess.py` so future data is filtered before reaching the ML system.

3. **Request QC flags from ArgoVis** — The ArgoVis API supports `temperature_argoqc` and `salinity_argoqc` fields. Requesting them explicitly in the API call would provide Argo's own real-time QC assessments.

4. **Tighten `is_valid_salinity()`** — Change the validation bounds from [0, 45] to at least [2, 42] globally, or better, use region-specific bounds.

5. **Monitor float 2903434** — This float's conductivity sensor has clearly failed. Future cycles from this float should be automatically flagged until the sensor is replaced or recalibrated.

---

## 9. Summary

| Field | Value |
|-------|-------|
| **Root Cause** | Argo float 2903434 conductivity sensor failure (3 consecutive cycles) |
| **Records Removed** | 3,841 / 25,161 observations (15.3%) |
| **Bad Salinity Eliminated** | Yes — minimum salinity after QC is 30.89 PSU |
| **ML Model Retrained** | No (diagnostic only) |
| **Frontend Modified** | No |
| **Raw Data Modified** | No |
| **QC Pipeline** | `backend/scripts/argo_qc.py` — reproducible, idempotent |
| **Application Updated** | Yes — prefers QC data when available |
