BEGIN;

-- =========================================================
-- TEMİZLİK
-- =========================================================

DELETE FROM tyb_analytics.driver_scores;
DELETE FROM tyb_analytics.anomalies;
DELETE FROM tyb_spatial.gps_data;
DELETE FROM tyb_spatial.trips;

-- =========================================================
-- ORTAK REFERANSLAR
-- İlk 5 driver / device / vehicle kullanılacak
-- =========================================================

-- ---------------------------------------------------------
-- 1) EXCELLENT DRIVER - Sabit 54 km/h, temiz sürüş
-- ---------------------------------------------------------
WITH ref AS (
    SELECT
        (SELECT id FROM tyb_core.devices  ORDER BY id LIMIT 1 OFFSET 0) AS device_id,
        (SELECT id FROM tyb_core.drivers  ORDER BY id LIMIT 1 OFFSET 0) AS driver_id,
        (SELECT id FROM tyb_core.vehicles ORDER BY id LIMIT 1 OFFSET 0) AS vehicle_id
),
trip_insert AS (
    INSERT INTO tyb_spatial.trips (vehicle_id, driver_id, status, start_time, end_time)
    SELECT vehicle_id, driver_id, 'completed', NOW() - INTERVAL '15 minutes', NOW()
    FROM ref
    RETURNING id
),
movement AS (
    SELECT i, 15.0 AS speed_mps
    FROM generate_series(1, 900) AS i
),
cumulative AS (
    SELECT i, SUM(speed_mps / 111139.0) OVER (ORDER BY i) AS total_dist
    FROM movement
)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, location, gps_timestamp)
SELECT
    t.id,
    r.device_id,
    41.000000 + c.total_dist,
    29.000000,
    ST_SetSRID(ST_MakePoint(29.000000, 41.000000 + c.total_dist), 4326),
    NOW() - ((900 - c.i) || ' seconds')::interval
FROM trip_insert t
CROSS JOIN ref r
CROSS JOIN cumulative c;

-- ---------------------------------------------------------
-- 2) GOOD DRIVER - Hafif stop var, hafif braking
-- ---------------------------------------------------------
WITH ref AS (
    SELECT
        (SELECT id FROM tyb_core.devices  ORDER BY id LIMIT 1 OFFSET 1) AS device_id,
        (SELECT id FROM tyb_core.drivers  ORDER BY id LIMIT 1 OFFSET 1) AS driver_id,
        (SELECT id FROM tyb_core.vehicles ORDER BY id LIMIT 1 OFFSET 1) AS vehicle_id
),
trip_insert AS (
    INSERT INTO tyb_spatial.trips (vehicle_id, driver_id, status, start_time, end_time)
    SELECT vehicle_id, driver_id, 'completed', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes'
    FROM ref
    RETURNING id
),
movement AS (
    SELECT
        i,
        CASE
            WHEN i < 20 THEN i * 0.8
            WHEN i >= 20 AND i < 500 THEN 18.0
            WHEN i = 500 THEN 14.0
            WHEN i >= 501 AND i < 510 THEN 14.0 - (i - 500) * 1.0
            WHEN i >= 510 AND i < 525 THEN 0.0
            WHEN i >= 525 AND i < 540 THEN (i - 525) * 1.0
            ELSE 18.0
        END AS speed_mps
    FROM generate_series(1, 900) AS i
),
cumulative AS (
    SELECT i, SUM(speed_mps / 111139.0) OVER (ORDER BY i) AS total_dist
    FROM movement
)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, location, gps_timestamp)
SELECT
    t.id,
    r.device_id,
    41.100000 + c.total_dist,
    29.100000,
    ST_SetSRID(ST_MakePoint(29.100000, 41.100000 + c.total_dist), 4326),
    (NOW() - INTERVAL '15 minutes') - ((900 - c.i) || ' seconds')::interval
FROM trip_insert t
CROSS JOIN ref r
CROSS JOIN cumulative c;

-- ---------------------------------------------------------
-- 3) MEDIUM DRIVER - Ara ara speed limit üstü, birkaç sert fren
-- ---------------------------------------------------------
WITH ref AS (
    SELECT
        (SELECT id FROM tyb_core.devices  ORDER BY id LIMIT 1 OFFSET 2) AS device_id,
        (SELECT id FROM tyb_core.drivers  ORDER BY id LIMIT 1 OFFSET 2) AS driver_id,
        (SELECT id FROM tyb_core.vehicles ORDER BY id LIMIT 1 OFFSET 2) AS vehicle_id
),
trip_insert AS (
    INSERT INTO tyb_spatial.trips (vehicle_id, driver_id, status, start_time, end_time)
    SELECT vehicle_id, driver_id, 'completed', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes'
    FROM ref
    RETURNING id
),
movement AS (
    SELECT
        i,
        CASE
            WHEN MOD(i, 180) < 30 THEN 28.0
            WHEN MOD(i, 180) >= 30 AND MOD(i, 180) < 60 THEN 20.0
            WHEN MOD(i, 180) >= 60 AND MOD(i, 180) < 70 THEN 12.0
            WHEN MOD(i, 180) >= 70 AND MOD(i, 180) < 85 THEN 0.0
            WHEN MOD(i, 180) >= 85 AND MOD(i, 180) < 100 THEN 14.0
            ELSE 22.0
        END AS speed_mps
    FROM generate_series(1, 900) AS i
),
cumulative AS (
    SELECT i, SUM(speed_mps / 111139.0) OVER (ORDER BY i) AS total_dist
    FROM movement
)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, location, gps_timestamp)
SELECT
    t.id,
    r.device_id,
    41.200000 + c.total_dist,
    29.200000,
    ST_SetSRID(ST_MakePoint(29.200000, 41.200000 + c.total_dist), 4326),
    (NOW() - INTERVAL '30 minutes') - ((900 - c.i) || ' seconds')::interval
FROM trip_insert t
CROSS JOIN ref r
CROSS JOIN cumulative c;

-- ---------------------------------------------------------
-- 4) RISKY DRIVER - Uzun süre hız limiti üstü, çok sayıda event
-- ---------------------------------------------------------
WITH ref AS (
    SELECT
        (SELECT id FROM tyb_core.devices  ORDER BY id LIMIT 1 OFFSET 3) AS device_id,
        (SELECT id FROM tyb_core.drivers  ORDER BY id LIMIT 1 OFFSET 3) AS driver_id,
        (SELECT id FROM tyb_core.vehicles ORDER BY id LIMIT 1 OFFSET 3) AS vehicle_id
),
trip_insert AS (
    INSERT INTO tyb_spatial.trips (vehicle_id, driver_id, status, start_time, end_time)
    SELECT vehicle_id, driver_id, 'completed', NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '45 minutes'
    FROM ref
    RETURNING id
),
movement AS (
    SELECT
        i,
        CASE
            WHEN MOD(i, 45) < 8 THEN 18.0 + MOD(i, 45) * 2.2
            WHEN MOD(i, 45) >= 8 AND MOD(i, 45) < 30 THEN 31.0
            WHEN MOD(i, 45) >= 30 AND MOD(i, 45) < 35 THEN 20.0
            WHEN MOD(i, 45) >= 35 AND MOD(i, 45) < 40 THEN 8.0
            ELSE 31.0 - (MOD(i, 45) - 40) * 2.5
        END AS speed_mps
    FROM generate_series(1, 900) AS i
),
cumulative AS (
    SELECT i, SUM(speed_mps / 111139.0) OVER (ORDER BY i) AS total_dist
    FROM movement
)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, location, gps_timestamp)
SELECT
    t.id,
    r.device_id,
    41.300000 + c.total_dist,
    29.300000,
    ST_SetSRID(ST_MakePoint(29.300000, 41.300000 + c.total_dist), 4326),
    (NOW() - INTERVAL '45 minutes') - ((900 - c.i) || ' seconds')::interval
FROM trip_insert t
CROSS JOIN ref r
CROSS JOIN cumulative c;

-- ---------------------------------------------------------
-- 5) DANGEROUS / ANOMALY DRIVER - Aşırı agresif, imkansıza yakın hareketler
-- ---------------------------------------------------------
WITH ref AS (
    SELECT
        (SELECT id FROM tyb_core.devices  ORDER BY id LIMIT 1 OFFSET 4) AS device_id,
        (SELECT id FROM tyb_core.drivers  ORDER BY id LIMIT 1 OFFSET 4) AS driver_id,
        (SELECT id FROM tyb_core.vehicles ORDER BY id LIMIT 1 OFFSET 4) AS vehicle_id
),
trip_insert AS (
    INSERT INTO tyb_spatial.trips (vehicle_id, driver_id, status, start_time, end_time)
    SELECT vehicle_id, driver_id, 'completed', NOW() - INTERVAL '75 minutes', NOW() - INTERVAL '60 minutes'
    FROM ref
    RETURNING id
),
movement AS (
    SELECT
        i,
        CASE
            WHEN MOD(i, 20) < 4 THEN 12.0 + MOD(i, 20) * 6.0
            WHEN MOD(i, 20) >= 4 AND MOD(i, 20) < 12 THEN 36.0
            WHEN MOD(i, 20) >= 12 AND MOD(i, 20) < 15 THEN 8.0
            WHEN MOD(i, 20) >= 15 AND MOD(i, 20) < 17 THEN 0.0
            ELSE 38.0
        END AS speed_mps
    FROM generate_series(1, 900) AS i
),
cumulative AS (
    SELECT i, SUM(speed_mps / 111139.0) OVER (ORDER BY i) AS total_dist
    FROM movement
)
INSERT INTO tyb_spatial.gps_data (trip_id, device_id, latitude, longitude, location, gps_timestamp)
SELECT
    t.id,
    r.device_id,
    41.400000 + c.total_dist,
    29.400000,
    ST_SetSRID(ST_MakePoint(29.400000, 41.400000 + c.total_dist), 4326),
    (NOW() - INTERVAL '60 minutes') - ((900 - c.i) || ' seconds')::interval
FROM trip_insert t
CROSS JOIN ref r
CROSS JOIN cumulative c;

-- =========================================================
-- MANUEL DRIVER SCORE INSERTLERİ
-- Not: Bunlar test amaçlıdır. Job çalıştırmadan frontendde görünür.
-- =========================================================

INSERT INTO tyb_analytics.driver_scores (
    id,
    driver_id,
    trip_id,
    analysis_date,
    period_type,
    overall_score,
    speed_score,
    acceleration_score,
    braking_score,
    idle_time_score,
    total_trips,
    total_distance_km,
    total_duration_seconds,
    speeding_events,
    harsh_acceleration_events,
    harsh_braking_events,
    calculated_at,
    metadata
)
SELECT
    gen_random_uuid(),
    t.driver_id,
    t.id,
    CURRENT_DATE,
    'TRIP',
    96.40,
    95.80,
    100.00,
    94.10,
    100.00,
    1,
    13.50,
    899,
    0,
    0,
    1,
    NOW(),
    '{"algo_version":"seed_insert","bucket":"EXCELLENT"}'
FROM tyb_spatial.trips t
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 4;

INSERT INTO tyb_analytics.driver_scores (
    id, driver_id, trip_id, analysis_date, period_type,
    overall_score, speed_score, acceleration_score, braking_score, idle_time_score,
    total_trips, total_distance_km, total_duration_seconds,
    speeding_events, harsh_acceleration_events, harsh_braking_events,
    calculated_at, metadata
)
SELECT
    gen_random_uuid(),
    t.driver_id,
    t.id,
    CURRENT_DATE,
    'TRIP',
    87.20,
    91.00,
    100.00,
    78.60,
    100.00,
    1,
    17.10,
    899,
    0,
    0,
    2,
    NOW(),
    '{"algo_version":"seed_insert","bucket":"GOOD"}'
FROM tyb_spatial.trips t
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 3;

INSERT INTO tyb_analytics.driver_scores (
    id, driver_id, trip_id, analysis_date, period_type,
    overall_score, speed_score, acceleration_score, braking_score, idle_time_score,
    total_trips, total_distance_km, total_duration_seconds,
    speeding_events, harsh_acceleration_events, harsh_braking_events,
    calculated_at, metadata
)
SELECT
    gen_random_uuid(),
    t.driver_id,
    t.id,
    CURRENT_DATE,
    'TRIP',
    68.90,
    61.40,
    100.00,
    72.10,
    100.00,
    1,
    22.40,
    899,
    4,
    0,
    3,
    NOW(),
    '{"algo_version":"seed_insert","bucket":"MEDIUM"}'
FROM tyb_spatial.trips t
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 2;

INSERT INTO tyb_analytics.driver_scores (
    id, driver_id, trip_id, analysis_date, period_type,
    overall_score, speed_score, acceleration_score, braking_score, idle_time_score,
    total_trips, total_distance_km, total_duration_seconds,
    speeding_events, harsh_acceleration_events, harsh_braking_events,
    calculated_at, metadata
)
SELECT
    gen_random_uuid(),
    t.driver_id,
    t.id,
    CURRENT_DATE,
    'TRIP',
    39.80,
    31.10,
    55.40,
    37.20,
    100.00,
    1,
    24.70,
    899,
    12,
    5,
    7,
    NOW(),
    '{"algo_version":"seed_insert","bucket":"RISKY"}'
FROM tyb_spatial.trips t
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 1;

INSERT INTO tyb_analytics.driver_scores (
    id, driver_id, trip_id, analysis_date, period_type,
    overall_score, speed_score, acceleration_score, braking_score, idle_time_score,
    total_trips, total_distance_km, total_duration_seconds,
    speeding_events, harsh_acceleration_events, harsh_braking_events,
    calculated_at, metadata
)
SELECT
    gen_random_uuid(),
    t.driver_id,
    t.id,
    CURRENT_DATE,
    'TRIP',
    11.90,
    8.10,
    15.20,
    12.40,
    100.00,
    1,
    31.50,
    899,
    18,
    15,
    15,
    NOW(),
    '{"algo_version":"seed_insert","bucket":"DANGEROUS"}'
FROM tyb_spatial.trips t
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 0;

-- =========================================================
-- MANUEL ANOMALY INSERTLERİ
-- =========================================================

INSERT INTO tyb_analytics.anomalies (
    id,
    trip_id,
    device_id,
    anomaly_type,
    severity,
    description,
    confidence_score,
    algorithm_used,
    detected_at,
    metadata
)
SELECT
    gen_random_uuid(),
    t.id,
    v.device_id,
    'JERK_HIGH',
    'MEDIUM',
    'Anomali tespiti: JERK_HIGH',
    0.51,
    'IsolationForest_v1',
    NOW(),
    '{"flags":["JERK_HIGH"],"severity":"MEDIUM","source":"seed_insert"}'
FROM tyb_spatial.trips t
JOIN tyb_core.vehicles v ON v.id = t.vehicle_id
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 1;

INSERT INTO tyb_analytics.anomalies (
    id,
    trip_id,
    device_id,
    anomaly_type,
    severity,
    description,
    confidence_score,
    algorithm_used,
    detected_at,
    metadata
)
SELECT
    gen_random_uuid(),
    t.id,
    v.device_id,
    'IMPOSSIBLE_MOTION',
    'CRITICAL',
    'Anomali tespiti: IMPOSSIBLE_MOTION',
    0.90,
    'IsolationForest_v1',
    NOW(),
    '{"flags":["IMPOSSIBLE_MOTION"],"severity":"CRITICAL","source":"seed_insert"}'
FROM tyb_spatial.trips t
JOIN tyb_core.vehicles v ON v.id = t.vehicle_id
ORDER BY t.start_time DESC
LIMIT 1 OFFSET 0;

COMMIT;
