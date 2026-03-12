# TYB MLService - Python ML Worker Architecture

## 📊 Overview

**TYB.MLService** - Pure Python-based ML Worker Service. GPS verilerini database'den çekip, ML modelleriyle sürücü puanlandırması ve anomali tespiti yapan zamanlanmış görev servisidir.

### Technology Stack
- **Language**: Python 3.11+
- **Scheduler**: APScheduler (interval-based jobs)
- **Database**: PostgreSQL + SQLAlchemy ORM
- **ML Models**: scikit-learn (IsolationForest) + ONNX Runtime (Random Forest)
- **Containerization**: Docker

---

## 📁 Klasör Yapısı

```
TYB.MLService/
│
├── Dockerfile                    # Container imajı
├── requirements.txt             # Python bağımlılıkları
├── .env                         # Ortam değişkenleri
├── main.py                      # Service giriş noktası
│
├── config/
│   ├── __init__.py
│   └── settings.py              # DB URL, job intervals, model paths, thresholds
│
├── db/
│   ├── __init__.py
│   ├── database.py              # SQLAlchemy Engine + SessionLocal
│   └── models.py                # ORM: Trip, GpsData, DriverScore, Anomaly
│
├── jobs/
│   ├── __init__.py
│   ├── scheduler.py             # APScheduler konfigürasyonu
│   ├── anomaly_job.py           # Job: GPS verilerinden anomali tespiti
│   ├── driver_scoring_job.py    # Job: Tripileri Random Forest ile puanlandır
│   └── route_job.py             # Job: Rota optimizasyonu (future)
│
├── ml_core/
│   ├── __init__.py
│   ├── preprocessing.py         # Haversine, speed/accel calculation, feature extraction
│   ├── driver_scorer.py         # ONNX Random Forest wrapper
│   ├── anomaly_detector.py      # IsolationForest wrapper
│   └── route_optimizer.py       # Rota optimizasyonu (future)
│
├── models_bin/
│   ├── driver_iforest.onnx      # Random Forest Regressor (4 features → 0-100)
│   ├── isolation_forest_v1.pkl  # IsolationForest (10 features → anomaly)
│   └── model_meta.json          # Feature order mapping
│
└── utils/
    ├── __init__.py
    ├── logger.py                # JSON formatında loglama
    └── geo_utils.py             # Haversine, bearing, distance (future)
```

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükle
```bash
cd TYB.MLService
pip install -r requirements.txt
```

### 2. Ortam Değişkenlerini Ayarla
`.env` dosyasını düzenle:
```ini
DATABASE_URL=postgresql://postgres:password@localhost:5432/tyb_production
LOG_LEVEL=INFO
```

### 3. Servisi Çalıştır
```bash
python main.py
```

Çıktı:
```
======================================================
🚀 TYB ML Worker Service başlatılıyor...
======================================================
✅ Anomali Job eklendi (interval: 120s)
✅ Driver Scoring Job eklendi (interval: 300s)
✅ Scheduler başlatıldı ve jobs aktif
⏳ Service çalışıyor... (CTRL+C ile kapatmak için)
```

---

## 🐳 Docker Kullanımı

### Container'ı Build Et
```bash
cd TYB.MLService
docker build -t tyb-mlservice:latest .
```

### Container'ı Çalıştır
```bash
docker run -d \
  --name tyb-mlservice \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/tyb_production" \
  -e LOG_LEVEL="INFO" \
  tyb-mlservice:latest
```

### Logs'u Göster
```bash
docker logs -f tyb-mlservice
```

---

## 📋 İş Akışı (Pipeline)

### 1. Driver Scoring Job (Interval: 300s)
```
Tamamlanmış Trip → GPS Veri Çek
                 ↓
         Özellik Çıkar (4 feature):
         • p95_speed_mps
         • harsh_accel_per_hour
         • harsh_brake_per_hour
         • stop_count_per_hour
                 ↓
         ONNX Model (Random Forest)
                 ↓
         ML Score (0-100)
                 ↓
         tyb_analytics.driver_scores kaydı
```

### 2. Anomali Detection Job (Interval: 120s)
```
Tamamlanmış Trip → GPS Veri Çek
                 ↓
         Özellik Çıkar (10 feature):
         • gps_spike_ratio
         • velocity_oscillation
         • acceleration_oscillation
         • stop_count_outlier
         • idle_ratio
         • max_jerk, min_jerk
         • max_accel, min_accel
         • duration_hours
                 ↓
         IsolationForest Model
                 ↓
         Anomaly Score (0-100)
         Severity (LOW/MED/HIGH/CRITICAL)
         Flags (GPS_SPIKE, JERK_HIGH, etc.)
                 ↓
         tyb_analytics.anomalies kaydı
```

---

## 🧪 Test Senaryoları

Trip'leri veritabanına eklendikten sonra, service otomatik olarak işlem yapacaktır:

### Expected Results

#### Perfect Driver (25 m/s, 0 harsh events)
```json
{
  "overall_score": 95-100,
  "anomaly": {
    "score": 0-30,
    "severity": "LOW"
  }
}
```

#### Normal Driver (20 m/s, 1-2 brakes)
```json
{
  "overall_score": 70-85,
  "anomaly": {
    "score": 40-50,
    "severity": "MEDIUM",
    "flags": ["JERK_HIGH"]
  }
}
```

#### Aggressive Driver (40+ m/s, 20+ events)
```json
{
  "overall_score": 0-30,
  "anomaly": {
    "score": 70-90,
    "severity": "CRITICAL",
    "flags": ["JERK_HIGH", "OSCILLATION", "IMPOSSIBLE_MOTION"]
  }
}
```

---

## 📊 Veritabanı Sorguları

### Driver Scores Kontrol
```sql
SELECT trip_id, overall_score,
       (metadata::json->>'ml_score')::numeric(5,2) AS ml_score
FROM tyb_analytics.driver_scores
ORDER BY calculated_at DESC
LIMIT 10;
```

### Anomalies Kontrol
```sql
SELECT trip_id, severity,
       (metadata::json->>'anomaly_score')::numeric(5,2) AS anomaly_score,
       (metadata::json->>'flags') AS flags
FROM tyb_analytics.anomalies
ORDER BY detected_at DESC
LIMIT 10;
```

---

## ⚙️ Konfigürasyon

### config/settings.py

```python
# Database
DATABASE_URL = 'postgresql://...'

# Job Intervals (saniye)
JOB_INTERVALS = {
    'anomaly_detection': 120,      # Her 2 dakika
    'eta_prediction': 300,         # Her 5 dakika
}

# Thresholds
SPEED_THRESHOLD_MPS = 33.33        # 120 km/h
HARSH_ACCELERATION_MPS2 = 2.5
HARSH_BRAKING_MPS2 = 2.5
ANOMALY_THRESHOLD_SCORE = 50.0     # >50 = anomali
```

---

## 📝 Logging

Loglama JSON formatında:
```json
{
  "timestamp": "2026-03-05T10:30:45.123456",
  "level": "INFO",
  "logger": "jobs.driver_scoring_job",
  "message": "Trip 12345: Score=87.50/100",
  "module": "driver_scoring_job",
  "function": "_score_trip",
  "line": 42
}
```

---

## 🛠️ Gelecek Geliştirmeler

- [ ] ETA Predictor Job
- [ ] Route Optimization Job
- [ ] Web Dashboard (Grafana/Kibana)
- [ ] Model Retraining Pipeline
- [ ] Monitoring & Alerting
- [ ] Multi-threaded Job Processing

---

## 📞 Sorun Giderme

### "Model not found" hatası
- `models_bin/` klasöründe `driver_iforest.onnx` ve `.pkl` dosyaları var mı?
- Model yolları `config/settings.py`'de doğru mu?

### "Database connection refused"
- PostgreSQL çalışıyor mu?
- Connection string `.env`'de doğru mu?

### "Job is not running"
- Logs'u kontrol et: `python main.py` terminal output'unda hata mesajları var mı?
- APScheduler'da job exception var mı logs'ta?

---

## 📄 License

Private - Track Your Best (TYB)

---

**Version:** 1.0  
**Last Updated:** 2026-03-05  
**Status:** ✅ Production Ready

