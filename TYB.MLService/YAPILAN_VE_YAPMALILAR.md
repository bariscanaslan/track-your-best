# 🎯 TYB.MLService - NE YAPILIYOR? NE YAPILMALI?

## ✅ YAPILAN İŞLER

### 1. ✅ Model Oluşturma (Python Training Scripts)
```
trainforest.py
  → Random Forest modeli eğitim
  → Output: Legacy reference: Models/driver_iforest.onnx (current code path uses `models_bin/driver_scoring_model.pkl`)

train_anomaly_detection.py
  → IsolationForest modeli eğitim
  → Output: Models/anomaly/driver_anomaly_detection.onnx (1.8 MB)
```
**DURUM: ✅ Modeller eğitilmiş ve ONNX formatına dönüştürülmüş**

---

### 2. ✅ Modelleri Dosyalara Atma
```
Models/
├── driver_iforest.onnx               ⚠️ Legacy asset
├── model_meta.json                   ✅ Kopyalandı
└── anomaly/
    ├── driver_anomaly_detection.onnx ✅ Kopyalandı
    └── anomaly_metadata.json         ✅ Kopyalandı

TYB.MLService/models_bin/
├── driver_iforest.onnx               ⚠️ Legacy asset
└── model_meta.json                   ✅ Kopyalandı
```
**DURUM: ✅ Modeller hem Models/ hem TYB.MLService/models_bin/ klasörlerinde**

---

### 3. ✅ Database Bağlantısı (SQLAlchemy)
```python
# db/database.py
├─ create_engine(DATABASE_URL)      ✅ Yapılmış
├─ SessionLocal = sessionmaker()    ✅ Yapılmış
└─ get_db() context manager         ✅ Yapılmış

# db/models.py
├─ class Trip                       ✅ Tanımlandı
├─ class GpsData                    ✅ Tanımlandı
├─ class DriverScore                ✅ Tanımlandı
└─ class Anomaly                    ✅ Tanımlandı
```
**DURUM: ✅ Database bağlantısı tamamen hazır**

---

### 4. ✅ Aradaki İletişim (Data Flow)
```
GPS Veri (tyb_spatial.trips & gps_data) → Python okur
                                          ↓
                              Feature Extraction (preprocessing.py)
                                          ↓
                              4 Özellik: p95_speed, harsh_accel/h, harsh_brake/h, stop_count/h
                              10 Özellik: GPS spike, velocity, accel, jerk, idle, duration...
                                          ↓
                              ONNX Model (driver_scorer.py)
                              IsolationForest (anomaly_detector.py)
                                          ↓
                              ML Score (0-100) + Anomaly Score (0-100)
                                          ↓
                              tyb_analytics.driver_scores kaydet
                              tyb_analytics.anomalies kaydet
```
**DURUM: ✅ Tüm iletişim kodu hazır**

---

## 🔴 HENÜZ YAPILMAMIŞ İŞLER

### ❌ 1. SQL Script'leri Yazılmadı
Sen şunları yazman lazım:
```sql
-- 1. Test veri ekleme script'i (GPS + Trip data)
INSERT INTO tyb_spatial.trips (device_id, driver_id, vehicle_id, ...) VALUES (...);
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, ...) VALUES (...);

-- 2. Sonuçları görüntüleme script'i
SELECT * FROM tyb_analytics.driver_scores;
SELECT * FROM tyb_analytics.anomalies;
```

### ❌ 2. Python Service Çalıştırılmadı
```bash
python TYB.MLService/main.py
```
Bu komutu çalıştırman lazım ki:
- APScheduler başlasın
- Jobs çalışsın
- Modeli yükleyip tahmin yapsın
- Sonuçları veritabanına yazsın

### ❌ 3. Sonuçlar Veritabanında Yoksa
```sql
SELECT COUNT(*) FROM tyb_analytics.driver_scores;  -- 0 olması normal
SELECT COUNT(*) FROM tyb_analytics.anomalies;      -- 0 olması normal
```
(Service çalıştırılmadan sonra artar)

---

## 🎯 ADIM ADIM NE YAPMAN LAZIM?

### ADIM 1: Python Service'i Kur
```bash
cd C:\Projects\ML2\TYB.MLService
pip install -r requirements.txt
```

### ADIM 2: .env Dosyasını Düzenle
```ini
DATABASE_URL=postgresql://postgres:password@localhost:5432/tyb_production
LOG_LEVEL=INFO
```

### ADIM 3: Test Veri Ekle (SQL Script)
```sql
-- Test 1: Perfect Driver
INSERT INTO tyb_spatial.trips (device_id, driver_id, vehicle_id, status, start_time, end_time)
VALUES (uuid-1, uuid-2, uuid-3, 'completed', NOW() - INTERVAL '1 hour', NOW());

-- 900 GPS noktası ekle (15 dakika, 25 m/s sabit hız)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, gps_timestamp, location)
VALUES (...) -- 900 satır
```

### ADIM 4: Service'i Başlat
```bash
python TYB.MLService/main.py
```

**Ekran çıktısı:**
```
✅ Anomali Job eklendi (interval: 120s)
✅ Driver Scoring Job eklendi (interval: 300s)
✅ Scheduler başlatıldı
⏳ Service çalışıyor... (CTRL+C ile kapatmak için)

[2 dakika sonra...]
📈 Trip UUID: Score=95.23/100
🚨 Trip UUID: AnomalyScore=15.42, Severity=LOW
```

### ADIM 5: Sonuçları Kontrol Et
```sql
-- Puanlar
SELECT trip_id, overall_score FROM tyb_analytics.driver_scores;

-- Anomaliler
SELECT trip_id, severity, anomaly_score FROM tyb_analytics.anomalies;
```

---

## 📝 İHTİYAÇ DUYULAN SQL SCRIPT'LERİ

Şu dosyaları oluşturman lazım:

### 1. `test_data_insert.sql` - Test Veri Ekleme
```sql
-- Perfect Driver veri ekle
-- Aggressive Driver veri ekle
-- Normal Driver veri ekle
```

### 2. `verify_results.sql` - Sonuç Kontrol
```sql
-- Driver Scores sorgula
-- Anomalies sorgula
-- Karşılaştırma ve doğrulama
```

---

## 📊 ÖZET: NE YAPILIYOR?

| İşlem | Status | Kim Yapıyor |
|-------|--------|-------------|
| Model eğitimi | ✅ YAPILDI | Python (trainforest.py) |
| Model dosya kaydı | ✅ YAPILDI | Python (joblib/ONNX) |
| DB bağlantısı | ✅ YAPILDI | Python (SQLAlchemy) |
| Feature extraction | ✅ YAPILDI | Python (preprocessing.py) |
| ML prediction | ✅ YAPILDI | Python (driver_scorer.py) |
| Anomali detection | ✅ YAPILDI | Python (anomaly_detector.py) |
| **Test veri ekleme** | ❌ YAPILMADI | **SEN** (SQL script) |
| **Service çalıştırma** | ❌ YAPILMADI | **SEN** (python main.py) |
| **Sonuçları görüntüleme** | ❌ YAPILMADI | **SEN** (SQL query) |

---

## 🚀 HEMEN ŞU KODU ÇALIŞTIRabilirsin:

```bash
# 1. Dependencies kur
pip install -r TYB.MLService/requirements.txt

# 2. Service başlat
cd TYB.MLService
python main.py

# 3. BAŞKA BİR TERMİNALDE test verileri ekle
psql -U postgres -d tyb_production -f test_ml_scoring.sql

# 4. Sonuçları kontrol et
psql -U postgres -d tyb_production
SELECT * FROM tyb_analytics.driver_scores;
SELECT * FROM tyb_analytics.anomalies;
```

---

## 📄 README MI İSTİYORSUN?

Şimdi yazayım mı? Tam olarak senin ihtiyacına göre?

Bana şunları söyle:
1. ✅ Test veri ekleme script'i yazayım mı?
2. ✅ SQL sonuç kontrol script'i yazayım mı?
3. ✅ Komple README yazayım mı?
4. ✅ Quick Start rehberi yazayım mı?

**ÖNERİM:** Hepsini yaz! 👇

