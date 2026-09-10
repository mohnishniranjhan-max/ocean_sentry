# Milestone 7 — ML Pipeline Validation Report

**Generated:** 2026-08-25
**Pipeline status:** Prototype validated with real Argo observations + synthetic model data

> The current implementation validates the data ingestion, preprocessing, model-observation collocation, and anomaly-detection pipeline using real Argo observations and a synthetic ocean-model dataset. It does NOT represent production-ready anomaly detection or scientifically validated thresholds.

---

## 1. Dataset Summary

| Metric | Value |
|--------|-------|
| Total collocated records | 1,443 |
| Time range | 2026-08-16 14:03:28 to 2026-08-23 17:34:00 |
| Unique timestamps | 24 |
| Observation source | Real Argo float profiles (Bay of Bengal) |
| Model source | Synthetic CMEMS-like dataset (generated) |
| Variables | Temperature, salinity, currents (u/v) |
| Spatial coverage | Bay of Bengal region |

---

## 2. Collocation Quality

| Parameter | Threshold |
|-----------|-----------|
| Max spatial distance | 50.0 km |
| Max time difference | 12.0 hours |
| Max depth difference | 20.0 m |
| Collocation method | KD-tree spatial + nearest time group |

---

## 3. Baseline Model-vs-Observation Metrics

### Temperature (obs - model)

| Metric | Value |
|--------|-------|
| Count | 1,443 |
| MAE | 2.1080 °C |
| RMSE | 2.6796 °C |
| Mean Bias | -0.8111 °C |
| Median AE | 1.5691 °C |
| Std | 2.5539 °C |
| Min | -6.4614 °C |
| Max | 5.6135 °C |
| P5 | -5.0481 °C |
| P95 | 3.0346 °C |

### Salinity (obs - model)

| Metric | Value |
|--------|-------|
| Count | 1,443 |
| MAE | 4.3613 PSU |
| RMSE | 11.0829 PSU |
| Mean Bias | -3.7890 PSU |
| Median AE | 0.4184 PSU |
| Std | 10.4151 PSU |
| Min | -31.0362 PSU |
| Max | 1.2927 PSU |
| P5 | -30.8519 PSU |
| P95 | 0.7469 PSU |

**Note:** Large salinity errors (e.g., min = -31 PSU) are expected because the model data is synthetic and does not represent real Copernicus output.

---

## 4. ML Features (16 total)

| # | Feature | Description |
|---|---------|-------------|
| 1 | latitude | Observation latitude |
| 2 | longitude | Observation longitude |
| 3 | depth | Observation depth (m) |
| 4 | model_temperature | Model temperature at collocated point |
| 5 | observed_temperature | Argo observed temperature |
| 6 | temperature_difference | obs - model temperature |
| 7 | abs_temperature_difference | |obs - model| temperature |
| 8 | model_salinity | Model salinity at collocated point |
| 9 | observed_salinity | Argo observed salinity |
| 10 | salinity_difference | obs - model salinity |
| 11 | abs_salinity_difference | |obs - model| salinity |
| 12 | model_current_u | Model u-velocity |
| 13 | model_current_v | Model v-velocity |
| 14 | hour | Hour of observation |
| 15 | day_of_year | Day-of-year of observation |
| 16 | spatial_distance_km | Distance between obs and model grid point |

---

## 5. Isolation Forest Configuration

| Parameter | Value |
|-----------|-------|
| Algorithm | sklearn.ensemble.IsolationForest |
| n_estimators | 200 |
| contamination | 0.1 |
| max_samples | auto |
| random_state | 42 |
| n_jobs | -1 |
| Scaler | StandardScaler (fit on training only) |
| NaN fill | Training-set median (applied to both sets) |

---

## 6. Temporal Split

| Set | Records | Start | End |
|-----|---------|-------|-----|
| Training | 899 | 2026-08-16 14:03:28 | 2026-08-19 07:26:00 |
| Validation | 544 | 2026-08-20 01:54:20 | 2026-08-23 17:34:00 |

**Split method:** Timestamp-based cutoff. All records sharing the cutoff timestamp are placed entirely in training. The split guarantees:

```
max(training_timestamp) < min(validation_timestamp)
2026-08-19 07:26:00    < 2026-08-20 01:54:20  ✓
```

---

## 7. Temporal Leakage Check

**BEFORE (original implementation):**
- Split method: Row-index at 70% of sorted data
- Split index: 1010
- Timestamp at boundary: 2026-08-20 01:54:20
- Records with that timestamp in training: 111
- Records with that timestamp in validation: 26
- **LEAKAGE CONFIRMED:** Same timestamp appeared on both sides

**AFTER (corrected implementation):**
- Split method: Timestamp-based cutoff (all records at cutoff timestamp go to training)
- Cutoff timestamp: 2026-08-19 07:26:00
- Training max timestamp: 2026-08-19 07:26:00
- Validation min timestamp: 2026-08-20 01:54:20
- **Temporal gap: ~18.5 hours between sets**
- **VERIFIED: max(train_ts) < min(val_ts) ✓**

---

## 8. Feature Leakage Check

**Result: NO SIGNIFICANT FEATURE LEAKAGE**

| Feature | Source | Uses Future? | Target Derived? | Leakage? |
|---------|--------|:---:|:---:|:---:|
| latitude | Current obs coordinate | No | No | No |
| longitude | Current obs coordinate | No | No | No |
| depth | Current obs depth | No | No | No |
| model_temperature | Model at collocation | No | No | No |
| observed_temperature | Current obs | No | No | No |
| temperature_difference | Current obs - model | No | No | No |
| abs_temperature_difference | |current obs - model| | No | No | No |
| model_salinity | Model at collocation | No | No | No |
| observed_salinity | Current obs | No | No | No |
| salinity_difference | Current obs - model | No | No | No |
| abs_salinity_difference | |current obs - model| | No | No | No |
| model_current_u | Model velocity | No | No | No |
| model_current_v | Model velocity | No | No | No |
| hour | Obs timestamp hour | No | No | No |
| day_of_year | Obs timestamp DOY | No | No | No |
| spatial_distance_km | Collocation distance | No | No | No |

**Notes:**
- No rolling statistics or future-looking features are used
- No target leakage (Isolation Forest is unsupervised)
- NaN median-fill now uses training-set medians only (fixed)
- No pre-split global statistics contaminate the validation set

---

## 9. Synthetic Anomaly Detection Evaluation

**Method:** Inject 50 synthetic anomalies into the validation set by adding extreme temperature deviations (5-10 °C) and salinity deviations (5-15 PSU) to randomly selected records.

| Metric | Value |
|--------|-------|
| Synthetic anomalies injected | 50 |
| Injected anomalies detected | 46/50 (92.0%) |
| Non-injected records flagged (false alarm rate) | 71/494 (14.4%) |
| Mean anomaly score (injected) | -0.033920 |
| Mean anomaly score (non-injected) | 0.026006 |

**Interpretation:** The model successfully identifies synthetically injected extreme deviations at 92% recall. The ~14% false alarm rate on non-injected records reflects the model's contamination=0.1 setting plus distribution shift between training and validation periods.

**This is NOT real-world anomaly detection accuracy.** There is no ground-truth anomaly labeling for the dataset.

---

## 10. Current Limitations

1. **Synthetic model data:** The "model" side of comparisons is generated, not from real Copernicus/CMEMS. Baseline error statistics are not representative of real model performance.

2. **No validated anomaly ground truth:** Without labeled anomalies, we cannot compute precision/recall on real data. The synthetic anomaly test validates pipeline mechanics only.

3. **Limited temporal span:** 7 days of data (2026-08-16 to 2026-08-23) is insufficient for seasonal pattern learning.

4. **Small dataset:** 1,443 records total (899 train, 544 val) is minimal for robust Isolation Forest training.

5. **Fixed contamination parameter:** The 10% contamination setting is arbitrary and not tuned to real anomaly prevalence.

6. **No depth-stratified evaluation:** The model treats all depths uniformly; real ocean anomaly patterns vary significantly with depth.

7. **No cross-validation:** Single temporal split; no repeated evaluation.

---

## 11. Recommendations

1. **Integrate real Copernicus data:** Replace synthetic model data with actual CMEMS Global Ocean Physics Analysis/Forecast products to obtain meaningful baseline errors.

2. **Expand temporal coverage:** Acquire 6-12 months of data for seasonal learning and robust temporal cross-validation.

3. **Expert labeling:** Work with oceanographers to label known anomaly events (eddies, upwelling, instrument drift) for supervised evaluation.

4. **Tune contamination:** Use domain knowledge or unsupervised metrics (e.g., silhouette score on anomaly scores) to select appropriate contamination rate.

5. **Add depth stratification:** Train separate models or add depth-aware features for different ocean layers (surface, thermocline, deep).

6. **Feature expansion:** Consider adding rolling statistics, climatological deviations, and spatial neighborhood features once sufficient data is available.

7. **Model comparison:** Evaluate alternative unsupervised methods (Local Outlier Factor, DBSCAN, autoencoders) once more data is available.

---

## Summary

The pipeline — from Argo ingestion through collocation to Isolation Forest anomaly detection — is **functionally validated and ready for real Copernicus data integration**. The temporal leakage bug has been fixed, no feature leakage exists, and the model correctly detects synthetic extreme deviations at 92% recall. Production deployment requires replacing the synthetic model data with real CMEMS products and domain-expert validation of anomaly thresholds.
