# 🚗 TYB MLService - Machine Learning Worker Service

IoT & AI-Based Smart Mobility Platform - ML Background Worker

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.8.0-orange.svg)](https://scikit-learn.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)

---

## 📋 **Overview**

TYB MLService is a Python-based background worker that provides machine learning capabilities for the Track Your Best platform:

- **🎯 ETA Prediction**: Real-time estimated time of arrival using ML models trained on 13 months of Istanbul traffic data
- **👨‍✈️ Driver Scoring**: Behavioral analysis and safety scoring using Random Forest
- **🚨 Anomaly Detection**: GPS anomaly and unusual pattern detection using Isolation Forest

### **Key Features**
- ⚡ Real-time ML predictions every 2-3 minutes
- 🗺️ PostGIS spatial database integration
- 📊 OSRM routing engine integration
- 🐳 Docker containerization ready
- 📈 APScheduler for reliable job execution

---

## 🏗️ **Architecture**

```
┌─────────────────┐
│   React App     │ ← User Interface
└────────┬────────┘
         │
    ┌────▼─────┐
    │PostgreSQL│◄──────────┐
    │ PostGIS  │           │
    └────┬─────┘           │
         │                 │
┌────────▼─────────────┐   │
│  TYB MLService       │───┘
│  (Python Worker)     │
│  ┌────────────────┐  │
│  │ ETA Predictor  │  │ ← ML Model (1.11 min MAE)
│  │ Driver Scorer  │  │ ← ONNX Runtime
│  │ Anomaly Detect │  │ ← Isolation Forest
│  └────────────────┘  │
└─────────┬────────────┘
          │
     ┌────▼────┐
     │  OSRM   │ ← Routing Engine
     └─────────┘
```

---

## 🚀 **Quick Start**

### **Prerequisites**

- Python 3.12+
- PostgreSQL 16+ with PostGIS extension
- OSRM server (for ETA routing)
- 8GB RAM minimum

### **Installation**

```bash
# Clone repository
git clone https://github.com/your-org/track-your-best.git
cd track-your-best/TYB.MLService

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database and OSRM URLs

# Run the service
python main.py
```

**Expected Output:**
```
============================================================
🚀 TYB ML Worker Service başlatılıyor...
============================================================
✅ Anomali Job eklendi (interval: 120s)
✅ Driver Scoring Job eklendi (interval: 300s)
✅ ETA Prediction Job eklendi (interval: 180s)
✅ Scheduler başlatıldı ve jobs aktif
📊 Aktif Jobs:
  - ETA Prediction (id: eta_prediction_job)
  - Anomali Detection (id: anomaly_job)
  - Driver Scoring (id: driver_scoring_job)
⏳ Service çalışıyor... (CTRL+C ile kapatmak için)
```

---

## 📦 **Project Structure**

```
TYB.MLService/
│
├── Dockerfile                    # Container image
├── docker-compose.yml           # Full stack orchestration
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── README.md                    # This file
├── main.py                      # Service entry point
│
├── config/
│   ├── __init__.py
│   └── settings.py              # DB URL, job intervals, model paths
│
├── db/
│   ├── __init__.py
│   ├── database.py              # SQLAlchemy Engine + SessionLocal
│   └── models.py                # ORM Models: Trip, GpsData, EtaPrediction, etc.
│
├── jobs/
│   ├── __init__.py
│   ├── scheduler.py             # APScheduler configuration
│   ├── eta_prediction_job.py    # 🆕 ETA prediction using ML + OSRM
│   ├── anomaly_job.py           # GPS anomaly detection
│   ├── driver_scoring_job.py    # Driver behavior scoring
│   └── route_job.py             # Route optimization (future)
│
├── ml_core/
│   ├── __init__.py
│   ├── eta_predictor.py         # 🆕 Gradient Boosting ETA model
│   ├── preprocessing.py         # Feature extraction utilities
│   ├── driver_scorer.py         # ONNX Random Forest wrapper
│   └── anomaly_detector.py      # Isolation Forest wrapper
│
├── utils/
│   ├── __init__.py
│   ├── logger.py                # JSON logging
│   ├── osrm_client.py           # 🆕 OSRM routing API client
│
├── models_bin/
│   ├── eta_model_istanbul.pkl   # 🆕 ETA prediction model (MAE: 1.11 min)
│   ├── driver_iforest.onnx      # Driver scoring model
│   ├── anomaly_model.pkl        # Anomaly detection model
│   └── model_meta.json          # Model metadata
│
└── data/
    └── ibb_traffic_patterns_2024_2025.csv  # 🆕 Istanbul traffic patterns
```

---

## 🔧 **Configuration**

### **Environment Variables (.env)**

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/tyb_production

# OSRM Routing Service
OSRM_URL=http://localhost:5000

# Logging
LOG_LEVEL=INFO

# Job Intervals (seconds)
JOB_ANOMALY_INTERVAL=120           # 2 minutes
JOB_DRIVER_SCORING_INTERVAL=300    # 5 minutes
JOB_ETA_PREDICTION_INTERVAL=180    # 3 minutes ← Real-time ETA updates
```

### **Job Intervals**

| Job | Interval | Purpose |
|-----|----------|---------|
| **ETA Prediction** | 3 minutes (180s) | Real-time ETA for trips with status='driver_approve' |
| **Anomaly Detection** | 2 minutes (120s) | GPS spike and pattern anomaly detection |
| **Driver Scoring** | 5 minutes (300s) | Driver behavior analysis and scoring |

---

## 🐳 **Docker Deployment**

### **Quick Start with Docker Compose**

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f tyb-mlservice

# Stop services
docker-compose down
```

### **Services Included**
- `tyb-mlservice` - Python ML Worker
- `postgres` - PostgreSQL 16 with PostGIS
- `osrm` - OSRM Routing Engine

---

## 🤖 **ML Models**

### **1️⃣ ETA Prediction Model**

**Algorithm:** Gradient Boosting Regressor (scikit-learn 1.8.0)

**Training Data:**
- 13 months of Istanbul traffic data (İBB API)
- 168 hourly traffic patterns (24 hours × 7 days)
- 22-25 key locations across Istanbul

**Features:**
- Distance (km)
- OSRM baseline duration
- Hour of day (0-23)
- Day of week (0-6)
- Is weekend (boolean)
- Rush hour indicator
- Average speed for time slot

**Performance:**
- **MAE**: 1.11 minutes
- **R²**: 0.9985
- **Validation**: 50+ Google Maps comparisons
- **Accuracy**: 90-95% within ±2 minutes

**Model File:** `models_bin/eta_model_istanbul.pkl`

**Usage:**
```python
from ml_core.eta_predictor import ETAPredictor

predictor = ETAPredictor()
eta = predictor.predict(
    distance_km=15.5,
    osrm_duration_sec=1200,
    timestamp=datetime.now()
)
# Returns: {'eta_minutes': 18.3, 'confidence': 0.95, ...}
```

---

### **2️⃣ Driver Scoring Model**

**Algorithm:** Random Forest Regressor (ONNX Runtime)

**Features (4):**
- `p95_speed_mps` - 95th percentile speed
- `harsh_accel_per_hour` - Harsh acceleration events/hour
- `harsh_brake_per_hour` - Harsh braking events/hour
- `stop_count_per_hour` - Stop count/hour

**Output:** Score 0-100 (100 = perfect driver)

**Model File:** `models_bin/driver_iforest.onnx`

---

### **3️⃣ Anomaly Detection Model**

**Algorithm:** Isolation Forest (scikit-learn)

**Features (10):**
- GPS spike ratio
- Velocity oscillation
- Acceleration oscillation
- Stop count outlier
- Idle ratio
- Max/min jerk
- Max/min acceleration
- Duration hours

**Output:** 
- Anomaly score (0-100)
- Severity (LOW/MEDIUM/HIGH/CRITICAL)
- Flags (GPS_SPIKE, JERK_HIGH, etc.)

**Model File:** `models_bin/anomaly_model.pkl`

---

## 📊 **Database Schema**

### **Key Tables**

#### **tyb_spatial.trips**
```sql
CREATE TABLE tyb_spatial.trips (
    id UUID PRIMARY KEY,
    status trip_status,  -- 'driver_approve', 'cancelled'
    start_location GEOMETRY(Point, 4326),
    end_location GEOMETRY(Point, 4326),
    start_time TIMESTAMPTZ,
    ...
);
```

#### **tyb_analytics.eta_predictions** 🆕
```sql
CREATE TABLE tyb_analytics.eta_predictions (
    id UUID PRIMARY KEY,
    trip_id UUID REFERENCES tyb_spatial.trips(id),
    prediction_time TIMESTAMPTZ,
    predicted_arrival_time TIMESTAMPTZ,
    current_location GEOMETRY(Point, 4326),
    destination GEOMETRY(Point, 4326),
    remaining_distance_km NUMERIC(10,2),
    confidence_score NUMERIC(5,2),
    traffic_factor NUMERIC(5,2),
    metadata JSONB,  -- Contains: eta_minutes, avg_speed_kmh, is_rush_hour, etc.
    ...
);
```

#### **tyb_analytics.driver_scores**
```sql
CREATE TABLE tyb_analytics.driver_scores (
    id UUID PRIMARY KEY,
    trip_id UUID,
    overall_score FLOAT,
    metadata JSONB,  -- ML features and raw scores
    ...
);
```

#### **tyb_analytics.anomalies**
```sql
CREATE TABLE tyb_analytics.anomalies (
    id UUID PRIMARY KEY,
    trip_id UUID,
    severity VARCHAR(20),
    metadata JSONB,  -- Anomaly score, flags
    ...
);
```

---

## 📋 **Job Workflows**

### **1️⃣ ETA Prediction Job** 🆕

```
┌─────────────────────────────────────┐
│ Every 3 minutes:                    │
│                                     │
│ 1. Query trips WHERE                │
│    status='driver_approve'          │
│                                     │
│ 2. For each trip:                   │
│    ├─ Check GPS data                │
│    ├─ If GPS exists:                │
│    │  └─ Use current GPS location   │
│    └─ Else:                         │
│       └─ Use trip start_location    │
│                                     │
│ 3. Call OSRM API:                   │
│    └─ Get route & distance          │
│                                     │
│ 4. ML Model prediction:             │
│    ├─ Input: distance, time, etc.   │
│    └─ Output: ETA in minutes        │
│                                     │
│ 5. Save to eta_predictions table    │
└─────────────────────────────────────┘
```

**Status Flow:**
- `driver_approve` → ETA calculated every 3 minutes
- `cancelled` → Skip (no ETA needed)

**GPS Handling:**
- If GPS data exists → Use current location (live ETA)
- If no GPS yet → Use start_location (initial ETA)

---

### **2️⃣ Driver Scoring Job**

```
Completed Trip → Extract GPS Data
              ↓
        Calculate Features (4):
        • p95_speed_mps
        • harsh_accel_per_hour
        • harsh_brake_per_hour
        • stop_count_per_hour
              ↓
        ONNX Random Forest Model
              ↓
        ML Score (0-100)
              ↓
        Save to driver_scores
```

---

### **3️⃣ Anomaly Detection Job**

```
Completed Trip → Extract GPS Data
              ↓
        Calculate Features (10):
        • gps_spike_ratio
        • velocity_oscillation
        • jerk metrics
        • ...
              ↓
        Isolation Forest Model
              ↓
        Anomaly Score + Severity + Flags
              ↓
        Save to anomalies
```

---

## 🧪 **Testing & Validation**

### **ETA Model Validation** 🆕

```bash
# Test single prediction
cd TYB_ML_ETA
python phase4_validate_google.py

# Compare with Google Maps
# Expected: 90-95% accuracy within ±2 minutes
```

### **Database Queries**

```sql
-- Check latest ETA predictions
SELECT 
    trip_id,
    prediction_time,
    (metadata->>'eta_minutes')::numeric AS eta_minutes,
    (metadata->>'avg_speed_kmh')::numeric AS speed,
    (metadata->>'is_rush_hour')::boolean AS rush_hour
FROM tyb_analytics.eta_predictions
ORDER BY prediction_time DESC
LIMIT 10;

-- Check driver scores
SELECT 
    trip_id, 
    overall_score,
    (metadata->>'ml_score')::numeric AS ml_score
FROM tyb_analytics.driver_scores
ORDER BY calculated_at DESC
LIMIT 10;

-- Check anomalies
SELECT 
    trip_id, 
    severity,
    (metadata->>'anomaly_score')::numeric AS score,
    metadata->>'flags' AS flags
FROM tyb_analytics.anomalies
ORDER BY detected_at DESC
LIMIT 10;
```

---

## 🛠️ **Development**

### **Adding New Models**

1. Train model using sklearn 1.8.0
2. Save to `models_bin/`
3. Create predictor class in `ml_core/`
4. Create job handler in `jobs/`
5. Register job in `jobs/scheduler.py`

### **Model Version Compatibility**

⚠️ **CRITICAL:** All models must use **scikit-learn 1.8.0**

```bash
# Check sklearn version
python -c "import sklearn; print(sklearn.__version__)"
# Must output: 1.8.0

# If different, reinstall
pip install scikit-learn==1.8.0 --force-reinstall
```

---

## 📝 **Dependencies**

**Core ML Stack:**
```
scikit-learn==1.8.0      ← LOCKED for model compatibility
numpy==1.26.4
pandas==2.1.4
scipy==1.14.0
joblib==1.3.2
```

**Database:**
```
SQLAlchemy==2.0.23
psycopg2-binary==2.9.9
GeoAlchemy2==0.14.3      ← PostGIS support
Shapely==2.0.2
```

**Scheduler:**
```
APScheduler==3.10.4
```

**Other:**
```
onnxruntime==1.17.1      ← Driver scoring
requests==2.31.0         ← OSRM client
python-dotenv==1.0.0
pytz==2024.1
```

---

## 📈 **Performance Metrics**

### **ETA Prediction** 🆕
- **Latency**: ~500ms per prediction
- **Throughput**: 10 trips/batch every 3 minutes
- **Accuracy**: 90-95% within ±2 minutes
- **Model Size**: ~15MB

### **System Resources**
- **RAM Usage**: ~200MB idle, ~500MB under load
- **CPU**: <10% on modern CPU
- **Network**: Minimal (database + OSRM calls only)

---

## 🚨 **Troubleshooting**

### **"No module named '_loss'" Error**
```bash
# sklearn version mismatch
pip install scikit-learn==1.8.0 --force-reinstall
```

### **"Model not found" Error**
```bash
# Check models exist
ls models_bin/
# Should see: eta_model_istanbul.pkl, driver_iforest.onnx, anomaly_model.pkl
```

### **"Database connection refused"**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection string in .env
cat .env | grep DATABASE_URL
```

### **"OSRM connection error"**
```bash
# Check OSRM is running
curl http://localhost:5000/route/v1/driving/29.0,41.0;29.1,41.1

# Should return JSON route
```

### **"Invalid enum value 'in_progress'"**
- Check `get_pending_trips()` uses `status='driver_approve'`
- PostgreSQL enum only has: `ongoing`, `completed`, `cancelled`, `driver_approve`

---

## 🔮 **Future Enhancements**

- [ ] Multi-model ensemble for ETA
- [ ] Real-time traffic API integration
- [ ] Weather data incorporation
- [ ] Route optimization with ML
- [ ] Web dashboard (Grafana/Kibana)
- [ ] Model auto-retraining pipeline
- [ ] Kubernetes deployment
- [ ] Prometheus metrics export

---

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 **License**

This project is part of the Track Your Best platform.

Private - Track Your Best (TYB)

---

## 👥 **Team**

**Created by:**
- Barış Can Aslan
- Yiğit Avar
- Toprak Kamburoğlu

**Organization:** TYB

**Date:** March 2026

---

## 🔗 **Links**

- [OSRM Documentation](https://github.com/Project-OSRM/osrm-backend)
- [PostGIS Documentation](https://postgis.net/)

---

**Version:** 2.0 🆕  
**Last Updated:** March 13, 2026  
**Status:** ✅ Production Ready with ETA Prediction

---

**⭐ Star us on GitHub if this helped you!**
