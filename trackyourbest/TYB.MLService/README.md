# TYB.MLService

Python-based background worker service for the Track Your Best (TYB) platform. It runs three scheduled ML/analytics jobs that process trip data and write results back to the shared PostgreSQL database.

---

## Why This Service Exists

The main backend (`TYB.ApiService`) handles real-time data ingestion and request/response logic. Heavy analytics work — scoring drivers, detecting anomalies, predicting ETAs — is offloaded to this service so it runs asynchronously without blocking the API.

This service reads from the same PostgreSQL database the backend writes to and inserts analytics results into the `tyb_analytics` schema.

---

## Architecture Summary

```
main.py
  └── JobScheduler (APScheduler BackgroundScheduler)
        ├── AnomalyDetectionJob       — every 120 seconds
        ├── DriverScoringJob          — every 300 seconds
        └── ETAPredictionJob          — every 20 seconds
```

The service is a single Python process. It runs a blocking `while True: time.sleep(1)` loop after the scheduler starts. Shutdown is handled via `SIGINT` / `SIGTERM` signal handlers that call `scheduler.stop()`.

There is no HTTP server, no REST API, no message queue. Everything is driven by the scheduler polling the database.

---

## Background Jobs and Intervals

All intervals are defined in `config/settings.py` under `JOB_INTERVALS`. They are not configurable via environment variables at runtime — they are hardcoded in the dict and passed to APScheduler `IntervalTrigger`.

| Job | Handler | Interval | Source constant |
|-----|---------|----------|-----------------|
| Anomaly Detection | `anomaly_job_handler` | **120 seconds** | `JOB_INTERVALS['anomaly_detection']` |
| Driver Scoring | `driver_scoring_job_handler` | **300 seconds** | `JOB_INTERVALS['driver_scoring']` |
| ETA Prediction | `eta_prediction_job_handler` | **20 seconds** | `JOB_INTERVALS['eta_prediction']` |

All three jobs are configured with `coalesce=True` and `max_instances=1`, meaning if a job run takes longer than its interval, the next firing is skipped rather than stacked.

The `.env` file contains commented-out `JOB_*_INTERVAL` lines — these are **not** read by the application. The only way to change intervals is to edit `JOB_INTERVALS` in `config/settings.py`.

---

## ETA Prediction Flow

**File:** `jobs/eta_prediction_job.py`, `ml_core/eta_predictor.py`

**Trigger:** Every 20 seconds.

**Purpose:** For every ongoing trip that started within the last 2 days, predict how many minutes remain until the driver reaches the destination.

### Step-by-step

1. `ETAPredictionJob.run()` opens a DB session and calls `get_pending_trips(session)`.
2. `get_pending_trips` queries `tyb_spatial.trips` for rows where:
   - `status = 'ongoing'`
   - `created_at >= now() - 2 days` (UTC naive comparison)
3. Up to `ETA_BATCH_SIZE = 10` trips are processed per run.
4. For each trip, `_process_trip()` resolves the current vehicle position using this priority:
   - **Priority 1** — first coordinate of `trips.route_geometry` (LineString). The backend rewrites this every ~30 seconds via OSRM when it refreshes the live route.
   - **Priority 2** — most recent row in `tyb_spatial.gps_data` for this `trip_id`, ordered by `gps_timestamp DESC`.
   - **Priority 3** — static `trips.start_location` (Point).
5. `trips.total_distance_km` and `trips.duration_seconds` are read directly from the trip record. **No OSRM call is made by this service.** The backend populates these columns.
6. `ETAPredictor.predict()` is called with `distance_km`, `osrm_duration_sec`, and the current Istanbul-timezone timestamp.
7. The predictor loads Istanbul traffic pattern data from `data/ibb_traffic_patterns_2024_2025.csv` (keyed by `hour` and `day_of_week`) and builds a 9-feature input vector:
   - `distance_km`, `hour`, `day_of_week`, `is_weekend`, `is_rush_hour`
   - `ibb_avg_speed`, `ibb_traffic_density`, `ibb_speed_factor` (from CSV)
   - `osrm_duration_sec`
8. The trained model (`models_bin/eta_model_istanbul.pkl`) returns `eta_minutes`.
9. `create_eta_prediction()` inserts a new row into `tyb_analytics.eta_predictions`.

### Rush hours used
`[7, 8, 9, 16, 17, 18, 19, 20, 21]` (Istanbul, 24h clock)

### DB reads
- `tyb_spatial.trips` — `status`, `created_at`, `route_geometry`, `end_location`, `start_location`, `total_distance_km`, `duration_seconds`
- `tyb_spatial.gps_data` — latest GPS point for the trip (fallback only)

### DB writes
- `tyb_analytics.eta_predictions` — **INSERT** new row every run per trip. Records are not updated; a new prediction is inserted each cycle.

### ETA prediction record fields written
| Column | Value |
|--------|-------|
| `trip_id` | Trip UUID |
| `device_id` | Resolved from GPS data or vehicle record |
| `prediction_time` | Current Istanbul time |
| `predicted_arrival_time` | `prediction_time + eta_seconds` |
| `current_location` | Geometry POINT (resolved above) |
| `destination` | `trips.end_location` |
| `remaining_distance_km` | `trips.total_distance_km` |
| `confidence_score` | Model's test R² × 100 |
| `traffic_factor` | `50.0 / avg_speed_kmh` |
| `weather_factor` | Always `1.0` (not implemented) |
| `metadata` (JSON) | eta_minutes, eta_formatted, rush_hour flag, traffic density, model info |

---

## Anomaly Detection Flow

**File:** `jobs/anomaly_job.py`, `ml_core/anomaly_detector.py`, `ml_core/preprocessing.py`

**Trigger:** Every 120 seconds.

**Purpose:** Detect driving anomalies in completed trips that have not yet been analyzed.

### Step-by-step

1. `AnomalyDetectionJob.run()` queries up to **50** trips per run where:
   - `tyb_spatial.trips.status = 'completed'`
   - No row exists in `tyb_analytics.anomalies` for that `trip_id` (anti-join subquery)
2. For each trip, `_analyze_trip()` fetches GPS points using a raw SQL UNION:
   - **Primary:** `tyb_spatial.gps_data WHERE trip_id = :trip_id`
   - **Fallback:** `gps_data JOIN tyb_core.vehicles` matching `device_id + vehicle_id + time range` (for older records where `trip_id` was NULL)
   - Results are ordered by `gps_timestamp ASC`.
3. If fewer than 2 GPS points exist, the trip is skipped.
4. `extract_trip_features(gps_points)` processes the raw GPS track:
   - Applies a 3-point moving average to smooth speed noise.
   - Calculates acceleration from smoothed speed deltas.
   - Counts discrete harsh braking events (acceleration ≤ −2.5 m/s²) and harsh acceleration events (≥ 2.5 m/s²).
   - Tracks stop events (speed drops below 1.0 m/s).
5. `features_to_anomaly_input(features)` maps the extracted features to the 9 inputs the anomaly model expects.
6. `AnomalyDetector.predict()` runs in two stages:
   - **ML stage:** Calls `decision_function()` on the loaded IsolationForest pipeline (`models_bin/anomaly_model.pkl`). Raw score is converted to a 0–100 scale: `score = ((1.0 - raw_score) / 2.0) * 100`.
   - **Rule-based override:** Physical impossibility checks run regardless of ML score:
     - Jerk > 50 m/s³ → flag `IMPOSSIBLE_MOTION`, score forced ≥ 90
     - Acceleration > 15 m/s² → flag `CRASH_OR_TELEPORT_SUSPICION`, score forced ≥ 85
     - Velocity oscillation > 5 → flag `OSCILLATION`
     - GPS spike ratio > 10 → flag `GPS_SPIKE`
7. A trip is considered anomalous if `score >= 60` **OR** any physical flag is raised.
8. Severity is determined:
   - Score > 80 or `IMPOSSIBLE_MOTION`/`CRASH_OR_TELEPORT_SUSPICION` → `CRITICAL`
   - Score > 70 or ≥ 2 flags → `HIGH`
   - Score ≥ 60 or 1 flag → `MEDIUM`
   - Otherwise → `LOW`
9. If anomalous, a row is inserted into `tyb_analytics.anomalies`. If not anomalous, nothing is written (the trip is simply not reprocessed on the next cycle because of the anti-join check).

### DB reads
- `tyb_spatial.trips` — `status`, `vehicle_id`, `start_time`, `end_time`
- `tyb_spatial.gps_data` — `latitude`, `longitude`, `gps_timestamp`, `device_id`
- `tyb_core.vehicles` — `device_id` (fallback join)
- `tyb_analytics.anomalies` — existence check to skip already-processed trips

### DB writes
- `tyb_analytics.anomalies` — **INSERT** one row per anomalous trip. Non-anomalous trips produce no write.

### Anomaly record fields written
| Column | Value |
|--------|-------|
| `trip_id` | Trip UUID |
| `device_id` | From GPS data (first non-null device_id in result) |
| `anomaly_type` | Always `'isolation_forest_anomaly'` |
| `severity` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `description` | `"Anomali tespiti: FLAG1, FLAG2, ..."` |
| `confidence_score` | `anomaly_score / 100.0` (0–1 range) |
| `algorithm_used` | Always `'IsolationForest_v1'` |
| `location` | Centroid POINT of the GPS track (avg lat/lon) |
| `metadata` (JSON) | anomaly_score, flags, raw_features, severity |

---

## Driver Grading Flow

**File:** `jobs/driver_scoring_job.py`, `ml_core/preprocessing.py`

**Trigger:** Every 300 seconds.

**Purpose:** Calculate a driving quality score (0–100) for every completed trip that does not yet have a score.

> Note: Despite `ml_core/driver_scorer.py` existing (a Random Forest wrapper), the scoring job does **not** call it. Driver scoring uses a deterministic formula only (`algo_version: v6_formula_only`).

### Step-by-step

1. `DriverScoringJob.run()` queries up to **50** trips per run where:
   - `tyb_spatial.trips.status = 'completed'`
   - `trips.driver_id IS NOT NULL`
   - No row exists in `tyb_analytics.driver_scores` for that `trip_id`
2. For each trip, GPS data is fetched from `tyb_spatial.gps_data` ordered by `gps_timestamp ASC`. Trips with fewer than **10** GPS points are skipped.
3. `extract_trip_features(gps_points)` produces the same feature set used by anomaly detection (shared preprocessing pipeline).
4. Three penalty values are computed from the features:

   **Speed penalty**
   ```
   speed_excess = max(0, p95_speed_mps - 25.5)
   speed_penalty = (speeding_ratio_pct × 0.35) + (speed_excess × 1.5)
   ```

   **Brake penalty** (normalized by `duration_hours + 0.75`)
   ```
   brake_penalty = (brake_event_count × 1.2 + brake_severity_sum × 0.7) / norm_factor
   ```

   **Accel penalty** (normalized by `duration_hours + 0.75`)
   ```
   accel_penalty = (accel_event_count × 1.0 + accel_severity_sum × 0.6) / norm_factor
   ```

5. Exponential decay converts each penalty to a 0–100 score:
   ```
   speed_score = 100 × exp(−0.028 × speed_penalty)
   brake_score = 100 × exp(−0.040 × brake_penalty)
   accel_score = 100 × exp(−0.035 × accel_penalty)
   ```

6. Final overall score:
   ```
   weighted_avg = speed_score × 0.40 + brake_score × 0.35 + accel_score × 0.25
   overall_score = (weighted_avg × 0.80) + (min_of_three_scores × 0.20)
   ```
   The worst sub-score has 20% influence on the overall score to penalize severe single-category failures.

7. If all three penalties are zero (perfectly clean trip), all scores are capped at **95.0** to avoid perfect 100s.

8. A `DriverScore` record is inserted.

### Speed limit used
`25.5 m/s` (approximately 91.8 km/h)

### DB reads
- `tyb_spatial.trips` — `status`, `driver_id`
- `tyb_spatial.gps_data` — full GPS track for the trip
- `tyb_analytics.driver_scores` — existence check (anti-join)

### DB writes
- `tyb_analytics.driver_scores` — **INSERT** one row per processed trip.

### Driver score record fields written
| Column | Value |
|--------|-------|
| `trip_id` | Trip UUID |
| `driver_id` | From trip record |
| `overall_score` | 0–100 (capped at 95 for clean trips) |
| `speed_score` | 0–100 |
| `acceleration_score` | 0–100 |
| `braking_score` | 0–100 |
| `idle_time_score` | Always `100.0` (not implemented) |
| `total_trips` | Always `1` (per-trip scoring only) |
| `total_distance_km` | From GPS features |
| `total_duration_seconds` | From GPS features |
| `speeding_events` | `speeding_seconds` (raw seconds, not count) |
| `harsh_acceleration_events` | `accel_event_count` |
| `harsh_braking_events` | `brake_event_count` |
| `period_type` | Always `'TRIP'` |
| `analysis_date` | UTC date of calculation (ISO string) |
| `metadata` (JSON) | algo_version, event counts, penalty values |

---

## Database Interaction Summary

### Tables read

| Table | Schema | Read by |
|-------|--------|---------|
| `trips` | `tyb_spatial` | All three jobs |
| `gps_data` | `tyb_spatial` | All three jobs |
| `vehicles` | `tyb_core` | Anomaly job (fallback GPS query), ETA job (device_id resolution) |
| `anomalies` | `tyb_analytics` | Anomaly job (existence check) |
| `driver_scores` | `tyb_analytics` | Driver scoring job (existence check) |

### Tables written

| Table | Schema | Written by | Write type |
|-------|--------|-----------|------------|
| `eta_predictions` | `tyb_analytics` | ETA Prediction job | INSERT (new row each cycle per trip) |
| `anomalies` | `tyb_analytics` | Anomaly Detection job | INSERT (one row per anomalous trip, once) |
| `driver_scores` | `tyb_analytics` | Driver Scoring job | INSERT (one row per trip, once) |

### Stored procedures, views, triggers, functions
None found. The service uses raw SQL (`sqlalchemy.text`) only for the GPS lookup union in the anomaly job. All other queries are SQLAlchemy ORM. No stored procedures, database views, triggers, or DB-level functions are invoked or depended upon.

### Queue-like behavior
There is no message queue. The jobs implement a polling pattern: each run filters for unprocessed records using an anti-join subquery (`NOT EXISTS`). Once a record is processed (a result row exists in `tyb_analytics`), it is never picked up again. This makes processing idempotent.

---

## Important Files

### `main.py`
Entry point. Initializes logging, starts `JobScheduler`, registers `SIGINT`/`SIGTERM` handlers for graceful shutdown, then blocks in a `while True: time.sleep(1)` loop.

### `config/settings.py`
All configuration: database URL, job intervals, model paths, data file paths, thresholds. Load order: hardcoded defaults → `.env` file (via `python-dotenv`). No environment variables override job intervals — those are hardcoded in `JOB_INTERVALS`.

### `jobs/scheduler.py`
Creates and holds the APScheduler `BackgroundScheduler`. Registers all three jobs with their intervals. Exposes `start()`, `stop()`, and `get_jobs()`. Singleton via `get_scheduler()`.

### `jobs/eta_prediction_job.py`
Runs the ETA pipeline. Resolves current vehicle position from `route_geometry → gps_data → start_location`, reads distance/duration from the trip record, calls `ETAPredictor`, and writes to `tyb_analytics.eta_predictions`.

### `jobs/anomaly_job.py`
Fetches GPS tracks for completed unanalyzed trips, extracts features, runs IsolationForest + rule-based checks, and inserts into `tyb_analytics.anomalies` if anomalous.

### `jobs/driver_scoring_job.py`
Fetches GPS tracks for completed unscored trips, extracts features, applies the formula-based scoring algorithm, and inserts into `tyb_analytics.driver_scores`.

### `ml_core/preprocessing.py`
Shared GPS feature extraction used by both anomaly and driver scoring jobs. Implements Haversine distance, 3-point moving average smoothing, discrete event detection for harsh braking/acceleration, and speeding ratio calculation. All jobs call `extract_trip_features()` from here.

### `ml_core/eta_predictor.py`
Loads `eta_model_istanbul.pkl` and `ibb_traffic_patterns_2024_2025.csv`. Builds the 9-feature input, calls `model.predict()`, and returns structured prediction results including formatted ETA and predicted arrival time.

### `ml_core/anomaly_detector.py`
Loads `anomaly_model.pkl` (IsolationForest sklearn Pipeline). Runs `decision_function()`, converts to 0–100 score, applies rule-based physical checks, and returns `(score, is_anomalous, flags, severity)`.

### `ml_core/driver_scorer.py`
Loads `driver_scoring_model.pkl` (Random Forest sklearn Pipeline). **Currently not called by any job** — the driver scoring job uses the formula in `driver_scoring_job.py` directly.

### `db/database.py`
SQLAlchemy engine and session factory. `get_db()` is a context manager (used by ETA job). `get_session()` returns a raw session (used by anomaly and driver scoring jobs — sessions are closed manually in `finally` blocks).

### `db/models.py`
SQLAlchemy ORM models for `Trip`, `GpsData`, `DriverScore`, `Anomaly`, `EtaPrediction`. Also contains `get_pending_trips()`, `create_eta_prediction()`, and `get_device_id_for_trip()`.

### `utils/logger.py`
Configures the root Python logger. Supports plain text or JSON format. In production (`main.py`), `use_json=False` is passed, so logs are plain text despite `LOG_FORMAT = 'json'` in settings.

### `utils/osrm_client.py`
HTTP client for OSRM. Exists but is **not used by any active job**. The ETA job previously called OSRM directly; this was removed and the client was left in place.

### `models_bin/`
Pre-trained model files. All are `.pkl` (scikit-learn joblib format) except `driver_iforest.onnx` which is unused.

| File | Used by |
|------|---------|
| `eta_model_istanbul.pkl` | ETA Prediction job |
| `anomaly_model.pkl` | Anomaly Detection job |
| `driver_scoring_model.pkl` | Loaded by `DriverScorer` class, **not called by any job** |
| `anomaly_scaler.pkl` | Not loaded by any current code |
| `driver_scoring_scaler.pkl` | Not loaded by any current code |
| `driver_iforest.onnx` | Not loaded by any current code |

### `data/ibb_traffic_patterns_2024_2025.csv`
Istanbul traffic pattern data used by the ETA predictor. Keyed by `hour` (0–23) and `day_of_week` (0=Monday). Columns: `avg_speed_kmh`, `traffic_density`, `speed_factor`.

---

## Configuration

### Environment variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@localhost:5432/trackyourbest_local` | PostgreSQL connection string |
| `OSRM_URL` | `http://localhost:5000` | OSRM base URL (currently unused by jobs) |
| `LOG_LEVEL` | `INFO` | Python logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

### Key hardcoded values in `config/settings.py`

| Constant | Value | Used by |
|----------|-------|---------|
| `TIMEZONE` | `'Europe/Istanbul'` | ETA Prediction |
| `ETA_BATCH_SIZE` | `10` | ETA Prediction (trips per run) |
| `SPEED_LIMIT_MPS` (driver scoring) | `25.5` m/s (~92 km/h) | Driver Scoring |
| `ANOMALY_THRESHOLD_SCORE` | `50.0` | Not used by current code — detector uses `60.0` hardcoded |
| `HARSH_ACCELERATION_MPS2` | `2.5` | Preprocessing feature extraction |
| `HARSH_BRAKING_MPS2` | `2.5` | Preprocessing feature extraction |

---

## Logging and Error Handling

- All logging goes to stdout via a single `StreamHandler`.
- Format: plain text (`%(asctime)s - %(name)s - %(levelname)s - %(message)s`) — `use_json=False` is passed in `main.py`.
- Each job logs start, per-trip results, and completion.
- **Per-trip errors are caught and logged individually.** A single failing trip does not abort the batch — the job calls `db.rollback()` for that trip and continues to the next.
- **Job-level errors** (e.g., DB connection failure) are caught at the `run()` level and logged. The scheduler will retry on the next interval.
- No retry logic within a single job run. No exponential backoff. No dead-letter mechanism.
- There is no alerting integration.

---

## Local Development

### Prerequisites
- Python 3.12
- PostgreSQL with PostGIS extension running on port 5432 (or 5433 per default in `settings.py` — check your `.env`)
- The TYB database schema must be migrated (via `TYB.ApiService`)

### Setup

```bash
cd TYB.MLService

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env with your local DATABASE_URL
```

### Run

```bash
python main.py
```

You should see:
```
TYB ML Worker Service başlatılıyor...
✅ Service başarıyla başlatıldı
📊 Aktif Jobs:
  - Anomali Detection (id: anomaly_job)
  - Driver Scoring (id: driver_scoring_job)
  - ETA Prediction (id: eta_prediction_job)
```

### Validate model files

```bash
python config/settings.py
```

This runs `validate_settings()` which checks that all `.pkl` files and the traffic CSV exist.

### Stop
`CTRL+C` triggers graceful shutdown via `SIGINT`.

---

## Notes for Future Developers

- **ETA is INSERT-only.** A new `eta_predictions` row is written every 20 seconds for every ongoing trip. There is no deduplication or update. Downstream consumers should query the latest prediction for a trip, not assume only one exists.

- **Anomaly and Driver Score are processed once per trip.** The anti-join pattern (`NOT EXISTS`) means once a trip has a score or anomaly record, it will never be reprocessed. If you need to reprocess a trip, delete the corresponding analytics row.

- **`driver_scorer.py` and several model files are currently unused.** `ml_core/driver_scorer.py`, `anomaly_scaler.pkl`, `driver_scoring_scaler.pkl`, and `driver_iforest.onnx` exist but are not called by any active job. The driver scoring formula replaced the ML model.

- **Job intervals are not environment-configurable.** The `.env` file has commented-out interval variables, but the code does not read them. To change intervals, edit `JOB_INTERVALS` in `config/settings.py`.

- **`scikit-learn` version is locked to `1.8.0`.** The `.pkl` model files were serialized with this version. Upgrading scikit-learn will likely break model loading.

- **Database timezone assumption.** `created_at` in `trips` is stored as a naive UTC datetime. The ETA job compares it against `datetime.now(timezone.utc).replace(tzinfo=None)` to strip timezone info before comparing. If the DB column ever becomes timezone-aware, this comparison will need updating.

- **The OSRM client (`utils/osrm_client.py`) is not used.** Route distance and duration are now provided by `TYB.ApiService`, which calls OSRM itself and stores the results in `trips.total_distance_km` and `trips.duration_seconds`. The ML service relies entirely on those pre-computed values.

- **`idle_time_score` is always 100.0.** This field exists in the `DriverScore` model but idle time analysis is not implemented. It is a placeholder.

- **Batch limits are 50 trips per anomaly/scoring run and 10 trips per ETA run.** Under high load (many simultaneous trips), ETA predictions may lag. Consider increasing `ETA_BATCH_SIZE` if needed.
