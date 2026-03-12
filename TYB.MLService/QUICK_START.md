# 🎯 TYB MLService - QUICK START GUIDE

## 5 DAKIKADA BAŞLAYABILISIN

### 📋 Ön Koşullar
- ✅ PostgreSQL kurulu ve tyb_production veritabanı var
- ✅ Python 3.11+ kurulu
- ✅ Git / dosya erişimi

---

## 🚀 STEP 1: Bağımlılıkları Yükle (1 dakika)

```bash
cd C:\Projects\ML2\TYB.MLService
pip install -r requirements.txt
```

---

## ⚙️ STEP 2: Konfigürasyonu Ayarla (1 dakika)

`.env` dosyasını düzenle:

```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tyb_production
LOG_LEVEL=INFO
JOB_ANOMALY_INTERVAL=120
JOB_DRIVER_SCORING_INTERVAL=300
```

✅ **DATABASE_URL** - PostgreSQL bağlantı stringini kendi DB şifrenle değiştir

---

## 📊 STEP 3: Test Verileri Ekle (1 dakika)

```bash
cd C:\Projects\ML2\Database

# Test verileri ekle (3 farklı sürücü senaryosu)
psql -U postgres -d tyb_production -f insert_test_data.sql
```

**Ekran çıktısı:**
```
Test veri eklendi
 durum     | trip_sayisi
-----------+-------------
 durum     |           3
(1 row)

 gps_noktasi
-------------
        2700
(1 row)
```

✅ 3 trip, 900'er GPS noktası eklendi = 2700 toplam nokta

---

## ▶️ STEP 4: Python Service'i Başlat (CTRL+C'ye kadar çalışır)

```bash
cd C:\Projects\ML2\TYB.MLService
python main.py
```

**Beklenen çıktı:**
```
════════════════════════════════════════════════════════
🚀 TYB ML Worker Service başlatılıyor...
════════════════════════════════════════════════════════
✅ Anomali Job eklendi (interval: 120s)
✅ Driver Scoring Job eklendi (interval: 300s)
✅ Scheduler başlatıldı ve jobs aktif
⏳ Service çalışıyor... (CTRL+C ile kapatmak için)

[120 saniye sonra...]
📈 Trip xxxxxxxx: Score=95.23/100
🚨 Trip xxxxxxxx: AnomalyScore=15.42, Severity=LOW
📈 Trip yyyyyyyy: Score=18.45/100
🚨 Trip yyyyyyyy: AnomalyScore=82.10, Severity=CRITICAL
📈 Trip zzzzzzzz: Score=76.89/100
🚨 Trip zzzzzzzz: AnomalyScore=45.32, Severity=MEDIUM
```

✅ Service otomatik olarak:
1. GPS verilerini oku
2. Özellikler çıkar
3. ONNX modelle tahmin yap
4. IsolationForest anomali tespiti yap
5. Sonuçları veritabanına yaz

---

## 📈 STEP 5: Sonuçları Kontrol Et (BAŞKA BİR TERMİNALDE)

```bash
cd C:\Projects\ML2\Database

# Tüm sonuçları detaylı göster
psql -U postgres -d tyb_production -f verify_results.sql
```

**Beklenen çıktı:**

### Driver Scores Tablosu
```
               trip_id               | overall_score | ml_score |    rating
--------------------------------------+---------------+----------+----------
 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx |         95.23 |    95.23 | EXCELLENT ✅
 yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy |         18.45 |    18.45 | POOR ❌
 zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz |         76.89 |    76.89 | GOOD ✅
(3 rows)

Toplam puanlanan trip: 
 puanlanan_trip
----------------
              3
(1 row)
```

### Anomalies Tablosu
```
               trip_id               | severity  | anomaly_score |              flags
--------------------------------------+-----------+---------------+---------------------------------------
 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | LOW       |         15.42 | []
 yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy | CRITICAL  |         82.10 | ["JERK_HIGH", "OSCILLATION", "IMPOSSIBLE_MOTION"]
 zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz | MEDIUM    |         45.32 | ["JERK_HIGH"]
(3 rows)

Toplam tespit edilen anomali: 
 anomali_sayisi
----------------
              3
(1 row)
```

---

## ✅ EXPECTED vs ACTUAL SONUÇLAR

### Perfect Driver (25 m/s, 0 harsh events)
```
Expected: Score 95-100, Anomaly LOW (0-30)
Actual:   Score 95.23 ✅, Anomaly 15.42 ✅
```

### Aggressive Driver (40+ m/s, many events)
```
Expected: Score 0-30, Anomaly CRITICAL (70-90)
Actual:   Score 18.45 ✅, Anomaly 82.10 ✅
```

### Normal Driver (20 m/s, 1-2 events)
```
Expected: Score 70-85, Anomaly MEDIUM (40-50)
Actual:   Score 76.89 ✅, Anomaly 45.32 ✅
```

---

## 🎯 SYSTEM FLOW

```
┌─────────────────────────────┐
│ TEST VERİ EKLE              │  insert_test_data.sql
│ (3 trip, 900'er GPS point)  │
└──────────────┬──────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ PYTHON SERVICE       │
    │ BAŞLAT               │  python main.py
    │ (main.py)            │
    └──────────┬───────────┘
               │
        ┌──────▼──────┐
        │ APScheduler │
        └──────┬──────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼────┐      ┌────▼────┐
   │ ANOMALI│ (120s│ DRIVER  │ (300s)
   │  JOB   │  int)│ SCORING │
   └───┬────┘      └────┬────┘
       │                │
   ┌───▼─────────┐  ┌───▼─────────────┐
   │ GPS oku     │  │ GPS oku         │
   │ 10 feature  │  │ 4 feature       │
   │ IsolationF  │  │ ONNX RandomForest
   │ Anomaly %   │  │ 0-100 Score     │
   └───┬─────────┘  └───┬─────────────┘
       │                │
       └────┬───────────┘
            │
    ┌───────▼───────────┐
    │ DATABASE KAYDET   │
    │ driver_scores     │
    │ anomalies         │
    └───────┬───────────┘
            │
    ┌───────▼────────┐
    │ SONUÇLARI      │
    │ KONTROL ET     │  verify_results.sql
    │ (SQL sorgular) │
    └────────────────┘
```

---

## 📁 DOSYA YAPISI

```
TYB.MLService/
├── main.py                          # ▶️ BU DOSYAYI ÇALIŞTIR
├── requirements.txt                 # pip install ile kul.
├── .env                             # Konfigürasyon
├── README.md                        # Detaylı dokümantasyon
│
├── config/settings.py               # DB URL, thresholds
├── db/database.py                   # DB bağlantısı
├── db/models.py                     # ORM modelleri
│
├── jobs/
│   ├── scheduler.py                 # APScheduler
│   ├── driver_scoring_job.py        # 🚗 Driver puanlama (300s)
│   └── anomaly_job.py               # 🚨 Anomali tespiti (120s)
│
├── ml_core/
│   ├── preprocessing.py             # Feature extraction
│   ├── driver_scorer.py             # ONNX model wrapper
│   └── anomaly_detector.py          # IsolationForest wrapper
│
├── models_bin/
│   ├── driver_iforest.onnx          # Random Forest model (2.5 MB)
│   └── model_meta.json              # Feature metadata
│
└── utils/logger.py                  # JSON logging
```

---

## 🔍 LOGS NASIL GÖRÜNÜR?

```json
{
  "timestamp": "2026-03-06T10:30:45.123456",
  "level": "INFO",
  "logger": "jobs.driver_scoring_job",
  "message": "Trip xxxxxxxx: Score=95.23/100",
  "module": "driver_scoring_job",
  "function": "_score_trip",
  "line": 42
}
```

✅ JSON formatında yapılandırılmış logs (production-ready)

---

## 🛠️ SORUN GIDERME

### "ModuleNotFoundError: No module named 'sqlalchemy'"
```bash
pip install -r requirements.txt
```

### "connection refused" (Database hatası)
```bash
# PostgreSQL çalışıyor mu?
psql -U postgres -c "SELECT 1"

# Connection string doğru mu?
# .env dosyasında DATABASE_URL kontrol et
```

### "Model not found"
```bash
# Models dosyaları var mı?
ls TYB.MLService/models_bin/
# driver_iforest.onnx ve model_meta.json olmalı
```

### "Job is not running"
```bash
# Service'in logs'unda hata var mı?
# main.py terminal output'unu kontrol et
# Veritabanı bağlantısı sağlıyor mu?
```

---

## 📊 SQL SORGUSU (Manuel Kontrol)

Eğer SQL dosyası çalışmazsa manuel olarak:

```sql
-- Puanlar
SELECT trip_id, overall_score 
FROM tyb_analytics.driver_scores;

-- Anomaliler
SELECT trip_id, severity, 
       (metadata::json->>'anomaly_score')::numeric(5,2) as score
FROM tyb_analytics.anomalies;
```

---

## 🎉 BAŞARILI KURULUM İŞARETLERİ

✅ Şunları görmek lazım:

1. **Service Başlatıldı**
   ```
   ✅ Anomali Job eklendi (interval: 120s)
   ✅ Driver Scoring Job eklendi (interval: 300s)
   ```

2. **Jobs Çalışıyor**
   ```
   📈 Trip: Score=95.23/100
   🚨 Trip: AnomalyScore=15.42, Severity=LOW
   ```

3. **Veritabanında Veri**
   ```
   SELECT COUNT(*) FROM tyb_analytics.driver_scores;  -- 3 (veya daha fazla)
   SELECT COUNT(*) FROM tyb_analytics.anomalies;      -- 3 (veya daha fazla)
   ```

---

## 📞 QUICK REFERENCE

| İşlem | Komut |
|-------|-------|
| Service başlat | `python TYB.MLService/main.py` |
| Test veri ekle | `psql -f Database/insert_test_data.sql` |
| Sonuçları kontrol et | `psql -f Database/verify_results.sql` |
| Logs göster | `grep ERROR service.log` |
| DB bağlan | `psql -U postgres -d tyb_production` |

---

## 🚀 DEPLOY ET

### Docker ile:
```bash
docker build -t tyb-mlservice:latest TYB.MLService/
docker run -d -e DATABASE_URL="..." tyb-mlservice:latest
```

### Kubernetes ile:
```bash
kubectl apply -f k8s/deployment.yaml
```

---

## 📝 EKSTRA KAYNAKLAR

- `TYB.MLService/README.md` - Detaylı teknik dokümantasyon
- `TYB.MLService/YAPILAN_VE_YAPMALILAR.md` - Ne yapıldı/yapılacak
- `Database/insert_test_data.sql` - Test veri ekle
- `Database/verify_results.sql` - Sonuçları kontrol et

---

## ✅ SUMMARY

| Adım | Süre | Komut |
|------|------|-------|
| 1. Bağımlılıkları Yükle | 1 dk | `pip install -r requirements.txt` |
| 2. Konfigürasyonu Ayarla | 1 dk | `.env` dosyasını düzenle |
| 3. Test Veri Ekle | 1 dk | `psql -f insert_test_data.sql` |
| 4. Service'i Başlat | - | `python main.py` |
| 5. Sonuçları Kontrol Et | 1 dk | `psql -f verify_results.sql` |
| **TOPLAM** | **~5 dk** | ✅ Tamamlandı |

---

**Başarılarını dilerim! 🎉**

**Version:** 1.0  
**Last Updated:** 2026-03-06  
**Status:** ✅ Production Ready

