"""
TYB MLService - Anomali Detection Job
=====================================
Zamanlanmış görev: Tamamlanmış tripileri anomali tespitine sokma
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session
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

            logger.info("✅ Anomali Detection Job tamamlandı")

        except Exception as e:
            logger.error(f"❌ Anomali Detection Job hatası: {e}")
        finally:
            db.close()

    def _analyze_trip(self, db: Session, trip: Trip):
        """Tek bir trifi analiz et"""

        # GPS verilerini oku
        gps_data = db.query(GpsData).filter(
            GpsData.trip_id == trip.id
        ).order_by(GpsData.gps_timestamp).all()

        if len(gps_data) < 2:
            logger.warning(f"⚠️ Trip {trip.id}: GPS verisi yetersiz ({len(gps_data)} points)")
            return

        # GpsPoint nesnelerine dönüştür
        gps_points = [
            GpsPoint(g.latitude, g.longitude, g.gps_timestamp)
            for g in gps_data
        ]

        # Özellikler çıkar
        features = extract_trip_features(gps_points)
        anomaly_features = features_to_anomaly_input(features)

        # Anomali tahmini yap
        anomaly_score, is_anomalous, flags, severity = self.detector.predict(anomaly_features)

        logger.info(f"🚨 Trip {trip.id}: Score={anomaly_score:.2f}, Severity={severity}, Flags={flags}")

        # Veritabanına kaydet (anomaly_score > 60 ise kaydet)
        if is_anomalous:
            # Trip ORM modelinde device_id yok; anomaly kaydı için GPS stream'inden al.
            device_id = next((g.device_id for g in gps_data if g.device_id is not None), None)
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
