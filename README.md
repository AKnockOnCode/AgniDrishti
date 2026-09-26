# 🔥 AgniDrishti — AI-Powered Fire Intelligence Platform

> **"No Place Left Behind"**
> Smart India Hackathon 2026 · Problem Statement: Real-Time Thermal Hotspot Classification

[![NASA FIRMS](https://img.shields.io/badge/Data-NASA%20FIRMS-red?logo=nasa)](https://firms.modaps.eosdis.nasa.gov/)
[![OpenStreetMap](https://img.shields.io/badge/Data-OpenStreetMap-green?logo=openstreetmap)](https://www.openstreetmap.org/)
[![CesiumJS](https://img.shields.io/badge/Globe-CesiumJS-blue)](https://cesium.com/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-yellow)](https://vitejs.dev/)

---

## 🌍 Overview

**AgniDrishti** (Sanskrit: *Eye of Fire*) is a real-time, AI-driven geospatial intelligence platform that detects, classifies, and visualises active thermal hotspots across India — and globally — using live NASA satellite data.

It was built for the **Smart India Hackathon 2026** to answer a critical question that existing fire monitoring tools cannot: *Is this fire an agricultural burn, a wildfire, a gas flare, or a persistent industrial thermal source?*

The system ingests live fire detections from **NASA FIRMS** (Fire Information for Resource Management System) every 30 minutes, passes each detection through a multi-layered AI classification engine, and renders the results on an immersive 3D globe — colour-coded by fire type in real time.

---

## 🛰️ What Makes This Different

| Traditional Fire Monitoring | AgniDrishti |
|---|---|
| Shows all fires as identical red dots | Color-codes every fire by its classified type |
| No distinction between industrial and agricultural | Multi-evidence AI classification: archive + OSM + physics |
| Requires manual analyst review | Fully automated, updated every 30 minutes |
| Desktop GIS software | Live web app on any device |
| No historical context | Uses 6-month NASA archive to detect persistent sources |

---

## 🤖 AI Classification Engine

Every fire detection goes through a **5-step classification pipeline**:

### For India (OSM + Archive data available):

```
BLAST          →  FRP > 500 MW — industrial explosion / gas blow-out
                  
ARCHIVE        →  Fire in 5+ distinct months of 6-month NASA archive
PERSISTENCE       → Permanent industrial source (impossible for seasonal agri)

FACTORY        →  Within 500m of OSM-mapped factory AND recurring in archive
PROXIMITY         → Confirmed persistent industrial / gas flare

OFFSHORE       →  Coordinates match Bombay High or KG Basin oil fields
                  → Offshore oil platform thermal source

WILDFIRE       →  Not near any industry (2km), first-time location, FRP > 8 MW
                  → Forested states: Uttarakhand, Himachal, Odisha, Chhattisgarh

AGRICULTURAL   →  Default — seasonal, low-FRP, not near industry, not recurring
```

### For rest of world (physics-only):

```
FLARE          →  Brightness > 420K AND FRP > 80 MW (oil field gas flares)
WILDFIRE       →  FRP > 25 MW (African savannah, Australian bush fires)
AGRICULTURAL   →  Everything else (Africa's seasonal controlled burns)
```

### Color coding:

| Color | Classification | Description |
|---|---|---|
| 🟡 Yellow | Agricultural Fire | Seasonal crop residue burning, controlled burns |
| 🟠 Orange | Wildfire | Uncontrolled forest/grassland fire |
| 🟣 Purple | Persistent Industrial | Factory, power plant, or recurring thermal source |
| 🔵 Cyan | Industrial Flare | Active gas flare, brick kiln stack, petrochemical |
| 🔴 Magenta | Blast / Explosion | Industrial accident, gas blow-out |

---

## 📡 Data Sources

| Source | What it provides | Update frequency |
|---|---|---|
| **NASA FIRMS VIIRS (NOAA-20)** | Live fire hotspots: lat, lon, FRP, brightness, confidence | 30 min |
| **NASA FIRMS VIIRS (Suomi-NPP)** | Supplementary satellite coverage | 30 min |
| **NASA FIRMS MODIS** | Coarser resolution backup | Daily |
| **NASA FIRMS Archive (6 months)** | Historical fire records for persistence analysis | One-time |
| **OpenStreetMap Overpass API** | 33,288 industrial facilities in India | Updated via script |
| **Cesium Ion Terrain** | 3D globe elevation model | Static |
| **NOAA GFS Wind** | Atmospheric wind layer | 6-hourly |

### Archive Data

The 6-month NASA FIRMS archive contains **~800,000 fire detections** across India. The system processes this archive at startup to build a **spatial persistence index** — identifying 14,880 grid cells (each 0.1° × 0.1°, ~11km) that have shown fire activity in 2 or more distinct months.

**Key insight**: Agricultural fires are seasonal (days to weeks). A location that burns in 5 or more separate calendar months is definitively a permanent thermal source — a steel plant, coal field, glass furnace, or oil terminal.

---

### Map and Ground Notes

Nineteen layers and map sources. **Seventeen have a keyless path.**

**Sits on the real ground.** Entity heights are aligned to work with Google 3D tiles, so aircraft park on aprons and cameras stand on street corners instead of floating.

## 🗺️ Features

- **Live 3D Globe** — CesiumJS-powered photorealistic Earth with terrain
- **Level-of-Detail Rendering** — Heat grid at global scale → individual markers on zoom → click for full detail
- **Fire Detection Report Panel** — Click any hotspot to see: coordinates, classification label, FRP (MW), brightness (Kelvin), confidence, satellite, and acquisition time
- **AI Classification Labels** — Floating callout cards on the map showing fire type in real time
- **ML Persistence Engine** — Background classification using 6-month historical archive
- **Wind Layer** — NOAA GFS wind visualisation overlay
- **Mapped Industrial Installations** — 33,288 OSM-sourced factory locations
- **Tactical HUD** — Military-style heads-up display with MGRS coordinates, sun angle, orbit passes
- **Voice Interface** — Voice standby mode with audio visualiser
- **Classified Information Aesthetic** — SI-TK // NOFORN styled UI inspired by real satellite ground stations

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser Client                     │
│  CesiumJS Globe ← src/layers/firms/rendering.js     │
│  Color Coding   ← src/layers/firms/model.js         │
│  Fire Cards     ← src/layers/firms/cards.js         │
│  Selection UI   ← src/layers/firms/selection.js     │
│  Fire Report    ← src/ui/templates/scene-chrome.html│
└────────────────────┬────────────────────────────────┘
                     │ /api/firms (JSON)
┌────────────────────▼────────────────────────────────┐
│               Vite Dev Server (Node.js)              │
│  Classification ← server/providers/firms.js         │
│    ├── KDBush spatial index (33k OSM factories)     │
│    ├── persistent_hotspots.json (6-month archive)   │
│    └── 5-step classifyFire() engine                 │
│  30-min cache   ← .gev-cache/firms.json             │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│              NASA FIRMS API                          │
│  VIIRS NOAA-20, NOAA-21, Suomi-NPP, MODIS          │
│  https://firms.modaps.eosdis.nasa.gov/api/          │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A free [NASA FIRMS MAP_KEY](https://firms.modaps.eosdis.nasa.gov/api/map_key/)
- A free [Cesium Ion access token](https://cesium.com/ion/)

### Installation

```bash
git clone https://github.com/AKnockOnCode/sih-agnidrishti.git
cd sih-agnidrishti
npm install
```

### Configuration

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_here
VITE_FIRMS_MAP_KEY=your_nasa_firms_key_here
```

### Running

```bash
# On Windows (required to bypass self-signed cert)
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx vite --port 4173

# On Linux/Mac
NODE_TLS_REJECT_UNAUTHORIZED=0 npx vite --port 4173
```

Open **[http://localhost:4173](http://localhost:4173)**

---

## 📁 Project Structure

```
sih-agnidrishti/
├── server/
│   └── providers/
│       └── firms.js              ← AI classification engine + NASA FIRMS proxy
├── src/
│   ├── layers/
│   │   └── firms/
│   │       ├── model.js          ← Color coding + glow sprite renderer
│   │       ├── rendering.js      ← CesiumJS cell + detection rendering
│   │       ├── policy.js         ← Level-of-detail (LOD) configuration
│   │       ├── cards.js          ← Floating label card system
│   │       └── selection.js      ← Click-to-select + fire report panel
│   ├── data/
│   │   ├── firmsAdapt.js         ← API response → internal fire record
│   │   └── firmsCsv.js           ← NASA CSV parser
│   └── ui/
│       └── templates/
│           └── scene-chrome.html ← Fire Detection Report UI panel
├── ml/
│   ├── train_real_final.py       ← ML training script (Random Forest)
│   └── fire_classifier_real.pkl  ← Trained model weights
├── firms_data/                   ← NASA FIRMS 6-month archive CSVs
├── industrydataosm.csv           ← 33,288 OSM industrial facilities (India)
├── persistent_hotspots.json      ← Pre-computed archive persistence index
└── .env.example                  ← Environment variable template
```

---

## 🧠 Machine Learning Details

### Training Data

| Dataset | Records | Source |
|---|---|---|
| NASA FIRMS Archive | ~800,000 fire detections | 6 months, all India |
| OSM Industrial Facilities | 33,288 factory locations | Overpass API |

### Features Used

- **FRP** (Fire Radiative Power, MW) — energy output of the fire
- **Brightness** (Kelvin) — peak temperature of the fire pixel
- **Confidence** — VIIRS satellite detection confidence (low/nominal/high)
- **Day/Night** — time of acquisition
- **Distance to nearest industry** — computed from KDBush spatial index
- **Archive months active** — how many distinct months this location appeared in historical data

### Model

A **Random Forest Classifier** is trained offline using `ml/train_real_final.py`. The trained model (`fire_classifier_real.pkl`) is used as a reference, but the **primary runtime classification** happens in `server/providers/firms.js` using the rule-based engine above — making it interpretable, fast, and auditable without requiring Python at runtime.

---

## 🗂️ Data Preparation

### Regenerating the Persistent Hotspots Index

If you add new archive data to `firms_data/`, regenerate the index:

```bash
node analyze_archive.js
```

This reads all CSV files in `firms_data/` and writes `persistent_hotspots.json` — a map of 14,880 locations in India that have shown fire activity in 2+ distinct months.

### Updating OSM Industrial Data

To refresh the factory dataset from OpenStreetMap:

1. Open [overpass-turbo.eu](https://overpass-turbo.eu)
2. Run: `[out:csv(::lat,::lon,name,industrial)][timeout:120]; area["ISO3166-1"="IN"]->.india; node[landuse=industrial](area.india); out;`
3. Click **Export → Download raw response**
4. Save as `industrydataosm.csv` in the project root

---

## 📊 Current Performance (Live Data — September 2026)

Tested against **534 active fire detections in India** from NASA FIRMS:

| Class | Count | % |
|---|---|---|
| Agricultural | 287 | 53.7% |
| Persistent Industrial | 199 | 37.3% |
| Industrial Flare | 16 | 3.0% |
| Wildfire | 28 | 5.2% |
| Blast | 0 | 0.0% |

Global (Africa alone): **65,151 agricultural, 5,245 wildfire, 0 false industrial** — correctly matching known fire patterns.

---

## 🛡️ Known Limitations

- **OSM coverage**: Not all industrial facilities in India are mapped on OpenStreetMap, particularly smaller brick kilns in rural areas
- **2-crop cycle ambiguity**: Punjab's paddy (Oct-Nov) + wheat (Apr-May) burning can appear in 2 months of archive — tightened threshold to 5+ months to avoid false positives
- **No land cover layer**: A future improvement would integrate ESA WorldCover 10m land classification to verify whether a fire is over forest, farmland, or industrial land
- **India-only deep classification**: The full archive + OSM pipeline only applies to India (lat 8–37°N, lon 68–98°E). Global fires use physics-based heuristics only

---

## 🏆 Team

Built for the **Smart India Hackathon 2026**

| Role | Description |
|---|---|
| Geospatial Lead | 3D globe, CesiumJS rendering, LOD system |
| AI/ML Lead | Fire classification engine, archive analysis, KDBush spatial indexing |
| Data Engineering | NASA FIRMS integration, OSM pipeline, persistent hotspot indexing |
| UI/UX | Tactical HUD, fire report panel, AgniDrishti theme |

---

## 📄 License

This project is built on top of [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (open source) and extended with original AI classification work for SIH 2026.

NASA FIRMS data is publicly available. OpenStreetMap data is © OpenStreetMap contributors (ODbL).

---

*AgniDrishti — Because every fire tells a story. We make sure the right people hear it.*
