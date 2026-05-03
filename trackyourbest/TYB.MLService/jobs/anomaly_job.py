"""
TYB MLService - Anomaly Detection Job
======================================
Processes completed trips and inserts categorized anomaly records.

Two anomaly_type values are used:
  'device_health'   — GPS artifacts, signal loss, teleportation jumps
  'driver_behavior' — crash suspicion, harsh driving, statistical anomalies

Trips are selected by anomaly_checked = FALSE. After analysis (regardless of
whether an anomaly is found) the trip is marked anomaly_checked = TRUE so it
is never evaluated again.
"""

import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from shapely.geometry import Point as ShapelyPoint
from geoalchemy2.shape import from_shape

from db.database import get_session
from db.models import Trip, GpsData, Anomaly
from ml_core.preprocessing import GpsPoint, extract_trip_features, features_to_anomaly_input, haversine
from ml_core.anomaly_detector import AnomalyDetector
from config.settings import MODELS

logger = logging.getLogger(__name__)


class AnomalyDetectionJob:

    def __init__(self):
        self.detector = AnomalyDetector(MODELS['isolation_forest'])

    def run(self):
        logger.info("🔍 Anomaly Detection Job started")

        db = get_session()
        try:
            trips = db.query(Trip).filter(
                Trip.status == 'completed',
                Trip.anomaly_checked == False
            ).limit(50).all()

            logger.info(f"📊 {len(trips)} trips queued for anomaly analysis")

            for trip in trips:
                try:
                    self._analyze_trip(db, trip)
                except Exception as e:
                    logger.error(f"❌ Trip {trip.id} analysis failed: {e}")
                    db.rollback()

            logger.info("✅ Anomaly Detection Job completed")

        except Exception as e:
            logger.error(f"❌ Anomaly Detection Job error: {e}")
        finally:
            db.close()

    def _analyze_trip(self, db: Session, trip: Trip):
        # Primary: query by trip_id (set by IoTService).
        # Fallback: device + time range for older records where trip_id was NULL.
        rows = db.execute(
            text("""
                SELECT g.latitude, g.longitude, g.gps_timestamp, g.device_id
                FROM tyb_spatial.gps_data g
                WHERE g.trip_id = :trip_id
                UNION ALL
                SELECT g.latitude, g.longitude, g.gps_timestamp, g.device_id
                FROM tyb_spatial.gps_data g
                JOIN tyb_core.vehicles v ON g.device_id = v.device_id
                WHERE g.trip_id IS NULL
                  AND v.id = :vehicle_id
                  AND g.gps_timestamp >= :start_time
                  AND g.gps_timestamp <= COALESCE(:end_time, NOW())
                ORDER BY gps_timestamp
            """),
            {
                "trip_id": str(trip.id),
                "vehicle_id": str(trip.vehicle_id),
                "start_time": trip.start_time,
                "end_time": trip.end_time,
            }
        ).fetchall()

        if len(rows) < 2:
            logger.warning(f"⚠️ Trip {trip.id}: insufficient GPS data ({len(rows)} points)")
            return

        gps_points = [
            GpsPoint(r.latitude, r.longitude, r.gps_timestamp)
            for r in rows
        ]

        device_id = next((r.device_id for r in rows if r.device_id is not None), None)
        if device_id is None:
            logger.warning(f"⚠️ Trip {trip.id}: device_id not found, skipping")
            return

        features = extract_trip_features(gps_points)
        anomaly_features = features_to_anomaly_input(features)

        result = self.detector.predict(anomaly_features)

        logger.info(
            f"Trip {trip.id}: score={result['anomaly_score']:.1f} | "
            f"device={result['device_health']['detected']} {result['device_health']['flags']} | "
            f"driver={result['driver_behavior']['detected']} {result['driver_behavior']['flags']}"
        )

        if not result['is_anomalous']:
            trip.anomaly_checked = True
            db.commit()
            return

        if result['device_health']['detected']:
            device_location = _gps_spike_location(rows)
            db.add(Anomaly(
                trip_id=trip.id,
                device_id=device_id,
                anomaly_type='device_health',
                severity=result['device_health']['severity'],
                description=f"Device issue: {', '.join(result['device_health']['flags'])}",
                confidence_score=result['anomaly_score'] / 100.0,
                algorithm_used='IsolationForest_v1+RuleEngine',
                location=device_location,
                model_metadata={
                    'anomaly_score': result['anomaly_score'],
                    'flags': result['device_health']['flags'],
                    'category': 'device_health',
                    'all_features': anomaly_features,
                }
            ))
            logger.info(
                f"💾 device_health anomaly queued — "
                f"trip={trip.id}, severity={result['device_health']['severity']}, "
                f"flags={result['device_health']['flags']}"
            )

        if result['driver_behavior']['detected']:
            driver_location = _max_accel_location(rows)
            db.add(Anomaly(
                trip_id=trip.id,
                device_id=device_id,
                anomaly_type='driver_behavior',
                severity=result['driver_behavior']['severity'],
                description=f"Driver behavior: {', '.join(result['driver_behavior']['flags'])}",
                confidence_score=result['anomaly_score'] / 100.0,
                algorithm_used='IsolationForest_v1+RuleEngine',
                location=driver_location,
                model_metadata={
                    'anomaly_score': result['anomaly_score'],
                    'flags': result['driver_behavior']['flags'],
                    'category': 'driver_behavior',
                    'all_features': anomaly_features,
                }
            ))
            logger.info(
                f"💾 driver_behavior anomaly queued — "
                f"trip={trip.id}, severity={result['driver_behavior']['severity']}, "
                f"flags={result['driver_behavior']['flags']}"
            )

        trip.anomaly_checked = True
        db.commit()


def _gps_spike_location(rows):
    """Return the GPS point with the largest distance jump (where signal dropout occurred)."""
    max_dist = -1
    best_idx = len(rows) // 2  # fallback: midpoint
    for i in range(1, len(rows)):
        dist = haversine(rows[i - 1].latitude, rows[i - 1].longitude,
                         rows[i].latitude, rows[i].longitude)
        if dist > max_dist:
            max_dist = dist
            best_idx = i
    pt = rows[best_idx]
    return from_shape(ShapelyPoint(pt.longitude, pt.latitude), srid=4326)


def _max_accel_location(rows):
    """Return the GPS point with the highest acceleration magnitude (where harsh event occurred)."""
    if len(rows) < 3:
        mid = rows[len(rows) // 2]
        return from_shape(ShapelyPoint(mid.longitude, mid.latitude), srid=4326)

    max_accel = -1
    best_idx = 1
    for i in range(1, len(rows) - 1):
        dt_prev = (rows[i].gps_timestamp - rows[i - 1].gps_timestamp).total_seconds()
        dt_next = (rows[i + 1].gps_timestamp - rows[i].gps_timestamp).total_seconds()
        if dt_prev <= 0 or dt_next <= 0:
            continue
        d_prev = haversine(rows[i - 1].latitude, rows[i - 1].longitude,
                           rows[i].latitude, rows[i].longitude)
        d_next = haversine(rows[i].latitude, rows[i].longitude,
                           rows[i + 1].latitude, rows[i + 1].longitude)
        v_prev = d_prev / dt_prev
        v_next = d_next / dt_next
        accel = abs(v_next - v_prev) / dt_next
        if accel > max_accel:
            max_accel = accel
            best_idx = i
    pt = rows[best_idx]
    return from_shape(ShapelyPoint(pt.longitude, pt.latitude), srid=4326)


def anomaly_job_handler():
    job = AnomalyDetectionJob()
    job.run()
