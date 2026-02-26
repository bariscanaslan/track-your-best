# Track Your Best - ML ETA Prediction System

IoT & AI-based smart mobility platform with traffic-aware ETA prediction using Istanbul traffic data.

---

## 🎯 Overview

Real-time ETA prediction system combining:
- **İBB Istanbul Traffic Data** (20M GPS points, 2024-2025)
- **Machine Learning** (Gradient Boosting, 99.98% accuracy)
- **OSRM Routing** (Turkey OSM map)
- **.NET Microservices** (PostgreSQL + PostGIS)

---

## 📂 Project Structure

```
track-your-best/
├── TYB_ML_ETA/                    # Python ML Training & API
│   ├── data/
│   │   ├── ibb_raw/               # İBB traffic CSVs (13 months)
│   │   └── processed/             # Aggregated patterns (168)
│   ├── models/
│   │   └── eta_model_istanbul.pkl # Trained model
│   ├── scripts/
│   │   ├── phase1_ibb_aggregation.py
│   │   ├── phase2_generate_training.py
│   │   ├── phase3_train_model.py
│   │   └── phase4_ml_api.py       # Flask API (Port 5001)
│   └── requirements.txt
│
└── track-your-best-product/
    ├── backend/TrackYourBest/
    │   ├── TYB.ApiService/        # Main API (Port 5110)
    │   ├── TYB.IoTService/        # MQTT GPS ingestion
    │   └── TYB.MLService/         # ETA Prediction API (Port 5200)
    │       ├── ML/
    │       │   ├── Models/        # DTOs
    │       │   └── Services/      # ML API client
    │       ├── Infrastructure/
    │       │   ├── Services/      # OSRM client
    │       │   └── Entities/      # EF Core entities
    │       └── Application/
    │           └── Controllers/   # EtaController
    │
    └── frontend/                  # Next.js React app
        └── app/(auth)/dashboard/fleet-manager/
```

---

## 🚀 Quick Start

### **Prerequisites**
- Docker Desktop
- Python 3.11+
- .NET 8.0 SDK
- PostgreSQL 15+ with PostGIS
- Node.js 18+

### **1. Start OSRM (Routing Engine)**
```powershell
cd osrm-data
docker run --rm -t -p 5000:5000 -v ${PWD}:/data ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/turkey.osrm
```

### **2. Start ML API (Flask)**
```powershell
cd TYB_ML_ETA
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python scripts/phase4_ml_api.py
# Runs on http://localhost:5001
```

### **3. Start .NET MLService**
```powershell
cd track-your-best-product/backend/TrackYourBest/TYB.MLService
dotnet restore
dotnet run
# Runs on http://localhost:5200
```

### **4. Start .NET ApiService**
```powershell
cd track-your-best-product/backend/TrackYourBest/TYB.ApiService
dotnet run
# Runs on http://localhost:5110
```

### **5. Start React Frontend**
```powershell
cd track-your-best-product/frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

---

## 🔄 System Flow

```
User selects route in React
    ↓
POST /api/eta/predict (TYB.MLService - Port 5200)
    ↓
├─► OSRM (Port 5000): Calculate distance & duration
│   Input:  Start/End coordinates (lon,lat)
│   Output: distance_km, osrm_duration_sec
│
├─► ML API (Port 5001): Predict traffic-aware ETA
│   Input:  distance_km, osrm_duration_sec, timestamp
│   Output: eta_minutes, confidence, traffic_info
│
└─► PostgreSQL: Save to tyb_analytics.eta_predictions
    ↓
React: Display "Tahmini Varış: 14 dakika"
```

---

## 📊 ML Training (One-Time Setup)

**Data Source:** İstanbul Büyükşehir Belediyesi Open Data  
**Period:** January 2024 - January 2025 (13 months)  
**Records:** 20,129,348 GPS points  

### **Training Pipeline:**
```bash
# Phase 1: Aggregate 20M records → 168 patterns (24h × 7 days)
python scripts/phase1_ibb_aggregation.py

# Phase 2: Generate 2000 training samples with OSRM
python scripts/phase2_generate_training.py

# Phase 3: Train Gradient Boosting model
python scripts/phase3_train_model.py
# Output: models/eta_model_istanbul.pkl (99.98% accuracy)

# Phase 4: Deploy Flask API
python scripts/phase4_ml_api.py
```

**Model Performance:**
- Algorithm: Gradient Boosting Regressor
- Test MAE: 0.10 minutes (6 seconds)
- Test R²: 0.9998 (99.98% accuracy)
- Features: 9 (distance, time, İBB traffic patterns, OSRM duration)

---

## 🗄️ Database Schema

### **Table:** `tyb_analytics.eta_predictions`

```sql
CREATE TABLE tyb_analytics.eta_predictions (
    id UUID PRIMARY KEY,
    trip_id UUID,
    device_id UUID,
    prediction_time TIMESTAMP WITH TIME ZONE,
    predicted_arrival_time TIMESTAMP WITH TIME ZONE,
    current_location GEOMETRY(Point, 4326),  -- PostGIS
    destination GEOMETRY(Point, 4326),       -- PostGIS
    remaining_distance_km NUMERIC(10, 2),
    confidence_score NUMERIC(5, 2),
    traffic_factor NUMERIC(5, 2),
    model_version VARCHAR(50),
    metadata JSONB  -- Full ML response
);
```

---

## 🔧 .NET NuGet Packages (TYB.MLService)

```xml
<ItemGroup>
  <!-- ASP.NET Core -->
  <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
  <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
  
  <!-- Entity Framework Core + PostgreSQL + PostGIS -->
  <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
  <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />
  <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite" Version="8.0.0" />
  
  <!-- PostGIS Spatial Types -->
  <PackageReference Include="NetTopologySuite" Version="2.5.0" />
  <PackageReference Include="NetTopologySuite.IO.PostGis" Version="2.1.0" />
</ItemGroup>
```

**Install Commands:**
```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
dotnet add package NetTopologySuite
dotnet add package NetTopologySuite.IO.PostGis
```

---

## 🧪 API Testing

### **Health Check**
```bash
curl http://localhost:5200/api/eta/health
```

### **ETA Prediction**
```bash
curl -X POST http://localhost:5200/api/eta/predict \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "c9aa3b92-4136-4621-9cee-5957846e083f",
    "deviceId": "fcb3617f-7b6c-4d04-befc-485448b4adb9",
    "startLat": 41.08,
    "startLon": 29.05,
    "endLat": 41.042,
    "endLon": 29.008
  }'
```

**Response:**
```json
{
  "prediction_id": "ee35130f-...",
  "eta_hours": 0,
  "eta_minutes": 14,
  "eta_seconds": 889,
  "distance_km": 7.3,
  "confidence": 1.0,
  "traffic_info": {
    "is_rush_hour": false,
    "avg_speed_kmh": 54.1,
    "traffic_density": 46.8
  }
}
```

---

## 📈 Key Features

✅ **Traffic-Aware Predictions** - Real İBB Istanbul traffic patterns  
✅ **99.98% Accuracy** - MAE of only 6 seconds  
✅ **Real-time Routing** - OSRM with Turkey OSM map  
✅ **PostGIS Integration** - Geospatial queries on routes  
✅ **Microservice Architecture** - Decoupled ML, routing, backend  
✅ **Production Ready** - Docker containerized, scalable  

---

## 🛠️ Technologies

| Component | Technology |
|-----------|-----------|
| ML Model | Python, scikit-learn, Flask |
| Routing | OSRM, Docker |
| Backend | .NET 8, ASP.NET Core, EF Core |
| Database | PostgreSQL 15, PostGIS 3.4 |
| Frontend | Next.js, React, TypeScript |
| DevOps | Docker, Docker Compose |

---

## 📝 Configuration

### **appsettings.json (TYB.MLService)**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=tyb_production;Username=postgres;Password=***"
  },
  "MLApi": {
    "BaseUrl": "http://localhost:5001"
  },
  "Osrm": {
    "BaseUrl": "http://localhost:5000"
  }
}
```

---

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| `Connection refused to port 5000` | Start OSRM Docker container |
| `ML API not found` | Start Flask API (phase4_ml_api.py) |
| `Database connection failed` | Check PostgreSQL connection string |
| `Query string malformed` | Ensure CultureInfo.InvariantCulture for decimals |

---

## 📦 Project Repositories

- **ML Training & API:** `TYB_ML_ETA/`
- **.NET Backend:** `track-your-best-product/backend/`
- **React Frontend:** `track-your-best-product/frontend/`

---
