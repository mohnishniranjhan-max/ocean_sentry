# Retrained Model Validation Report

**Date**: 2026-08-25  
**Milestone**: 11 — Retrain Isolation Forest on QC-Cleaned Data  
**Model**: `backend/ml/models/anomaly_model.joblib`  
**Training Data**: `backend/data/processed/collocated_qc.parquet`  
**Status**: Retraining complete. Model deployed. No frontend changes.

---

## 1. Dataset

| Field | Value |
|-------|-------|
| Source | `collocated_qc.parquet` |
| Records | 3,268 |
| Stations (unique lat/lon) | 34 |
| Time range | 2026-08-09 12:48:00 to 2026-08-20 05:33:12 |
| Depth range | 0.0 to 922.0 m |
| Temperature (observed) | 6.89 to 29.75 °C |
| Temperature (model) | 6.93 to 29.78 °C |
| Salinity (observed) | 30.89 to 35.16 PSU |
| Salinity (model) | 31.33 to 35.11 PSU |
| Current U/V coverage | 100% |
| Missing values (ML features) | 0 |

All 16 ML features are at 100% availability with no missing values.

---

## 2. QC Methodology Reference

QC was applied in Milestone 10 (`scripts/argo_qc.py`). Four tests:

1. **Global range** — GTSPP bounds: T ∈ [-2.5, 40.0]°C, S ∈ [2.0, 41.0] PSU
2. **Regional range** — Bay of Bengal: T ∈ [3.0, 33.0]°C, S ∈ [15.0, 36.5] PSU
3. **Profile consistency** — If >80% of a profile's salinity < 20 PSU → sensor failure
4. **Spike detection** — Adjacent-depth outliers exceeding thresholds

Result: 3,841 records removed (15.3%), primarily 3 profiles from WMO float 2903434 with failed conductivity sensor (salinity ≈ 3.7 PSU at all depths).

Full details: `backend/ml/evaluation/ARGO_QC_REPORT.md`

---

## 3. Training/Validation Split

| Metric | Value |
|--------|-------|
| Split method | Temporal (NOT random) |
| Training start | 2026-08-09 12:48:00 |
| Training end | 2026-08-18 14:13:55 |
| Validation start | 2026-08-18 14:14:29 |
| Validation end | 2026-08-20 05:33:12 |
| Training records | 2,277 (69.7%) |
| Validation records | 991 (30.3%) |
| Temporal gap | 33 seconds (no overlap) |

**Guarantee**: max(training_timestamp) < min(validation_timestamp) — VERIFIED.

---

## 4. Features

All 16 features from the original model architecture, unchanged:

| # | Feature | Description |
|---|---------|-------------|
| 1 | latitude | Observation latitude |
| 2 | longitude | Observation longitude |
| 3 | depth | Observation depth (m) |
| 4 | model_temperature | Copernicus model temperature (°C) |
| 5 | observed_temperature | Argo observed temperature (°C) |
| 6 | temperature_difference | obs - model temperature (°C) |
| 7 | abs_temperature_difference | |obs - model| temperature (°C) |
| 8 | model_salinity | Copernicus model salinity (PSU) |
| 9 | observed_salinity | Argo observed salinity (PSU) |
| 10 | salinity_difference | obs - model salinity (PSU) |
| 11 | abs_salinity_difference | |obs - model| salinity (PSU) |
| 12 | model_current_u | Copernicus model eastward current (m/s) |
| 13 | model_current_v | Copernicus model northward current (m/s) |
| 14 | hour | Hour of observation (0-23) |
| 15 | day_of_year | Day of year (1-366) |
| 16 | spatial_distance_km | Distance between obs and nearest model grid point (km) |

No features added. No features removed. Feature order stored in model artifact.

---

## 5. Model Configuration

| Parameter | Value |
|-----------|-------|
| Algorithm | sklearn.ensemble.IsolationForest |
| n_estimators | 200 |
| contamination | 0.1 |
| max_samples | auto |
| random_state | 42 |
| n_jobs | -1 |
| Scaler | StandardScaler (fitted on training data only) |
| NaN imputation | Training-set medians (none required — all features 100% populated) |

Contamination kept at 0.1 (unchanged from previous model). No justification found to change it.

---

## 6. Leakage Checks

| Check | Result | Evidence |
|-------|--------|----------|
| Temporal leakage | **PASS** | max(train_ts) = 2026-08-18 14:13:55 < min(val_ts) = 2026-08-18 14:14:29 |
| Feature leakage | **PASS** | No future-looking features; all computed from concurrent obs/model data |
| Preprocessing leakage | **PASS** | StandardScaler.fit() called on X_train only; val transformed with train statistics |
| Target-derived feature leakage | **PASS** | Unsupervised model — no target labels exist to leak |

---

## 7. Validation Results

### Raw Isolation Forest Output

| Metric | Training Set | Validation Set |
|--------|-------------|----------------|
| Records | 2,277 | 991 |
| IF anomaly count (predict=-1) | 228 | 266 |
| IF anomaly rate | 10.0% | 26.8% |
| decision_function min | -0.1297 | -0.1006 |
| decision_function max | 0.1467 | 0.1028 |
| decision_function mean | 0.0713 | 0.0320 |
| decision_function std | — | 0.0445 |

### Application-Level Classification (Validation Set)

| Classification | Count | Rate |
|---------------|-------|------|
| HIGH (predict=-1 AND normalized ≥ 0.80) | 34 | 3.4% |
| WARNING (predict=-1 OR normalized ≥ 0.65) | 232 | 23.4% |
| NORMAL | 725 | 73.2% |
| **Total flagged** | **266** | **26.8%** |

### Normalized Score Distribution (Validation)

| Statistic | Value |
|-----------|-------|
| Mean | 0.3483 |
| Std | 0.2187 |
| Min | 0.0000 |
| Max | 1.0000 |

### Feature Analysis — What the Model Flags

| Feature | Anomalous (mean) | Normal (mean) | Ratio |
|---------|------------------|---------------|-------|
| abs_temperature_difference | 0.935°C | 0.374°C | 2.5× |
| abs_salinity_difference | 0.264 PSU | 0.034 PSU | 7.8× |
| depth | 54.0 m | 343.8 m | 0.16× |

The retrained model identifies records with larger model-observation discrepancies in both temperature and salinity. Notably, anomalies cluster at **shallower depths** (54m vs 344m) — the upper ocean where dynamics are more variable and model-observation mismatches more common.

### Why Validation Anomaly Rate (26.8%) > Training Rate (10%)

The validation period (Aug 18-20) represents a different oceanographic regime than the training period (Aug 9-18). Possible physical explanations:
- Late-monsoon intensification changing upper-ocean dynamics
- Short-term weather events (cyclonic activity, rainfall-driven freshening)
- Different station coverage in the two time periods

This is NOT an error — it indicates the model learned training-period patterns and the validation period genuinely contains more statistically unusual observations. Without independent ground truth, we cannot determine whether these represent real ocean events or model forecast degradation.

---

## 8. Before vs After QC Comparison

| Metric | BEFORE QC (old model) | AFTER QC (retrained) |
|--------|----------------------|---------------------|
| Collocated records | 1,443 | 3,268 |
| Training records | 1,443 (no split) | 2,277 |
| Validation records | N/A (none) | 991 |
| IF anomaly rate (training) | ~11.5% | 10.0% |
| IF anomaly rate (validation) | N/A | 26.8% |
| HIGH count | 57 | 33 |
| WARNING count | 216 | 461 |
| NORMAL count | 1,170 | 2,774 |
| Salinity range (observed) | [3.73, 35.16] PSU | [30.89, 35.16] PSU |
| Temperature range (observed) | [6.30, 29.82] °C | [6.89, 29.75] °C |
| Bad sensor data included | 188 records (13%) | 0 records (0%) |
| Temporal split | None | 70/30 temporal |
| Preprocessing leakage | Not verified | PASS |
| WMO 2903434 influence | Shaped model boundaries | Excluded entirely |

### Key Differences

1. **Data quality**: The old model was trained on data containing 188 records with physically impossible salinity (3.7 PSU). These records warped the model's learned boundaries. The new model learns only from oceanographically plausible data.

2. **Proper methodology**: The old model was trained on all available data with no validation split and no leakage checks. The new model uses a temporal train/validation split with verified absence of all four leakage types.

3. **Signal clarity**: The old model's anomaly detection was dominated by the bad-salinity signal (32.6% of all flagged anomalies came from sensor failure). The new model identifies statistically unusual model-observation patterns without that contamination.

---

## 9. WMO 2903434 Impact

| Metric | Value |
|--------|-------|
| Float WMO ID | 2903434 |
| Affected cycles | 083, 084, 085 |
| Failure type | Conductivity sensor failure |
| Salinity reported | 3.69–3.81 PSU (all depths) |
| Expected salinity | 30–35 PSU |

### Before QC

| Metric | Value |
|--------|-------|
| Records in training data | 188 (collocated) / 3,024 (raw observations) |
| Fraction of anomalies caused | 32.6% of all flagged records |
| Effect on model | Extreme salinity values created artificial isolation boundaries |

### After QC

| Metric | Value |
|--------|-------|
| Records in training data | **0** |
| Records in validation data | **0** |
| Influence on retrained model | **None** |

The failed conductivity sensor no longer influences any aspect of the ML system.

---

## 10. Limitations

1. **No independent ground truth** — The model identifies statistically unusual patterns. Without labeled ocean events (upwelling, eddies, fronts), we cannot measure true detection performance.

2. **Short temporal coverage** — 11 days of data (Aug 9-20). No seasonal cycle representation. The model cannot distinguish seasonal variability from anomalous behavior.

3. **Contamination is a hyperparameter choice** — Setting contamination=0.1 guarantees ~10% of training data is labeled anomalous, regardless of whether genuine anomalies exist at that rate.

4. **Training-inference overlap** — The model scores the same collocated_qc.parquet it was trained on during runtime. The training subset will show ~10% anomaly rate by construction; only the validation subset provides meaningful assessment.

5. **Validation period behavior** — The 26.8% anomaly rate in validation suggests the validation period has different dynamics than training. This could be genuine (different ocean state) or an artifact of the temporal split (different stations observed in different periods).

6. **No uncertainty quantification** — Isolation Forest provides scores but no confidence intervals or posterior probabilities.

---

## 11. Recommended Next Steps

1. **Extend temporal coverage** — Acquire more Argo/Copernicus data covering multiple weeks/months to improve seasonal representation and reduce sensitivity to short-term weather.

2. **Cross-validate anomaly rate stability** — Use rolling-window temporal splits to assess whether the model's anomaly rate is stable across different time windows.

3. **Expert labeling** — Have an oceanographer review the top-scoring anomalies and label them as (a) real ocean event, (b) model forecast error, (c) residual data quality issue, or (d) collocation artifact.

4. **Evaluate contamination sensitivity** — Test contamination values of 0.05 and 0.15 to assess how the anomaly rate and feature importance change.

5. **Monitor WMO 2903434** — If this float continues reporting, its new cycles should be automatically QC-filtered until the sensor is confirmed repaired.

---

## 12. Runtime Verification

| Check | Result |
|-------|--------|
| `ml_service.load_model()` | PASS — model loads without error |
| Feature names match | PASS — 16 features in correct order |
| `model.decision_function()` | PASS — returns valid float scores |
| `model.predict()` | PASS — returns {-1, 1} labels |
| `scaler.transform()` | PASS — scales input vectors correctly |
| `/api/ml/predict` endpoint | PASS — returns anomaly_score, status, confidence |
| `/api/ocean/anomalies/summary` | PASS — returns 3,268 records, 494 anomalies (15.1%) |
| Backend startup | PASS — loads QC data, scores all records, applies ML status |

### Application-Level Scoring (Full Dataset at Runtime)

When the backend starts and scores all 3,268 records (both training and validation):

| Classification | Count | Rate |
|---------------|-------|------|
| HIGH | 33 | 1.0% |
| WARNING | 461 | 14.1% |
| NORMAL | 2,774 | 84.9% |
| **Total anomalies** | **494** | **15.1%** |

---

## Summary

| Field | Value |
|-------|-------|
| **Model** | IsolationForest (n_estimators=200, contamination=0.1) |
| **Training data** | 2,277 QC-cleaned collocated records (Aug 9-18) |
| **Validation data** | 991 QC-cleaned collocated records (Aug 18-20) |
| **WMO 2903434** | Fully excluded (0 records) |
| **All leakage checks** | PASS |
| **Validation IF rate** | 26.8% |
| **Runtime total anomaly rate** | 15.1% (494 / 3,268) |
| **Key finding** | Model now responds to real model-observation discrepancies (temp 2.5×, salinity 7.8× higher in anomalous vs normal) rather than sensor failures |
| **Scientific status** | ML-detected anomalies represent statistically unusual model-observation patterns requiring further investigation |
