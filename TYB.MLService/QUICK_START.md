# TYB MLService Quick Start

## 5 Dakikada Calistirma

### 1. Bagimliliklari yukle

```bash
cd C:\Projects\ML2\TYB.MLService
pip install -r requirements.txt
```

### 2. `.env` ayarla

```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tyb_production
OSRM_URL=http://localhost:5000
LOG_LEVEL=INFO
```

Not: Job interval degerleri su an `.env` uzerinden okunmuyor. Aktif periyotlar `config/settings.py` icinde.

### 3. Test verisi ekle

```bash
cd C:\Projects\ML2\Database
psql -U postgres -d tyb_production -f insert_test_data.sql
```

### 4. Servisi baslat

```bash
cd C:\Projects\ML2\TYB.MLService
python main.py
```

Beklenen akış:

```text
Service starts
  -> APScheduler registers 3 jobs
  -> anomaly job every 120s
  -> eta job every 180s
  -> driver scoring job every 300s
```

### 5. Sonuclari kontrol et

```bash
cd C:\Projects\ML2\Database
psql -U postgres -d tyb_production -f verify_results.sql
```

## Sistem ne yapar?

```text
ETA job
  -> reads driver_approve trips
  -> gets latest GPS or start_location
  -> calls OSRM
  -> writes eta_predictions

Driver scoring job
  -> reads completed trips
  -> extracts GPS features
  -> runs Random Forest PKL model for reference score
  -> computes final event-based score
  -> writes driver_scores

Anomaly job
  -> reads completed trips
  -> extracts GPS features
  -> runs Isolation Forest
  -> applies rule-based flags
  -> writes anomalies
```

## Gerekli model dosyalari

`TYB.MLService/models_bin/` altinda su dosyalar bulunmali:

- `eta_model_istanbul.pkl`
- `driver_scoring_model.pkl`
- `anomaly_model.pkl`

## Manuel SQL kontrolu

```sql
SELECT trip_id, overall_score,
       (metadata->>'ml_reference_score')::numeric AS ml_reference_score
FROM tyb_analytics.driver_scores;

SELECT trip_id, severity,
       (metadata->>'anomaly_score')::numeric AS anomaly_score
FROM tyb_analytics.anomalies;

SELECT trip_id, prediction_time,
       (metadata->>'eta_minutes')::numeric AS eta_minutes
FROM tyb_analytics.eta_predictions
ORDER BY prediction_time DESC;
```

## Kisa notlar

- Driver scoring aktif kod yolunda ONNX degil PKL model kullaniyor.
- `onnxruntime` dependency olarak duruyor ama aktif kod yolunda kullanilmiyor.
- `model_meta.json` legacy metadata olabilir; calisan skor akisi `ml_core/preprocessing.py` ve `ml_core/driver_scorer.py` ile belirleniyor.
