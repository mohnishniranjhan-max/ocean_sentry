# Milestone 12 — End-to-End Validation Report

**Date:** 2026-08-25  
**System:** Ocean Sentry — Ocean Intelligence Platform  
**Classification:** DEMO-READY WITH KNOWN LIMITATIONS

---

## 1. Data Pipeline Validation

| Stage | Records | Notes |
|-------|---------|-------|
| Raw Argo observations | 25,161 | All Bay of Bengal region |
| After QC (global range) | 25,161 | No failures at global level |
| After QC (regional range) | 21,329 | 3,832 failed (Indian Ocean bounds) |
| After QC (profile consistency) | 22,137 | 3,024 failed (salinity inversion) |
| After QC (spike test) | 25,152 | 9 failed |
| Total QC-passed | 21,320 | 84.73% pass rate |
| QC-failed removed | 3,841 | 15.27% removal rate |
| Collocated (pre-QC) | 1,443 | Original model-observation pairs |
| Collocated (post-QC rerun) | 3,268 | Full re-collocation on QC-clean data |
| ML-scored records | 3,268 | 100% of QC-clean collocated data |

**WMO 2903434 exclusion:** Confirmed. Zero records from this float's failed conductivity sensor appear in the ML training or scoring data.

**Data source:** Copernicus Marine (model) + Argo (observations)

---

## 2. QC Validation

- Global range test: temperature [-2.5, 40.0]°C, salinity [2.0, 41.0] PSU
- Regional range test: temperature [3.0, 33.0]°C, salinity [15.0, 36.5] PSU
- Profile consistency: 80% of profile must pass salinity threshold (20 PSU span)
- Spike test: shallow threshold 6.0°C, deep threshold 2.0°C, salinity 0.9 PSU

QC removes bad-salinity profiles (e.g., WMO 2903434) and retains scientifically defensible observations.

---

## 3. ML Model Validation

| Property | Value |
|----------|-------|
| Algorithm | Isolation Forest (sklearn) |
| Contamination | 0.1 |
| Features | 16 (spatial, temporal, observational, model, difference) |
| Training records | 2,277 (temporal first 69.7%) |
| Validation records | 991 (temporal last 30.3%) |
| Temporal split | No leakage (train ends 2026-08-18T14:13:55, val starts 2026-08-18T14:14:29) |
| Scaler | StandardScaler (fitted on training data only) |
| Feature ordering | Verified identical between training and inference |
| QC applied | Yes (trained on collocated_qc.parquet) |

**Note:** Anomaly scores are NOT calibrated probabilities. They represent relative deviation from the model's learned normal behavior distribution.

---

## 4. Runtime Inference Validation

| Metric | Value |
|--------|-------|
| Records scored at startup | 3,268 |
| Source file | collocated_qc.parquet |
| HIGH | 33 (1.0%) |
| WARNING | 461 (14.1%) |
| NORMAL | 2,774 (84.9%) |
| Total anomalies | 494 (15.1%) |
| Score range | [0.0, 1.0] |
| Score mean | 0.3157 |
| Score median | 0.2798 |
| Synthetic data | None |
| Mock data in scoring | None |

Confirmed: Runtime uses the retrained model on QC-cleaned data. No fallback to old artifacts or synthetic data.

---

## 5. API Contract Validation

| Endpoint | Status | Schema Valid |
|----------|--------|-------------|
| GET /api/health | 200 | ✓ |
| GET /api/stations/frontend | 200 | ✓ (34 stations, 23 fields each) |
| GET /api/ocean/comparison | 200 | ✓ |
| GET /api/ocean/anomalies | 200 | ✓ (12 fields per anomaly) |
| GET /api/ocean/anomalies/summary | 200 | ✓ |
| GET /api/ocean/observations | 200 | ✓ |
| POST /api/ml/predict | 200 | ✓ |
| Invalid depth_min (abc) | 422 | ✓ (validation error) |
| Overlimit (9999) | 422 | ✓ (limit exceeded) |

---

## 6. Depth Validation

| Depth | Window | Observations | Anomalies | Status |
|-------|--------|-------------|-----------|--------|
| Surface | All | 300+ | Global 494 | ✓ |
| 10m | -10 to 30m | 300 (capped) | 217 | ✓ |
| 50m | 30 to 70m | 290 | 105 | ✓ |
| 100m | 80 to 120m | 289 | 86 | ✓ |
| 250m | 230 to 270m | 221 | 2 | ✓ |
| 500m | 480 to 520m | 0 | 0 | ✓ Shows "NO DATA" |
| 1000m | 980 to 1020m | 0 | 0 | ✓ Shows "NO DATA" |

Depth filtering is consistent with the ±20m backend rule. Empty depths correctly show "NO DATA WITHIN ±20M".

---

## 7. Frontend Integration Validation

| Component | Data Source | Status |
|-----------|-------------|--------|
| Station markers | /api/stations/frontend | ✓ Real Argo coordinates |
| Station status | ML anomaly_service | ✓ Real ML status |
| Observation markers (subsurface) | /api/ocean/observations?depth=X | ✓ Real depth-filtered |
| Anomaly markers (subsurface) | /api/ocean/anomalies?depth_min/max | ✓ Real ML-scored |
| Anomaly count (SubsurfaceHUD) | depthAnomalies.length | ✓ Real per-depth |
| Intelligence Summary | /api/ocean/anomalies/summary | ✓ Real ML totals |
| Anomaly Detail Panel | Selected AnomalyRecord | ✓ All 12 fields from API |
| Navigation bottom bar | anomalySummary (total_records, high_count) | ✓ Real |
| Data source label | dataSource state | ✓ "COPERNICUS MARINE + ARGO · ML ONLINE" |
| Offline fallback | Mock stations | ✓ Clearly labeled "OFFLINE DEMO DATA" |

---

## 8. Geographic Validation

- All 34 stations within Bay of Bengal (5.41°N–18.08°N, 80.83°E–92.17°E)
- 20 stations near Indian coast
- 7 stations near Sri Lanka
- 5 stations near Andaman/Nicobar
- Coordinate conversion (latLonToXYZ) uses standard spherical mapping
- No alignment issues detected

---

## 9. Performance Validation

| Check | Result |
|-------|--------|
| API calls per frame | 0 (only on user action) |
| Depth cache | ✓ Prevents redundant fetches |
| Texture loading | ✓ Via Suspense/useMemo (once) |
| ML inference frequency | Once at startup |
| Scene recreation on depth change | No (prop updates only) |
| Particle count | Fixed 300 (SubsurfaceEnvironment) |

---

## 10. Demo Flow Validation

The complete demo sequence was tested:

1. ✓ Cinematic Earth introduction
2. ✓ Globe rotation (OrbitControls)
3. ✓ Bay of Bengal navigation
4. ✓ Real station markers (34 Argo stations)
5. ✓ ML anomaly visualization
6. ✓ Intelligence Summary panel (real HIGH/WARNING/NORMAL)
7. ✓ Dive to subsurface mode
8. ✓ 10m: 217 anomalies displayed
9. ✓ 50m: 105 anomalies displayed
10. ✓ 100m: 86 anomalies displayed
11. ✓ 500m/1000m: "NO DATA WITHIN ±20M"
12. ✓ Anomaly click → Detail panel with real data
13. ✓ Camera focus on selected anomaly
14. ✓ Return to surface (clean state reset)
15. ✓ Surface controls restored

---

## 11. Known Limitations

1. **Dataset coverage is limited.** Only Bay of Bengal region, single time window (Aug 2026).
2. **Data depth range:** 0–922m. No observations above 500m in the ±20m window at 500m or 1000m depth selections.
3. **Not real-time.** Data represents a snapshot from Copernicus Marine + Argo at a specific time.
4. **Isolation Forest anomaly scores are not calibrated probabilities.** They indicate relative deviation from learned normal patterns.
5. **An ML anomaly does not automatically represent a confirmed ocean event.** It may reflect: unusual ocean conditions, model-observation mismatch, observation uncertainty, or remaining data quality issues.
6. **Model was trained on limited data (2,277 records).** Generalization to other regions/times is unvalidated.
7. **Single contamination parameter (0.1).** No hyperparameter search was conducted.
8. **Wave height and sea level data are mostly zero** — Copernicus model data available does not cover all parameters uniformly.
9. **Station depth reported as shallowest observation** — not the full profile depth range.
10. **No pagination for anomaly lists** — all records up to limit=500 returned per depth.

---

## 12. Recommended Future Improvements

1. Expand geographic coverage beyond Bay of Bengal
2. Add temporal updates (periodic re-fetch from Copernicus + Argo)
3. Add ensemble anomaly detection (complement Isolation Forest with LOF or autoencoder)
4. Add ground truth validation against known oceanographic events
5. Calibrate anomaly scores using isotonic regression or Platt scaling
6. Add profile-level anomaly aggregation (not just per-depth-record)
7. Implement WebSocket for streaming updates
8. Add user annotation capability for domain expert feedback
9. Optimize Three.js rendering with instanced meshes for large marker counts
10. Add multi-parameter anomaly investigation (temperature + salinity + currents)

---

## Final Classification

### 🟡 DEMO-READY WITH KNOWN LIMITATIONS

**Justification:**
- End-to-end data pipeline is validated and connected
- ML model loads and scores correctly on QC-cleaned data
- Frontend displays real data from real sources at all depths
- No fabricated, hardcoded, or mock data in live mode
- Geographic coordinates are accurate
- Performance is acceptable
- Error handling covers offline/empty states
- Scientific language is appropriately cautious

**Limitations preventing full 🟢:**
- Limited dataset (single region, single time window)
- Cannot verify hand gesture functionality via automated test
- No comprehensive ground truth for anomaly validation
- Wave height/sea level parameters have limited Copernicus coverage
- Single-model unsupervised approach without ensemble validation
