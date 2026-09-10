# Ocean Sentry 🌊
### Maritime Intelligence, AI-Powered Oceanographic Digital Twin & Ground-Truth Validation

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-WebGL2.0-black?style=flat-square&logo=three.dot.js)
![PyTorch GPU](https://img.shields.io/badge/PyTorch-DirectML%20%2F%20CUDA-EE4C2C?style=flat-square&logo=pytorch)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![NVIDIA RTX 5060](https://img.shields.io/badge/Hardware-NVIDIA%20RTX%205060%20(8GB)-76B900?style=flat-square&logo=nvidia)
![MediaPipe](https://img.shields.io/badge/AI%20Vision-Google%20MediaPipe-00A67E?style=flat-square&logo=google)
![INCOIS](https://img.shields.io/badge/Data-INCOIS%20OAS%20%2B%20ARGO-005596?style=flat-square)
![India EEZ](https://img.shields.io/badge/Maritime%20Domain-India%20EEZ%20Boundary-FF9933?style=flat-square)
![Autonomous Gliders](https://img.shields.io/badge/Autonomous%20Fleet-3D%20Gliders-22d3ee?style=flat-square)

**Ocean Sentry** is a state-of-the-art 3D oceanographic digital twin and maritime intelligence platform. It bridges INCOIS Ocean Advisory Services (O.A.S.) numerical supercomputer forecasts (with external CMEMS assimilation) with physical, in-situ ARGO float arrays, autonomous underwater gliders, and hyper-local IoT buoys. Powered by **React**, **Three.js (WebGL 2.0)**, **Google MediaPipe**, and a GPU-accelerated **PyTorch Deep Autoencoder**, Ocean Sentry enables real-time ocean anomaly detection, ground-truth variance cross-validation, touchless gesture navigation, multi-depth underwater ecosystem exploration, and sovereign maritime domain awareness across the Indian Exclusive Economic Zone (EEZ).

---

## 🌟 Comprehensive Feature Catalog

### 1. Photorealistic NASA Blue Marble 3D Planetary Engine
* **PBR Earth Shader:** Calibrated with NASA Blue Marble 8K surface textures, rendering crisp continental topography without diffuse washout.
* **Bathymetric Depth Gradient:** Realistic multi-tier water coloring distinguishing deep abyssal trenches (`#01061f`), open ocean basins (`#030e3b`), sunlit oceanic blue (`#051861`), and turquoise continental shelves (`#087299`).
* **Vegetation & Terrain Classification:** Color-graded biomes mapping rainforests (`#12590d`), temperate grasslands, and desert ochres (`#c79e42`).
* **Specular Solar Reflection:** High-exponent specular sun glint ($N \cdot H^{64.0}$) restricted strictly to ocean waters.
* **Rayleigh Horizon Atmosphere:** Grazing-angle Fresnel atmospheric halo ($N \cdot V^{6.5}$) creating an authentic planetary blue limb.
* **Deep Cosmos Starfield:** 3,200 astronomical stars with realistic spectral color classifications (Ice Blue, Diamond White, Warm Amber) and Gaussian twinkling.

### 2. Volumetric Atmospheric Dynamics & Moving Cloud Layer
* **High-Resolution Lanczos Cloud Map:** 2048×1024 cloud layer with smooth continuous feathering and zero block compression artifacts.
* **Atmospheric Rotation & Advection:** Independent cloud rotation (~1.4°/sec) with fluid harmonic wind shearing.
* **Volumetric Shading:** Beer-Lambert light extinction inside dense storm cores, forward Mie scattering ("Silver Lining" sunlight rim sheen), and warm golden-peach twilight terminator tinting.
* **Ground Shadow Projection:** Real-time shadow casting onto land and ocean surfaces, providing true 3D altitude separation.

### 3. Global Wind Systems & Ocean Current Circulation
* **Wind System Dynamics:** Real-time particle streams visualizing global atmospheric circulation patterns:
  * **Indian Ocean Monsoon:** Seasonal high-energy wind circulation over the Arabian Sea and Bay of Bengal.
  * **Tropical Trade Winds:** Steady equatorial trade circulation driving equatorial currents.
  * **Mid-Latitude Westerlies:** High-velocity westerly jet streams across the Southern Ocean.
  * **Polar Easterlies:** Cold descending air masses at the polar extremities.
* **Interactive Wind Controls:** Individual toggles to filter and focus on specific wind systems.
* **Dynamic Ocean Current Streamlines:** Vector velocity particles colored by temperature, salinity, wave height, and flow velocity.

### 4. Ground-Truth Validation & Variance Analysis Panel
* **Live Model vs. Physical Sensor Cross-Validation:** Direct, side-by-side comparison between:
  * 💻 **INCOIS Numerical Model:** Supercomputer physics predictions (O.A.S. grid with CMEMS assimilation).
  * 📡 **Live In-Situ Sensor Telemetry:** Physical measurements from ARGO CTD floats, autonomous gliders, and coastal IoT buoys (e.g., `IND-ESP32-01`).
* **Automated Variance & Anomaly Detection:** Calculates real-time absolute differences ($\Delta T$, $\Delta S$, $\Delta H$, $\Delta\text{Chl}$), triggering high-variance alerts (`FAILED` vs `VERIFIED`).
* **Operational Maritime Intelligence:** Generates hyper-local advisories alerting the **Indian Coast Guard** and **local fishing vessels** when satellite models deviate significantly in shallow coastal zones.
* **Advisory Broadcast Engine:** One-click dispatch of safety and navigation advisories across regional mesh receivers.
* **Multi-Station Selector:** Instant toggle between benchmark anomaly stations (`IND-ESP32-01`), autonomous gliders (`GLIDER-001`), and all active ARGO floats.

### 5. Live Ocean Water pH Determination & Ocean Acidification Engine
* **BGC-Argo ISFET Potentiometry:** Real-time electrochemical seawater pH calculation utilizing the temperature-compensated Nernst formulation:
  $$\text{pH}_{\text{Total}} = \frac{E^0(T, S, P) - E_{\text{cell}}}{\frac{R \cdot T \cdot \ln(10)}{F}} - \log_{10}\left(1 + \frac{S_T}{K_S}\right)$$
* **INCOIS BGC Carbonate Equilibrium:** Cross-validates in-situ ISFET measurements against INCOIS/CMEMS (PISCES-v2) Dissolved Inorganic Carbon (DIC) and Total Alkalinity ($A_T$) models.
* **Aragonite & Calcite Saturation ($\Omega_{\text{arag}}$, $\Omega_{\text{calc}}$):** Computes live carbonate saturation states, alerting when $\Omega < 1.0$ (corrosive water causing shell dissolution in pteropods, coral reefs, and larval bivalves).
* **Interactive Sensor Calibrator:** Interactive physical sliders for Water Temperature ($T$), Salinity ($S$), ISFET Cell Voltage ($E_{\text{cell}}$), Atmospheric $p\text{CO}_2$, and Hydrostatic Depth ($P$).
* **Professional Analytics Dashboard:** Clean, modern user interface utilizing glassmorphism and clear visual hierarchy for data comprehension.

### 6. Interactive Multi-Depth Float & Station Telemetry
* **Fleet Observation Markers:** Interactive 3D markers for Buoys, ARGO Floats, Coastal Stations, Autonomous Gliders, and Satellite ground-truth links.
* **Multi-Parameter Telemetry:** Real-time tracking and comparison of:
  * **Sea Surface Temperature (SST)** (°C)
  * **Salinity** (PSU)
  * **Ocean Water pH (Total Scale)** (pH)
  * **Chlorophyll-a Concentration** (mg/m³) — biogeochemical primary productivity indicator
  * **Aragonite Saturation State ($\Omega_{\text{arag}}$)** (Ω)
  * **Significant Wave Height** (m)
  * **Current Speed & Velocity Vectors** (m/s)
  * **Sea Surface Height Anomaly (SSHA)** (m)
* **Depth-Stratified Profiling:** Dynamic calculation of physical conditions across 6 bathymetric zones:
  * `0m` — Surface Boundary Layer (pH ~8.16, $\Omega_{\text{arag}} \sim 3.85$, Chl ~0.15 mg/m³)
  * `10m` — Upper Photic / Epipelagic Zone (pH ~8.14, $\Omega_{\text{arag}} \sim 3.70$, Chl ~0.22 mg/m³)
  * `50m` — Mesopelagic Transition (pH ~8.05, $\Omega_{\text{arag}} \sim 3.10$, Chl ~0.08 mg/m³)
  * `100m` — Twilight / Disphotic Zone (pH ~7.92, $\Omega_{\text{arag}} \sim 2.40$, Chl ~0.02 mg/m³)
  * `500m` — Bathyal / Deep Ocean (pH ~7.78, $\Omega_{\text{arag}} \sim 1.45$)
  * `1000m` — Abyssal Benthic Boundary (pH ~7.65, $\Omega_{\text{arag}} \sim 0.92$ Corrosive)

### 7. Autonomous Ocean Glider Fleet & 3D Sawtooth/Yo-Yo Trajectory Profiling
* **Autonomous Underwater Gliders:** Deployed multi-depth surveying gliders (e.g., `GLIDER-001` in the Bay of Bengal basin).
* **3D Catmull-Rom Spline Trajectory:** Smooth volumetric curve reconstruction plotting historical diving routes across depth layers (0m to 100m+) with radial depth offsets to reflect submerged depth.
* **Heading & Vector Alignment:** Gliders orient dynamically along their active navigational heading (e.g., $45^\circ\text{ NE}$).
* **Glider Mission Log HUD:** Detailed station panel view showing total trajectory waypoint history, live heading direction, dive cycle pattern (`YOYO / SAWTOOTH`), and synchronized biogeochemical data.

### 8. India Exclusive Economic Zone (EEZ) Geopolitical Boundary
* **Geodesic Geopolitical Maritime Border:** Accurate 3D boundary rendering India's 200-nautical-mile Exclusive Economic Zone (EEZ) spanning the Arabian Sea, Bay of Bengal, and Andaman & Nicobar territories.
* **Z-Fighting Free Tube Geometry:** Elevates the border ribbon slightly ($R=2.002$) with cyan neon illumination (`#22d3ee`) for crisp rendering against complex bathymetric terrain.
* **Maritime Domain Awareness:** Toggleable via the Unified Control Dock (`INDIA EEZ OVERLAY`), enabling instant operational awareness of whether anomalies or foreign incursions occur within sovereign Indian waters.

### 9. Subsurface Exploration & 3D Marine Ecosystem
* **Cinematic Subsurface Dive:** Smooth camera transition from planetary orbit into underwater columns.
* **Realistic Underwater Optics:** Depth-dependent light attenuation (Beer-Lambert law), volumetric sun caustics, and floating marine snow particles.
* **Depth-Specific Marine Biology Simulation:**
  * **0m–10m (Photic):** Dense schooling reef fish, oceanic manta rays, and green sea turtles.
  * **50m–100m (Twilight):** Fast pelagic tuna pods and solitary apex tiger/great white sharks.
  * **500m–1000m (Abyssal):** Giant squid, deep-sea crown jellyfish, sleeper sharks, and 25m+ colossal leviathan acoustic signatures.
* **Subsurface HUD:** Real-time multi-depth observation counter, anomaly status, and depth level switcher.

### 10. Local Ocean 3D Sandbox (`EXPLORE LOCAL OCEAN`)
* **Local Water Column Mode:** High-resolution local ocean simulation with Gerstner ocean waves, surface foam, and buoyancy physics.
* **Physical Buoy Dynamics:** Floating buoy models that respond realistically to wave frequencies and current drag.
* **Volumetric Sun Rays & Caustics:** Underwater light shafts filtered by surface turbulence.

### 11. GPU-Accelerated Deep Autoencoder Anomaly Detection
* **Neural Architecture:** PyTorch Deep Autoencoder trained to identify spatiotemporal deviations between numerical simulations and physical float observations.
* **DirectML & CUDA Acceleration:** Native execution on **NVIDIA GeForce RTX 5060 GPU**, achieving sub-15ms inference latency.
* **Automated Anomaly Scoring:** Unsupervised reconstruction error scoring categorized into `NORMAL`, `WARNING`, and `HIGH / CRITICAL` alert levels.
* **Hardware Telemetry:** Live GPU device identification (`GPU: NVIDIA RTX 5060 (CUDA)`) and ML engine heartbeat on the UI HUD.

### 12. Touchless AI Hand Gesture Control (MediaPipe)
* **WASM WebGL 2.0 Landmarker:** Zero-touch 21-point hand tracking via webcam using Google MediaPipe.
* **Natural Gesture Set:**
  * **Closed Fist:** Smooth spherical globe rotation and camera orbiting.
  * **Two Hands:** Dynamic distance zoom (move hands apart to zoom in, together to zoom out).
  * **Thumb-Index Pinch:** Precision selection of float markers, gliders, and stations via HUD crosshair raycasting.
  * **Claw / Two Fingers:** Re-center view to initial orbital position.
  * **Open Palm:** Free cursor panning and crosshair aiming without rotation.

### 13. 4D Spatiotemporal Timeline & Playback
* **Historical Scrubbing:** 24-hour step-by-step playback of oceanographic conditions across the Bay of Bengal basin.
* **Auto-Play Simulation:** Continuous temporal interpolation at 1.5s step intervals.

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18 / 19, TypeScript, Vite, Modern CSS Design System |
| **3D Rendering & Shaders** | Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`) |
| **Trajectory & Boundary Rendering**| Catmull-Rom 3D Splines, TubeGeometry, GeoJSON Geodesic Boundaries |
| **Computer Vision AI** | Google MediaPipe (`@mediapipe/tasks-vision` Hand Landmarker) |
| **Backend API** | FastAPI, Uvicorn (ASGI), Pydantic, NumPy, Pandas |
| **Machine Learning** | PyTorch, Isolation Forest, ONNX Runtime DirectML, CUDA |
| **Hardware Target** | NVIDIA GeForce RTX 5060 Laptop GPU (8GB VRAM) / DirectML D3D12 |
| **Oceanographic Data** | INCOIS (Primary), Copernicus Marine Service (CMEMS), ArgoVis In-Situ API, BGC-Argo |

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18.0 or newer)
* **Python** (v3.10 or v3.11)
* **GPU (Recommended):** NVIDIA RTX series with updated drivers

---

### Step 1: Start the Backend (GPU ML & Data Server)

```bash
# Navigate to the backend directory
cd backend

# Activate the virtual environment
# On Windows:
.\venv_gpu\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies if not already installed
pip install -r requirements.txt

# Start the FastAPI server on port 8000
python -m uvicorn app.main:app --port 8000 --reload
```

* **Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **GPU Hardware Status:** [http://localhost:8000/api/ml/device](http://localhost:8000/api/ml/device)
* **Anomaly Summary:** [http://localhost:8000/api/ocean/anomalies/summary](http://localhost:8000/api/ocean/anomalies/summary)

---

### Step 2: Start the Frontend (3D Digital Twin Client)

In a new terminal:

```bash
# From the project root
npm install

# Launch Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port indicated by Vite) in your browser.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check, database status, and ML pipeline readiness. |
| `GET` | `/api/ml/device` | Hardware acceleration telemetry (NVIDIA GPU, CUDA/DirectML status). |
| `POST` | `/api/ml/predict` | Real-time Autoencoder anomaly score inference for given features. |
| `GET` | `/api/stations` | List all observation stations, autonomous gliders (with trajectory logs), and buoys. |
| `GET` | `/api/stations/frontend` | Formatted stations array for direct 3D WebGL marker and glider trajectory rendering. |
| `GET` | `/api/stations/{id}` | Detailed single station data including sync latency, trajectory, and coordinates. |
| `GET` | `/api/ocean/observations` | Filtered observation profiles by depth, region, and timestamp (includes Chlorophyll-a). |
| `GET` | `/api/ocean/model` | INCOIS numerical forecast grid data (with CMEMS). |
| `GET` | `/api/ocean/comparison` | Collocated model vs. observation difference records including $\Delta\text{Chl}$, $\Delta T$, $\Delta S$. |
| `GET` | `/api/ocean/anomalies` | Detected anomalies with anomaly scores and confidence levels. |
| `GET` | `/api/ocean/anomalies/summary`| Aggregated anomaly counts (High, Warning, Normal) and score stats. |
| `GET` | `/api/argo/stream` | Real-time ARGO float and autonomous telemetry stream. |

---

## Gesture Control User Guide

Click the **`HAND CONTROL [ ON ]`** widget in the bottom-right corner to activate webcam gesture control:

```
    CLOSED FIST               TWO HANDS               PINCH
    Rotate the Globe          Dynamic Zoom In/Out     Select Station Marker
```

| Gesture | Action | Description |
| :--- | :--- | :--- |
| **Closed Fist** | **Rotate Globe** | Hold a fist and drag across 3D space to rotate the planetary sphere. |
| **Two Hands** | **Zoom In / Out** | Move both hands apart to zoom into regional seas; bring together to zoom out. |
| **Index + Thumb Pinch** | **Select Marker** | Hover the glowing crosshair over a station/float/glider and pinch to open telemetry. |
| **Claw / Double Finger** | **Re-center View** | Resets the orbital camera target to `(0, 0, 0)` and clears active selection. |
| **Open Palm** | **Hover / Aim** | Moves the on-screen crosshair freely without initiating rotation. |

---

## 📂 Project Architecture

```text
ocean-sentry/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI route handlers (health, stations, ocean, anomalies, argo)
│   │   ├── services/        # ML service, anomaly service, and ocean service (glider injection)
│   │   ├── models/          # Pydantic schemas (StationResponse, TrajectoryPoint, Chlorophyll)
│   │   └── main.py          # FastAPI application entry point & CORS configuration
│   ├── ml/
│   │   ├── models/          # Trained weights (autoencoder PyTorch & ONNX models)
│   │   └── autoencoder.py   # PyTorch Deep Autoencoder architecture
│   ├── scripts/             # Ingestion, QC preprocessing, collocation, and training scripts
│   └── venv_gpu/            # GPU-accelerated virtual environment (DirectML / CUDA)
├── public/
│   ├── data/
│   │   └── india_eez.geojson# Authoritative GeoJSON boundary for India Exclusive Economic Zone
│   └── textures/            # NASA Blue Marble textures (day, night, clouds, specular maps)
├── src/
│   ├── components/
│   │   ├── scene/           # 3D Globe (RealisticEarth, GliderMarkers, IndiaEEZ, Wind, Currents)
│   │   ├── localocean/      # Local water column shaders, Gerstner waves, underwater marine fauna
│   │   └── ui/              # UnifiedControlDock, StationPanel, GroundTruthModal, PHAnalyzerModal
│   ├── hooks/               # useHandGesture (MediaPipe), useOceanData, useCinematicTransition
│   ├── data/                # Mock/Fallback station benchmarks (including GLIDER-001 & IND-ESP32-01)
│   ├── pages/
│   │   └── Explorer.tsx     # Main 3D digital twin mission control canvas
│   ├── services/            # Client-side API integration (oceanApi.ts)
│   └── utils/               # Oceanographic calculations, Nernst formulations & color palettes
├── package.json
└── README.md
```

---

## 📜 Acknowledgments & License
Developed for the **Smart India Hackathon (SIH)**. Built using open-source oceanographic datasets from **INCOIS** (Primary), **Copernicus Marine Service (CMEMS)**, and **ArgoVis / NASA Earth Observatory**.
