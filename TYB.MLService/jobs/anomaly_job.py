"""
TYB MLService - Anomaly Detection Job (v2)
==========================================
Changelog vs v1:
  - Consumes the new dict return value from AnomalyDetector.predict().
  - Stores actual raw_decision_score in model_metadata (was hardcoded 0.0).
  - confidence_score stored as 0.0-1.0 decimal (DB column expectation).
  - anomaly_score kept as 0-100 in metadata for readability.
  - Severity is now always derived from the final score, so UI is consistent.
  - Anomalies are only saved when combined score ≥ threshold (60).
    Rule flags alone no longer force a save — they push the score instead.
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from shapely.geometry import Point as ShapelyPoint
from geoalchemy2.shape import from_shape

from db.database import get_session
from db.models import Trip, GpsData, Anomaly
from ml_core.preprocessing import GpsPoint, extract_trip_features, features_to_anomaly_input
from ml_core.anomaly_detector import AnomalyDetector
from config.settings import MODELS

logger = logging.getLogger(__name__)


class AnomalyDetectionJob:
    """Scheduled job: analyse completed trips for anomalies."""

    def __init__(self):
        self.detector = AnomalyDetector(MODELS["isolation_forest"])

    # ------------------------------------------------------------------
    def run(self) -> None:
        logger.info("Anomaly detection job started...")
        db = get_session()
        try:
            # Completed trips that have no Anomaly record yet
            trips = (
                db.query(Trip)
                .filter(
                    Trip.status == "completed",
                    ~db.query(Anomaly)
                    .filter(Anomaly.trip_id == Trip.id)
                    .exists(),
                )
                .limit(50)
                .all()
            )

            logger.info(f"{len(trips)} trips are ready for anomaly analysis")

            for trip in trips:
                try:
                    self._analyze_trip(db, trip)
                except Exception as exc:
                    logger.error(f"Trip {trip.id} analysis failed: {exc}", exc_info=True)
                    db.rollback()

            logger.info("Anomaly detection job completed")

        except Exception as exc:
            logger.error(f"Anomaly detection job failed: {exc}", exc_info=True)
        finally:
            db.close()

    # ------------------------------------------------------------------
    def _analyze_trip(self, db: Session, trip: Trip) -> None:
        """Analyse a single trip and persist an Anomaly record if warranted."""

        # --- Fetch GPS rows -----------------------------------------------
        # Primary: rows linked to this trip_id.
        # Fallback: rows linked by device + time range (for legacy records).
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
                "trip_id":    str(trip.id),
                "vehicle_id": str(trip.vehicle_id),
                "start_time": trip.start_time,
                "end_time":   trip.end_time,
            },
        ).fetchall()

        if len(rows) < 2:
            logger.warning(
                f"Trip {trip.id}: insufficient GPS data ({len(rows)} points); skipped"
            )
            return

        gps_points = [GpsPoint(r.latitude, r.longitude, r.gps_timestamp) for r in rows]
        device_id_raw = next((r.device_id for r in rows if r.device_id is not None), None)

        # Centroid of the GPS track → representative location for the Anomaly record
        avg_lat = sum(r.latitude  for r in rows) / len(rows)
        avg_lon = sum(r.longitude for r in rows) / len(rows)
        location_geom = from_shape(ShapelyPoint(avg_lon, avg_lat), srid=4326)

        # --- Feature extraction ------------------------------------------
        features = extract_trip_features(gps_points)
        if not features:
            logger.warning(f"Trip {trip.id}: feature extraction failed; skipped")
            return

        anomaly_features = features_to_anomaly_input(features)

        # --- Anomaly detection -------------------------------------------
        result = self.detector.predict(anomaly_features)

        anomaly_score    = result["anomaly_score"]      # 0-100
        confidence_score = result["confidence_score"]   # 0.0-1.0
        is_anomalous     = result["is_anomalous"]
        flags            = result["flags"]
        severity         = result["severity"]
        debug            = result["debug"]

        logger.info(
            f"🔎 Trip {trip.id}: score={anomaly_score:.1f} "
            f"conf={confidence_score:.2f} severity={severity} flags={flags} "
            f"raw_decision={debug['raw_decision_score']:.4f}"
        )

        # --- Persist only if anomalous -----------------------------------
        if not is_anomalous:
            logger.debug(f"✅ Trip {trip.id}: no anomaly (score={anomaly_score:.1f} < threshold)")
            return

        if device_id_raw is None:
            logger.warning(
                f"Trip {trip.id}: device_id not found; anomaly record skipped"
            )
            return

        anomaly = Anomaly(
            trip_id=trip.id,
            device_id=device_id_raw,
            anomaly_type="isolation_forest_anomaly",
            severity=severity,
            description=(
                f"Anomali tespiti: {', '.join(flags)}"
                if flags
                else "Anomali tespiti: ML model flag"
            ),
            # DB column expects a 0.0-1.0 decimal
            confidence_score=confidence_score,
            algorithm_used="IsolationForest_v2_calibrated",
            location=location_geom,
            model_metadata={
                # 0-100 scale — human-readable
                "anomaly_score":  anomaly_score,
                # 0.0-1.0 scale — matches confidence_score column
                "confidence_score": confidence_score,
                # Flags that were raised
                "flags": flags,
                # Raw input features passed to the model
                "input_features": anomaly_features,
                # Full debug trace from AnomalyDetector.predict()
                "debug": debug,
            },
        )

        db.add(anomaly)
        db.commit()
        logger.info(
            f"💾 Anomaly kaydedildi: trip={trip.id} "
            f"score={anomaly_score:.1f} severity={severity}"
        )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def anomaly_job_handler() -> None:
    """APScheduler / Celery entry point."""
    job = AnomalyDetectionJob()
    job.run()
