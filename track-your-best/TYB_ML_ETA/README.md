# TRACK YOUR BEST - ML ETA Prediction System
# Istanbul Traffic-Aware ETA Prediction

## 📁 PROJE YAPISI

```
TYB_ML_ETA/
│
├── scripts/                          # Python script'ler
│   ├── phase1_ibb_aggregation.py
│   ├── phase2_generate_training.py
│   ├── phase3_train_model.py
│   └── phase4_ml_api.py
│
├── data/                             # Veri dosyaları
│   ├── ibb_raw/                      # İBB CSV'ler (INPUT)
│   │   ├── traffic_density_202401.csv
│   │   ├── traffic_density_202402.csv
│   │   ├── ...
│   │   └── traffic_density_202501.csv
│   │
│   └── processed/                    # İşlenmiş datalar (OUTPUT)
│       ├── ibb_traffic_patterns_2024_2025.csv
│       └── istanbul_eta_training.csv
│
├── models/                           # ML model'ler (OUTPUT)
│   ├── eta_model_istanbul.pkl
│   └── visualizations/
│       ├── model_actual_vs_predicted.png
│       ├── model_feature_importance.png
│       └── model_error_distribution.png
│
├── requirements.txt
└── README.md
```

---

## 📊 VERİ SETİ

İBB 2024-2025 Trafik Yoğunluk Verileri (13 CSV):
- Ocak 2024 - Aralık 2024 (12 ay)
- Ocak 2025 (1 ay)

**Dosya İsimleri:**
```
traffic_density_202401.csv
traffic_density_202402.csv
traffic_density_202403.csv
...
traffic_density_202412.csv
traffic_density_202501.csv
```

**CSV Format:**
```
DATE_TIME, LATITUDE, LONGITUDE, GEOHASH, MINIMUM_SPEED, MAXIMUM_SPEED, AVERAGE_SPEED, NUMBER_OF_VEHICLES
```

---

## 🚀 KURULUM

### 1. Klasör Yapısını Oluştur

```powershell
cd Desktop
mkdir TYB_ML_ETA
cd TYB_ML_ETA

# Alt klasörleri oluştur
mkdir scripts
mkdir data
mkdir data\ibb_raw
mkdir data\processed
mkdir models
mkdir models\visualizations
```

### 2. Script'leri Kopyala

`scripts/` klasörüne şu dosyaları kopyala:
- `phase1_ibb_aggregation.py`
- `phase2_generate_training.py`
- `phase3_train_model.py`
- `phase4_ml_api.py`

### 3. CSV Dosyalarını Kopyala

13 İBB CSV dosyanı `data/ibb_raw/` klasörüne kopyala:
```
traffic_density_202401.csv → data/ibb_raw/
traffic_density_202402.csv → data/ibb_raw/
...
traffic_density_202501.csv → data/ibb_raw/
```

### 4. Python Dependencies

```powershell
pip install -r requirements.txt
```

### 5. OSRM Server

OSRM server'ın çalıştığından emin olun:
```
http://localhost:5000
```

---

## 📋 ÇALIŞTIRMA ADIMLARI

### PHASE 1: İBB Traffic Data Aggregation (20 dakika)

```powershell
cd TYB_ML_ETA
python scripts/phase1_ibb_aggregation.py
```

**Çıktı:**
- `data/processed/ibb_traffic_patterns_2024_2025.csv` (168 rows)

**Beklenen:**
- ~35-40 milyon kayıt işlenir
- 168 temporal pattern (24h × 7d)
- Traffic statistics

---

### PHASE 2: Generate Training Data (30 dakika)

```powershell
python scripts/phase2_generate_training.py
```

**Çıktı:**
- `data/processed/istanbul_eta_training.csv` (2000 samples)

**Ne Yapar:**
- 15 İstanbul POI arasında random route'lar
- OSRM'den distance + duration
- İBB traffic pattern'ları ile birleştirir

---

### PHASE 3: Train ML Model (5 dakika)

```powershell
python scripts/phase3_train_model.py
```

**Çıktı:**
- `models/eta_model_istanbul.pkl`
- `models/visualizations/model_actual_vs_predicted.png`
- `models/visualizations/model_feature_importance.png`
- `models/visualizations/model_error_distribution.png`

**Beklenen Performans:**
- MAE: 4-6 dakika
- R²: 0.80-0.90
- Within 5 min: >80%

---

### PHASE 4: Deploy ML API (Continuous)

```powershell
python scripts/phase4_ml_api.py
```

**Server:**
- Host: 0.0.0.0
- Port: 5001

**Endpoints:**

#### 1. Health Check
```bash
GET http://localhost:5001/health
```

#### 2. ETA Prediction
```bash
POST http://localhost:5001/predict_eta
Content-Type: application/json

{
  "distance_km": 15.5,
  "osrm_duration_sec": 1200,
  "timestamp": "2025-02-25 14:30:00"
}
```

**Response:**
```json
{
  "eta_minutes": 18.5,
  "eta_seconds": 1110,
  "eta_hours": 0,
  "eta_minutes_display": 18,
  "confidence": 0.85,
  "traffic_info": {...}
}
```

---

## 🔗 .NET INTEGRATION

### C# Example:

```csharp
using System.Net.Http;
using System.Text.Json;

public class EtaPredictionService
{
    private readonly HttpClient _httpClient;
    
    public EtaPredictionService()
    {
        _httpClient = new HttpClient();
        _httpClient.BaseAddress = new Uri("http://localhost:5001");
    }
    
    public async Task<EtaPrediction> PredictEta(
        double distanceKm, 
        int osrmDurationSec, 
        DateTime timestamp)
    {
        var request = new
        {
            distance_km = distanceKm,
            osrm_duration_sec = osrmDurationSec,
            timestamp = timestamp.ToString("yyyy-MM-dd HH:mm:ss")
        };
        
        var response = await _httpClient.PostAsJsonAsync("/predict_eta", request);
        response.EnsureSuccessStatusCode();
        
        return await response.Content.ReadFromJsonAsync<EtaPrediction>();
    }
}
```

---

## 💾 DATABASE INTEGRATION

### Save to PostgreSQL (tyb_analytics.eta_predictions):

```csharp
public async Task SaveEtaPrediction(
    Guid tripId, 
    Guid deviceId,
    EtaPrediction prediction,
    Point currentLocation,
    Point destination)
{
    using var conn = new NpgsqlConnection(_connectionString);
    await conn.OpenAsync();
    
    var query = @"
        INSERT INTO tyb_analytics.eta_predictions (
            trip_id, device_id, prediction_time, predicted_arrival_time,
            current_location, destination, remaining_distance_km,
            model_version, confidence_score, metadata
        ) VALUES (
            @tripId, @deviceId, @predictionTime, @predictedArrival,
            @currentLocation, @destination, @remainingDistance,
            @modelVersion, @confidence, @metadata::jsonb
        )";
    
    var predictedArrival = DateTime.Now.AddSeconds(prediction.eta_seconds);
    
    await conn.ExecuteAsync(query, new
    {
        tripId,
        deviceId,
        predictionTime = DateTime.Now,
        predictedArrival,
        currentLocation = currentLocation,
        destination = destination,
        remainingDistance = prediction.distance_km,
        modelVersion = "istanbul_v1",
        confidence = prediction.confidence,
        metadata = JsonSerializer.Serialize(new {
            eta_hours = prediction.eta_hours,
            eta_minutes = prediction.eta_minutes_display,
            traffic_info = prediction.traffic_info
        })
    });
}
```

---

## 📊 PERFORMANS BEKLENTİLERİ

### Model Accuracy:
- MAE: 4-6 dakika
- R²: 0.80-0.90
- Within 5 min: >80%
- Within 10 min: >95%

### Training Time:
- Phase 1: ~20 min
- Phase 2: ~30 min
- Phase 3: ~5 min
- **Total: ~55 minutes**

---

## 🐛 TROUBLESHOOTING

### CSV Not Found:
```
Error: CSV dosyası bulunamadı
```
**Çözüm:** CSV dosyalarını `data/ibb_raw/` klasörüne koyun

### OSRM Connection Error:
```
Error: Connection refused to http://localhost:5000
```
**Çözüm:** OSRM server'ı başlatın

### Model Not Loaded:
```
Error: Model not loaded
```
**Çözüm:** Phase 3'ü çalıştırın: `python scripts/phase3_train_model.py`

---

## 🎓 JÜRİ SUNUMU

**Vurgulanacak Noktalar:**

1. **Veri Seti:**
   - İBB 2024-2025 (13 ay)
   - ~35 milyon kayıt
   - Organized folder structure

2. **Model:**
   - Gradient Boosting Regressor
   - 9 feature (İBB traffic patterns included)
   - MAE: ~5 dakika

3. **Entegrasyon:**
   - REST API (Flask)
   - PostgreSQL database
   - .NET backend ready

---

**Created by:** Track Your Best Team  
**Date:** February 2025  
**Version:** 2.0 (Updated with folder structure)