# Milestone 8 — Copernicus Marine Data Integration

**Date:** 2026-08-25
**Status:** INFRASTRUCTURE READY — CREDENTIALS REQUIRED FOR DATA DOWNLOAD

---

## 1. Copernicus Product Selected

**Product:** Global Ocean Physics Analysis and Forecast
**Product ID:** `GLOBAL_ANALYSISFORECAST_PHY_001_024`
**Provider:** Copernicus Marine Environment Monitoring Service (CMEMS)
**Catalogue:** Verified accessible via `copernicusmarine` Python package v2.4.1

---

## 2. Dataset Identifiers

| Variable | Dataset ID | Temporal Resolution |
|----------|-----------|-------------------|
| Temperature (thetao) | `cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i` | 6-hourly |
| Salinity (so) | `cmems_mod_glo_phy-so_anfc_0.083deg_PT6H-i` | 6-hourly |
| Currents (uo, vo) | `cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i` | 6-hourly |

---

## 3. Variables

| CMEMS Variable | Standard Name | Unit | Available |
|----------------|---------------|------|-----------|
| thetao | Sea water potential temperature | °C | Yes |
| so | Sea water salinity | PSU | Yes |
| uo | Eastward sea water velocity | m/s | Yes |
| vo | Northward sea water velocity | m/s | Yes |

---

## 4. Geographic Subset

| Parameter | Value |
|-----------|-------|
| Minimum latitude | 5.0°N |
| Maximum latitude | 18.0°N |
| Minimum longitude | 80.0°E |
| Maximum longitude | 92.0°E |
| Region | Bay of Bengal |

---

## 5. Time Period

| Parameter | Value |
|-----------|-------|
| Target start | 2026-08-10T00:00:00 |
| Target end | 2026-08-20T00:00:00 |
| Duration | 10 days |
| Temporal resolution | 6-hourly (4 per day) |
| Compatible with Argo data | Yes (Argo: 2026-07-25 to 2026-08-24) |

---

## 6. Depth Range

| Parameter | Value |
|-----------|-------|
| Minimum depth | 0.0 m (surface) |
| Maximum depth | 1000.0 m |
| Depth levels | ~50 standard CMEMS levels |
| Native resolution | Variable (0.5m at surface, ~100m spacing at depth) |

---

## 7. Data Format

| Parameter | Value |
|-----------|-------|
| Download format | NetCDF-4 (CF-1.6 conventions) |
| Coordinate system | WGS84, regular lat/lon grid |
| Horizontal resolution | 1/12° (~8 km) |
| Access method | `copernicusmarine.subset()` |
| Package version | copernicusmarine 2.4.1 |

---

## 8. Processing Steps

```
1. ingest_copernicus.py
   - Checks credentials (env vars or ~/.copernicusmarine/)
   - Downloads 3 NetCDF subsets (temperature, salinity, currents)
   - Saves to: data/raw/copernicus_real/

2. preprocess.py --source copernicus
   - Opens all NetCDF files from copernicus_real/
   - Identifies coordinate names (handles CMEMS naming variants)
   - Subsamples spatially (~0.25° effective for prototype)
   - Validates temperature/salinity/coordinate ranges
   - Outputs: data/processed/model_data.parquet
   - Writes: data/processed/model_source.json {"source": "copernicus"}

3. collocate.py (unchanged)
   - Reads model_data.parquet + observations.parquet
   - Spatial KD-tree + temporal + depth matching
   - Same thresholds: 50km spatial, 12h temporal, 20m depth

4. train.py (unchanged)
   - Timestamp-based temporal split (no leakage)
   - 16-feature Isolation Forest
   - Training-only NaN fill medians

5. API serves collocated data with correct source label
```

---

## 9. Collocation Methodology

Same as Milestone 7 (unchanged):

| Parameter | Value |
|-----------|-------|
| Max spatial distance | 50.0 km |
| Max temporal difference | 12.0 hours |
| Max depth difference | 20.0 m |
| Spatial indexing | scipy.spatial.cKDTree |
| Time grouping | 6-hour floor |
| Model resolution | 1/12° native, subsampled to ~0.25° |

---

## 10. Validation Metrics

**Not yet available** — requires successful data download.

Expected metrics (to be populated after download):

```
TEMPERATURE (obs - model)
  MAE:
  RMSE:
  Mean Bias:
  Median AE:

SALINITY (obs - model)
  MAE:
  RMSE:
  Mean Bias:
  Median AE:
```

---

## 11. ML Results

**Not yet available** — requires successful data download and retraining.

Expected output:
- Training samples: TBD
- Validation samples: TBD
- Anomaly rate: TBD
- Temporal leakage: Will use same proven methodology

---

## 12. Limitations

1. **Credentials required:** Copernicus Marine account not yet configured on this machine
2. **Analysis/Forecast product:** Uses near-real-time analysis, not reanalysis (GLORYS12V1 would be more scientifically rigorous for historical validation)
3. **Subsampling:** For prototype speed, native 1/12° grid is subsampled — production would use full resolution
4. **Single region:** Only Bay of Bengal; not globally validated
5. **No real-time refresh:** This is a batch download, not a streaming pipeline
6. **10-day window:** Limited temporal coverage for ML training

---

## 13. Data Source Attribution

When displaying results derived from this integration:

**Correct attribution:**
> "Ocean model data: E.U. Copernicus Marine Service Information — Global Ocean Physics Analysis and Forecast (GLOBAL_ANALYSISFORECAST_PHY_001_024). Observations: Argo float program via ArgoVis API."

**Do NOT claim:**
- Real-time Copernicus data (it is batch-downloaded)
- Scientifically validated anomaly thresholds
- Production-ready ocean monitoring

---

## CREDENTIALS SETUP INSTRUCTIONS

To complete this milestone, configure Copernicus Marine credentials:

### Option A: Interactive login (recommended)

```bash
cd backend
source venv/bin/activate
copernicusmarine login
```

This will prompt for username/password and store them in `~/.copernicusmarine/`.

### Option B: Environment variables

```bash
export COPERNICUSMARINE_SERVICE_USERNAME=your_username
export COPERNICUSMARINE_SERVICE_PASSWORD=your_password
```

### Option C: .env file

Create `backend/.env`:
```
COPERNICUSMARINE_SERVICE_USERNAME=your_username
COPERNICUSMARINE_SERVICE_PASSWORD=your_password
```

### Then run the pipeline:

```bash
python scripts/ingest_copernicus.py
python scripts/preprocess.py --source copernicus
python scripts/collocate.py
python scripts/train.py
```

### Account registration (free):

https://data.marine.copernicus.eu/register

---

## Files Created/Modified

### Created:
- `backend/scripts/ingest_copernicus.py` — Real CMEMS download script
- `backend/data/raw/copernicus_real/` — Directory for real CMEMS data
- `backend/ml/evaluation/COPERNICUS_INTEGRATION.md` — This document

### Modified:
- `backend/scripts/preprocess.py` — Added `--source` flag, real Copernicus processing, auto-detection
- `backend/scripts/train.py` — Temporal split fix (from Milestone 7), NaN fill fix
- `backend/app/services/ocean_service.py` — Model source detection, dynamic data source label
- `backend/app/api/routes_health.py` — Dynamic status based on actual data source
