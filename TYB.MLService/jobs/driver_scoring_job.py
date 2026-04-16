"""
TYB MLService - Driver Scoring Job (v5 Production)
=================================================
- Tamamen Olay Bazlı (Event-based)
- Yumuşatılmış Üstel Ceza Eğrisi (Exponential Decay)
- ML modelinden bağımsız nihai skorlama
"""

import logging
import math
from datetime import datetime
from sqlalchemy.orm import Session

from db.database import get_session
from db.models import Trip, GpsData, DriverScore
from ml_core.preprocessing import GpsPoint, extract_trip_features, features_to_ml_input
from ml_core.driver_scorer import DriverScorer
from config.settings import MODELS

logger = logging.getLogger(__name__)

# --- TOLERANS VE CEZA KATSAYILARI ---
SPEED_LIMIT_MPS = 25.5
SMOOTHING_HOURS = 0.50

LAMBDA_SPEED = 0.04
LAMBDA_BRAKE = 0.05
LAMBDA_ACCEL = 0.04


class DriverScoringJob:
    def __init__(self):
        self.scorer = DriverScorer(MODELS["driver_scoring"])

    def run(self):
        logger.info("📊 Driver Scoring Job başladı.")
        db = get_session()
        try:
            trips = (
                db.query(Trip)
                .filter(
                    Trip.status == "completed",
                    Trip.driver_id.isnot(None),  # kritik düzeltme
                    ~db.query(DriverScore).filter(DriverScore.trip_id == Trip.id).exists(),
                )
                .limit(50)
                .all()
            )

            logger.info(f"📊 {len(trips)} trip scoring için hazır")

            for trip in trips:
                trip_id = str(trip.id)  # rollback sonrası da güvenli log için
                try:
                    self._score_trip(db, trip)
                except Exception as e:
                    db.rollback()  # kritik düzeltme
                    logger.error(f"❌ Trip {trip_id} hatası: {e}")

        finally:
            db.close()

    def _score_trip(self, db: Session, trip: Trip):
        if not trip.driver_id:
            logger.warning(f"⚠️ Trip {trip.id}: driver_id NULL, skip edildi")
            return

        gps_data = (
            db.query(GpsData)
            .filter(GpsData.trip_id == trip.id)
            .order_by(GpsData.gps_timestamp)
            .all()
        )

        if len(gps_data) < 10:
            logger.warning(f"⚠️ Trip {trip.id}: GPS verisi yetersiz ({len(gps_data)} points)")
            return

        gps_points = [GpsPoint(g.latitude, g.longitude, g.gps_timestamp) for g in gps_data]

        # 1. Tek Kaynak: Preprocessing'den gelen güvenilir feature'lar
        features = extract_trip_features(gps_points)
        if not features:
            logger.warning(f"⚠️ Trip {trip.id}: feature çıkarılamadı, skip edildi")
            return

        # 2. ML sadece referans için çalışsın
        ml_features = features_to_ml_input(features)
        ml_score, _ = self.scorer.predict(ml_features)

        # 3. Penalty hesabı
        duration_hours = features["duration_sec"] / 3600.0
        norm_factor = duration_hours + SMOOTHING_HOURS

        brake_penalty = (
            features["brake_event_count"] * 1.0
            + features["brake_severity_sum"] * 0.5
        ) / norm_factor

        accel_penalty = (
            features["accel_event_count"] * 1.0
            + features["accel_severity_sum"] * 0.5
        ) / norm_factor

        speed_excess = max(0, features["p95_speed_mps"] - SPEED_LIMIT_MPS)
        speed_penalty = (features["speeding_ratio_pct"] * 0.5) + (speed_excess * 1.0)

        # 4. Exponential decay
        speed_score = 100.0 * math.exp(-LAMBDA_SPEED * speed_penalty)
        brake_score = 100.0 * math.exp(-LAMBDA_BRAKE * brake_penalty)
        accel_score = 100.0 * math.exp(-LAMBDA_ACCEL * accel_penalty)

        # 5. Overall score
        min_score = min(speed_score, brake_score, accel_score)
        weighted_avg = (speed_score * 0.4) + (brake_score * 0.35) + (accel_score * 0.25)
        overall_score = (weighted_avg * 0.7) + (min_score * 0.3)

        logger.info(
            f"📈 Trip {trip.id}: Overall={overall_score:.1f} "
            f"(Hız:{speed_score:.1f}, Fren:{brake_score:.1f}, İvme:{accel_score:.1f})"
        )

        score = DriverScore(
            trip_id=trip.id,
            driver_id=trip.driver_id,
            overall_score=round(overall_score, 2),
            speed_score=round(speed_score, 2),
            acceleration_score=round(accel_score, 2),
            braking_score=round(brake_score, 2),
            idle_time_score=100.0,
            total_trips=1,
            total_distance_km=round(features["distance_m"] / 1000.0, 2),
            total_duration_seconds=int(features["duration_sec"]),
            speeding_events=int(features["speeding_seconds"]),
            harsh_acceleration_events=int(features["accel_event_count"]),
            harsh_braking_events=int(features["brake_event_count"]),
            period_type="TRIP",
            analysis_date=datetime.utcnow().date().isoformat(),
            calculated_at=datetime.utcnow(),
            model_metadata={
                "algo_version": "v5_production_event_based",
                "ml_reference_score": float(ml_score) if ml_score is not None else 0.0,
                "events": {
                    "brake_count": int(features["brake_event_count"]),
                    "brake_severity_sum": round(float(features["brake_severity_sum"]), 2),
                    "accel_count": int(features["accel_event_count"]),
                    "accel_severity_sum": round(float(features["accel_severity_sum"]), 2),
                    "speeding_seconds": round(float(features["speeding_seconds"]), 6),
                    "speeding_ratio_pct": round(float(features["speeding_ratio_pct"]), 2),
                },
            },
        )

        db.add(score)
        db.commit()

        logger.info(f"✅ Trip {trip.id}: driver score kaydedildi")


def driver_scoring_job_handler():
    job = DriverScoringJob()
    job.run()