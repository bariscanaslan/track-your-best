"""
TYB MLService - Anomali Detection Job
=====================================
Zamanlanmış görev: Tamamlanmış tripileri anomali tespitine sokma
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
    """Anomali detection zamanlanmış görevi"""

    def __init__(self):
        self.detector = AnomalyDetector(MODELS['isolation_forest'])

    def run(self):
        """Job'ı çalıştır"""
        logger.info("🔍 Anomali Detection Job başladı...")

        db = get_session()
        try:
            # Henüz anomali analizi yapılmamış tamamlanmış tripileri bul
            trips = db.query(Trip).filter(
                Trip.status == 'completed',
                ~db.query(Anomaly).filter(
                    Anomaly.trip_id == Trip.id
                ).exists()
            ).limit(50).all()

            logger.info(f"📊 {len(trips)} trip anomali analizi için hazır")

            for trip in trips:
                try:
                    self._analyze_trip(db, trip)
                except Exception as e:
                    logger.error(f"❌ Trip {trip.id} analizi hatası: {e}")
                    db.rollback()

            logger.info("✅ Anomali Detection Job tamamlandı")

        except Exception as e:
            logger.error(f"❌ Anomali Detection Job hatası: {e}")
        finally:
            db.close()

    def _analyze_trip(self, db: Session, trip: Trip):
        """Tek bir trifi analiz et"""

        # Primary: query by trip_id (set by IoTService for trips that were ongoing at GPS arrival time).
        # Fallback: query by device + time range for historical records that predate this change.
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
            logger.warning(f"⚠️ Trip {trip.id}: GPS verisi yetersiz ({len(rows)} points)")
            return

        # GpsPoint nesnelerine dönüştür
        gps_points = [
            GpsPoint(r.latitude, r.longitude, r.gps_timestamp)
            for r in rows
        ]
        # device_id for anomaly record
        device_id_raw = next((r.device_id for r in rows if r.device_id is not None), None)

        # Centroid of GPS track = representative location for this anomaly
        avg_lat = sum(r.latitude for r in rows) / len(rows)
        avg_lon = sum(r.longitude for r in rows) / len(rows)
        location_geom = from_shape(ShapelyPoint(avg_lon, avg_lat), srid=4326)

        # Özellikler çıkar
        features = extract_trip_features(gps_points)
        anomaly_features = features_to_anomaly_input(features)

        # Anomali tahmini yap
        anomaly_score, is_anomalous, flags, severity = self.detector.predict(anomaly_features)

        logger.info(f"🚨 Trip {trip.id}: Score={anomaly_score:.2f}, Severity={severity}, Flags={flags}")

        # Veritabanına kaydet (anomaly_score > 60 ise kaydet)
        if is_anomalous:
            device_id = device_id_raw
            if device_id is None:
                logger.warning(f"⚠️ Trip {trip.id}: device_id bulunamadı, anomaly kaydı atlandı")
                return

            anomaly = Anomaly(
                trip_id=trip.id,
                device_id=device_id,
                anomaly_type='isolation_forest_anomaly',
                severity=severity,
                description=f"Anomali tespiti: {', '.join(flags)}",
                confidence_score=float(anomaly_score) / 100.0,
                algorithm_used='IsolationForest_v1',
                location=location_geom,
                model_metadata={
                    'anomaly_score': float(anomaly_score),
                    'raw_score': 0.0,
                    'flags': flags,
                    'features': anomaly_features,
                    'severity': severity
                }
            )
            db.add(anomaly)
            db.commit()
            logger.info(f"💾 Anomaly kaydedildi: {anomaly.id}")

# --- KOPYALARKEN BURAYI KAÇIRMIŞSIN, BURASI ÇOK ÖNEMLİ ---
def anomaly_job_handler():
    """APScheduler tarafından çağrılan handler fonksiyon"""
    job = AnomalyDetectionJob()
    job.run()
