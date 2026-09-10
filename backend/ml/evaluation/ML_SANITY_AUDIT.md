# ML Sanity / Validation Audit

**Date**: 2026-08-25  
**Model**: backend/ml/models/anomaly_model.joblib  
**Data**: backend/data/processed/collocated.parquet  
**Records**: 1,443  
**Status**: Read-only audit — no code or model modifications

---

## 1. Raw Isolation Forest Output

| Metric | Value |
|--------|-------|
| Total records | 1,443 |
| Predicted -1 (anomaly) | 166 |
| Predicted +1 (normal) | 1,277 |
| Raw IF anomaly rate | 11.50% |

### Decision function distribution

| Statistic | Value |
|-----------|-------|
| Min | -0.044507 |
| Max | 0.103191 |
| Mean | 0.039440 |
| Median | 0.038090 |
| Std | 0.032786 |
| P5 | -0.011427 |
| P10 | -0.001464 |
| P25 | 0.013964 |
| P75 | 0.065902 |
| P90 | 0.086696 |
| P95 | 0.093551 |

### Application-level classification vs raw IF

| Classification | Count | Percentage |
|---------------|-------|------------|
| HIGH | 57 | 4.0% |
| WARNING | 216 | 15.0% |
| NORMAL | 1,170 | 81.1% |
| **Total anomaly-classified** | **273** | **18.9%** |

### How classifications differ

The raw Isolation Forest flags 166 records (11.5%) using its internal decision boundary (decision_function < 0).

The application adds 107 additional WARNING records. These have decision_function > 0 (the IF considers them normal) but their range-normalized score exceeds 0.65.

**WARNING source breakdown:**
- From IF predict=-1 with score < 0.80: 109 records
- From IF predict=+1 but normalized >= 0.65: 107 records

The 0.65 threshold translates to decision_function = 0.007187. Records in [0.0000, 0.0072] are reclassified from "IF-normal" to "app-WARNING". This threshold has no oceanographic basis.

---

## 2. Anomaly Score Distribution

### Normalized score statistics

| Statistic | Value |
|-----------|-------|
| Min | 0.000000 |
| Max | 1.000000 |
| Mean | 0.431629 |
| Median | 0.440770 |
| P75 | 0.604120 |
| P90 | 0.708578 |
| P95 | 0.776034 |
| P99 | 0.879890 |

### Score bucket distribution

| Bucket | Count | Percentage |
|--------|-------|------------|
| 0.0–0.2 | 259 | 17.9% |
| 0.2–0.4 | 380 | 26.3% |
| 0.4–0.6 | 434 | 30.1% |
| 0.6–0.8 | 313 | 21.7% |
| 0.8–1.0 | 57 | 4.0% |

The distribution is relatively uniform across [0, 0.8] with a small tail at 0.8–1.0. This is expected because the normalization maps the full decision_function range to [0, 1].

Key mapping: decision_function = 0 (the IF boundary) maps to normalized = 0.6987. The WARNING threshold at 0.65 therefore captures records that are slightly BELOW the IF's own boundary.

---

## 3. Why 18.9% Are Classified as Anomalous

### Root causes (ordered by contribution):

#### A. Contamination parameter (PRIMARY)
- `contamination = 0.1` guarantees approximately 10% of training data is treated as anomalous
- Actual IF predict=-1 rate: 11.5% (close to expected)
- This is a HYPERPARAMETER CHOICE, not a data-driven detection

#### B. WARNING threshold inflation
- Raw IF: 166 anomalies (11.5%)
- Application: 273 anomalies (18.9%)
- 107 additional records from normalized >= 0.65 rule
- These records have decision_function in [0.0000, 0.0072] — barely positive
- **This is a threshold effect, not a model detection**

#### C. Depth distribution
Anomalies are disproportionately concentrated at greater depths and shallow surface:

| Depth range | Anomalous (%) | Normal (%) |
|-------------|---------------|------------|
| < 10m | 4.8% | 14.1% |
| 10–100m | 40.7% | 25.5% |
| 100–500m | 14.3% | 47.6% |
| >= 500m | 40.3% | 12.8% |

Anomalies cluster at 10–100m and >= 500m; normals concentrate at 100–500m.

#### D. Temporal distribution
Anomalies are NOT uniformly distributed across the 8-day window:

| Date | Anomalies/Total | Rate |
|------|----------------|------|
| 2026-08-16 | 4/37 | 11% |
| 2026-08-17 | 7/263 | 3% |
| 2026-08-18 | 14/268 | 5% |
| 2026-08-19 | 97/331 | 29% |
| 2026-08-20 | 127/377 | 34% |
| 2026-08-21 | 7/51 | 14% |
| 2026-08-22 | 2/37 | 5% |
| 2026-08-23 | 15/79 | 19% |

Aug 19-20 account for 82% of all anomalies. This coincides with the bad-salinity station (ARGO-018) observations.

#### E. Spatial distribution
19 of 24 locations have at least one anomaly. Top concentration:
- (13.136, 86.953): 89/188 records anomalous — **this is the bad salinity station**
- (5.414, 88.636): 77/191 records anomalous
- (6.515, 84.673): 44/137 records anomalous

#### F. Bad data contribution
188 records (13% of dataset) have observed_salinity = 3.7 PSU — physically impossible for open ocean. These contribute 32.6% of all flagged anomalies.

---

## 4. Feature Characterization (Anomalous vs Normal)

| Feature | Normal Mean | Normal Median | Anomaly Mean | Anomaly Median | Diff% |
|---------|-------------|---------------|--------------|----------------|-------|
| latitude | 10.632 | 11.083 | 9.285 | 7.717 | 12.7% |
| longitude | 86.317 | 86.694 | 86.728 | 86.953 | 0.5% |
| depth | 208.255 | 141.730 | 431.333 | 133.960 | 107.1% |
| model_temperature | 20.499 | 20.878 | 17.048 | 20.884 | 16.8% |
| observed_temperature | 19.283 | 18.160 | 17.969 | 16.877 | 6.8% |
| temperature_difference | -1.215 | -0.857 | 0.921 | 0.673 | 175.8% |
| abs_temperature_difference | 2.153 | 1.756 | 1.914 | 0.962 | 11.1% |
| model_salinity | 34.287 | 34.467 | 34.376 | 34.503 | 0.3% |
| observed_salinity | 31.918 | 34.789 | 24.501 | 34.412 | 23.2% |
| salinity_difference | -2.369 | 0.299 | -9.875 | 0.012 | 316.9% |
| abs_salinity_difference | 2.996 | 0.408 | 10.215 | 0.612 | 241.0% |
| model_current_u | 0.014 | 0.009 | -0.013 | -0.011 | 192.0% |
| model_current_v | 0.059 | 0.055 | 0.058 | 0.061 | 2.1% |
| hour | 11.962 | 14.000 | 4.971 | 5.000 | 58.4% |
| day_of_year | 230.858 | 231.000 | 231.612 | 232.000 | 0.3% |
| spatial_distance_km | 19.408 | 18.902 | 18.189 | 17.791 | 6.3% |

### Largest distribution differences (by mean):
1. **salinity_difference**: 316.9% — driven by bad salinity data at ARGO-018
2. **abs_salinity_difference**: 241.0% — same cause
3. **model_current_u**: 192.0% — direction reversal in anomalous records
4. **temperature_difference**: 175.8% — sign flip (anomalies are warmer than model)
5. **depth**: 107.1% — anomalies at deeper depths on average
6. **hour**: 58.4% — anomalies clustered at hour=0-5 (early morning)

### Critical observation:
`abs_temperature_difference` is actually **LOWER** in anomalous records (1.91°C) than in normal records (2.15°C). The model is NOT simply flagging large temperature errors. It responds to the multivariate combination, primarily salinity anomalies and unusual depth/hour patterns.

---

## 5. Example Anomaly — ARGO-018

### Record details
| Field | Value |
|-------|-------|
| timestamp | 2026-08-19 00:40:23 |
| latitude | 13.1358 |
| longitude | 86.9526 |
| depth | 1.08 m |
| model_temperature | 29.853°C |
| observed_temperature | 29.598°C |
| temperature_difference | -0.255°C |
| model_salinity | 33.605 PSU |
| **observed_salinity** | **3.731 PSU** |
| **salinity_difference** | **-29.874 PSU** |
| model_current_u | 0.1467 |
| model_current_v | 0.1296 |
| hour | 0 |
| day_of_year | 231 |
| spatial_distance_km | 15.95 |
| **raw decision_function** | **-0.044507** (most negative in dataset) |
| **normalized score** | **1.000000** |
| **IF prediction** | **-1** |

### Why the IF flags this record

The observed_salinity of 3.731 PSU is physically impossible for open Bay of Bengal water (typical: 32-35 PSU). This creates a salinity_difference of -29.87 PSU — a 30 PSU deviation from the model.

The record's feature vector is extreme in the multivariate space:
- `observed_salinity` is 7.5 standard deviations below the scaler mean
- `salinity_difference` is 2.4 standard deviations below the scaler mean
- `abs_salinity_difference` is 1.9 standard deviations above the scaler mean
- `hour = 0` is 1.6 standard deviations below the scaler mean

### Comparison with nearby normal records (lat 12-14, lon 85-88, depth < 20m):

| Feature | ARGO-018 (anomaly) | Nearby normals (avg) |
|---------|-------------------|---------------------|
| observed_salinity | 3.731 | 33.651 |
| salinity_difference | -29.874 | 0.160 |
| hour | 0 | 14.0 |
| spatial_distance_km | 15.95 | 4.12 |

### Conclusion
This is a **sensor error** (or Argo QC flag failure), not an ocean anomaly. Real ocean salinity in the Bay of Bengal never drops to 3.7 PSU. The Isolation Forest correctly identifies it as a statistical outlier, but the underlying cause is data quality, not oceanography.

The ENTIRE profile at this location (all 188 depth levels) has observed_salinity in [3.73, 3.81] PSU, indicating a systematic sensor failure during this float cycle.

---

## 6. Synthetic Validation vs Real Data

### Previous result: 92% detection rate, 14.4% false alarm rate

### What this proves:
1. The model CAN separate injected synthetic outliers from inlier data
2. The tree structure creates meaningful isolation boundaries
3. The model is technically functional as an anomaly detector

### What this does NOT prove:
1. Real-world flags do NOT necessarily correspond to actual ocean events
2. The model's anomalies are NOT validated as oceanographically meaningful
3. Thresholds are NOT calibrated against known phenomena
4. The model does NOT distinguish between:
   - Real ocean anomalies (upwelling, eddies, storm effects)
   - Data quality issues (sensor errors, QC failures)
   - Collocation artifacts (spatial/temporal mismatch)
   - Model deficiencies (Copernicus forecast errors)

### Critical limitation:
Synthetic anomalies were generated by ADDING noise to existing data. Real ocean anomalies have fundamentally different statistical signatures (they are physically constrained). A model that detects additive noise does not necessarily detect thermocline erosion, freshwater intrusions, or mesoscale eddies.

Synthetic validation confirms the model **works as a statistical tool**. It does NOT confirm the model produces **scientifically meaningful results**.

---

## 7. Data Quality Check

### A. Missing values
- `observed_current_u`: 1,443/1,443 (100%) missing — not used in features
- `observed_current_v`: 1,443/1,443 (100%) missing — not used in features
- All 16 ML features: 0% missing

### B. Duplicated observations
- Fully duplicated rows: 0
- Duplicated (observation_id + depth): 0

### C. Timestamps
- Duplicated (timestamp + lat + lon + depth): 0
- Unique timestamps: 24

### D. Spatial coverage
- Unique locations: 24
- Spatial duplicates: 0

### E. Temperature values
- Observed range: [6.30, 29.82]°C — **realistic**
- Model range: [5.59, 29.85]°C — **realistic**
- Unrealistic values: 0

### F. Salinity values — CRITICAL ISSUE
- Observed range: [3.73, 35.16] PSU
- Model range: [32.78, 34.92] PSU
- **Records with observed_salinity < 20 PSU: 188 (13%)**
- **Records with observed_salinity < 5 PSU: 188 (13%)**
- All 188 from single location: (13.136, 86.953) — ARGO-018
- Salinity at this location: 3.73–3.81 PSU (impossible for open ocean)

### G. Depth values
- Range: [0.0, 1020.0] m — **realistic**
- Negative depth: 0
- Depth > 2000m: 0

### H. Extreme model-observation differences
- |temperature_diff| > 5°C: 88 records
- |temperature_diff| > 10°C: 0
- |salinity_diff| > 5 PSU: 188 records (all from ARGO-018)
- |salinity_diff| > 20 PSU: 188 records (all from ARGO-018)

### I. Temporal mismatch
- time_difference_hours range: [0.25, 9.94] hours
- Mean: 3.27 hours
- Records with |time_diff| > 6h: 37
- Records with |time_diff| > 12h: 0

### J. Spatial mismatch
- spatial_distance_km range: [4.12, 33.92] km
- Mean: 19.18 km
- Records with distance > 30km: 135
- Records with distance > 50km: 0

### K. Bad salinity → anomaly correlation
- Records with obs_salinity < 20: 188
- Of those flagged as anomaly by IF: 62 (33.0%)
- Compare overall IF anomaly rate: 11.5%
- **Bad salinity records are 3x more likely to be flagged**

### Impact quantification
- Anomalies from bad-salinity station: 89 (32.6% of all anomalies)
- Anomalies from clean-data stations: 184 (67.4%)
- If bad-salinity station excluded: anomaly rate drops from 18.9% to 14.7%

---

## 8. Final Judgement

### Classification: B. PROTOTYPE-READY BUT REQUIRES VALIDATION

### Evidence:

**The system IS technically functional:**
- Model loads correctly at startup
- All 1,443 records scored using exact training features and scaler
- Results correctly propagate from backend to frontend
- API endpoints return real ML results
- 3D globe reflects ML-derived station statuses

**The system IS detecting real statistical outliers:**
- Bad salinity data at ARGO-018 correctly identified as anomalous
- Records with large multivariate deviations score higher
- The model responds to feature combinations, not just single thresholds

**The system is NOT scientifically validated because:**

1. **Data quality issues contaminate results** — 188 records (13%) have impossible salinity values; these account for 32.6% of flagged anomalies. The #1 highest-scoring anomaly is a sensor error.

2. **Threshold inflation without basis** — The normalized >= 0.65 WARNING rule reclassifies 107 IF-normal records as anomalous with no oceanographic justification.

3. **No ground truth** — No known ocean events to validate against, no expert labels, cannot separate model error from data error from real anomaly.

4. **Training-inference circularity** — Model trained on the SAME collocated dataset it now scores. With contamination=0.1, approximately 10% will ALWAYS be flagged regardless of whether genuine anomalies exist.

5. **Insufficient temporal coverage** — Only 8 days of data; no seasonal baseline; cannot distinguish transient events from normal variability.

**Appropriate for:**
- Technology demonstration / hackathon presentation
- Data quality screening (sensor error detection)
- Proof-of-concept that ML pipeline is wired end-to-end

**NOT appropriate for:**
- Operational ocean monitoring
- Scientific publication without expert review
- Automated alert generation without human verification

---

## Summary

| Field | Value |
|-------|-------|
| **ML STATUS** | Prototype-ready, requires validation |
| **ANOMALY RATE** | 18.9% (application-level, WARNING + HIGH) |
| **RAW IF ANOMALY RATE** | 11.5% (model.predict() == -1) |
| **APPLICATION ANOMALY RATE** | 18.9% (with WARNING threshold inflation) |
| **MAIN OBSERVED ISSUE** | 32.6% of flagged anomalies caused by bad salinity data (sensor error at ARGO-018, observed_salinity = 3.7 PSU) |
| **SCIENTIFIC LIMITATION** | No ground truth, no QC filtering, contamination=0.1 guarantees ~10% flags, trained on same data as inference |
| **RECOMMENDED NEXT STEP** | Apply Argo QC flags (observation_quality field) to exclude bad data before ML inference; validate remaining anomalies against known oceanographic events or expert labels |
