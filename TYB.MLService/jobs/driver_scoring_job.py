"""
TYB MLService - Driver Scoring Job (Formula Only, v7)
=====================================================
Changelog from previous versions:
  - PKL / joblib / RandomForest completely removed.
  - Overall score is derived exclusively from formula-based sub-scores.
  - Smoothed exponential-decay penalties prevent short trips from being
    unfairly penalised by a single event.
  - A clean-trip cap (≤ 95) avoids unrealistic perfect scores.
  - Field-name discrepancy between `speeding_seconds` (feature) and
    `speeding_events` (DB column) is documented explicitly.
  - Full debug metadata is stored in model_metadata for every trip.
"""

import logging
import math
from datetime import datetime
from sqlalchemy.orm import Session

from db.database import get_session
from db.models import Trip, GpsData, DriverScore
from ml_core.preprocessing import GpsPoint, extract_trip_features

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring constants — all tunable from a config file if needed
# ---------------------------------------------------------------------------

#: Urban/suburban speed threshold (≈ 91.8 km/h).  Adjust to match your
#: operational context (city vs. highway fleet).
SPEED_LIMIT_MPS: float = 25.5          # m/s  (~91.8 km/h)

#: Added to trip duration (hours) before dividing brake/accel penalties.
#: Prevents a single event in a 2-minute trip from collapsing the score.
SMOOTHING_HOURS: float = 0.75

#: Decay rates for the exponential penalty curves.
#: Larger λ  → steeper drop for the same penalty value.
LAMBDA_SPEED: float = 0.028
LAMBDA_BRAKE: float = 0.040
LAMBDA_ACCEL: float = 0.035

#: Sub-score weights — must sum to 1.0.
W_SPEED: float = 0.40
W_BRAKE: float = 0.35
W_ACCEL: float = 0.25

#: Blend between weighted average and the weakest sub-score.
#: 0.80 / 0.20 means the worst pillar pulls the overall score down slightly.
BLEND_WEIGHTED: float = 0.80
BLEND_MIN:      float = 0.20

#: Cap applied to every score when the trip is completely event-free.
#: Avoids unrealistic 100/100 for very short or trivially easy trips.
CLEAN_TRIP_CAP: float = 95.0

ALGO_VERSION: str = "v7_formula_only"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clamp_score(value: float) -> float:
    """Clamp *value* to [0, 100]."""
    return max(0.0, min(100.0, value))


def _exp_score(penalty: float, lam: float) -> float:
    """Return ``clamp(100 * exp(-λ * penalty))``."""
    return clamp_score(100.0 * math.exp(-lam * penalty))


# ---------------------------------------------------------------------------
# Core scoring logic (pure function — easy to unit-test in isolation)
# ---------------------------------------------------------------------------

def compute_driver_scores(features: dict) -> dict:
    """
    Compute speed, braking, acceleration, and overall scores from *features*.

    Parameters
    ----------
    features:
        Dict produced by ``extract_trip_features``.  Expected keys:

        - ``duration_sec``        – trip length in seconds
        - ``p95_speed_mps``       – 95th-percentile speed (m/s)
        - ``speeding_ratio_pct``  – fraction of time above limit (0-100)
        - ``speeding_seconds``    – raw seconds spent speeding
        - ``brake_event_count``   – number of harsh-braking events
        - ``brake_severity_sum``  – summed deceleration severity
        - ``accel_event_count``   – number of harsh-acceleration events
        - ``accel_severity_sum``  – summed acceleration severity
        - ``distance_m``          – trip distance in metres

    Returns
    -------
    dict with keys:
        ``speed_score``, ``brake_score``, ``accel_score``,
        ``overall_score``, ``penalties``, ``is_clean_trip``
    """
    # --- Smoothing factor -------------------------------------------------
    duration_hours = max(features["duration_sec"] / 3600.0, 0.0)
    norm_factor = duration_hours + SMOOTHING_HOURS

    # --- Speed penalty ----------------------------------------------------
    # Two components:
    #   1. speeding_ratio_pct  – how much of the trip was spent speeding
    #   2. speed_excess        – how far above the limit the 95th-%ile is
    # Note: speed_penalty is NOT divided by norm_factor because speeding_ratio
    # is already a ratio (self-normalised). Dividing would make long trips with
    # sustained speeding look artificially better.
    speed_excess  = max(0.0, features["p95_speed_mps"] - SPEED_LIMIT_MPS)
    speed_penalty = (
        (features["speeding_ratio_pct"] * 0.35)
        + (speed_excess * 1.5)
    )

    # --- Braking penalty --------------------------------------------------
    # Divided by norm_factor so that a single harsh event in a 3-minute trip
    # is not as damaging as the same event repeated across a 30-minute trip.
    brake_penalty = (
        (features["brake_event_count"] * 1.2)
        + (features["brake_severity_sum"] * 0.7)
    ) / norm_factor

    # --- Acceleration penalty ---------------------------------------------
    accel_penalty = (
        (features["accel_event_count"] * 1.0)
        + (features["accel_severity_sum"] * 0.6)
    ) / norm_factor

    # --- Sub-scores -------------------------------------------------------
    speed_score = _exp_score(speed_penalty, LAMBDA_SPEED)
    brake_score = _exp_score(brake_penalty, LAMBDA_BRAKE)
    accel_score = _exp_score(accel_penalty, LAMBDA_ACCEL)

    # --- Overall score ----------------------------------------------------
    # Weighted average blended with the minimum sub-score so that one very
    # poor pillar always drags the overall score downward.
    weighted_avg  = (speed_score * W_SPEED) + (brake_score * W_BRAKE) + (accel_score * W_ACCEL)
    min_score     = min(speed_score, brake_score, accel_score)
    overall_score = clamp_score((weighted_avg * BLEND_WEIGHTED) + (min_score * BLEND_MIN))

    # --- Clean-trip cap ---------------------------------------------------
    # If zero events of every kind occurred, cap all scores at CLEAN_TRIP_CAP.
    # This prevents a perfectly flat, short-circuit trip from receiving 100/100.
    is_clean_trip = (
        features["speeding_seconds"] == 0
        and features["brake_event_count"] == 0
        and features["accel_event_count"] == 0
    )
    if is_clean_trip:
        speed_score   = min(speed_score,   CLEAN_TRIP_CAP)
        brake_score   = min(brake_score,   CLEAN_TRIP_CAP)
        accel_score   = min(accel_score,   CLEAN_TRIP_CAP)
        overall_score = min(overall_score, CLEAN_TRIP_CAP)

    return {
        "speed_score":   round(speed_score,   2),
        "brake_score":   round(brake_score,   2),
        "accel_score":   round(accel_score,   2),
        "overall_score": round(overall_score, 2),
        "is_clean_trip": is_clean_trip,
        "penalties": {
            "speed_penalty": round(speed_penalty, 4),
            "brake_penalty": round(brake_penalty, 4),
            "accel_penalty": round(accel_penalty, 4),
            "speed_excess_mps": round(speed_excess, 4),
            "norm_factor_hours": round(norm_factor, 4),
        },
    }


# ---------------------------------------------------------------------------
# Job orchestrator
# ---------------------------------------------------------------------------

class DriverScoringJob:
    """
    Picks up completed trips that have not yet been scored, computes
    formula-based driver scores, and persists them to ``DriverScore``.

    No ML model is loaded or referenced at any point.
    """

    def run(self) -> None:
        logger.info("Driver scoring job started.")
        db = get_session()
        try:
            # Fetch completed trips that have no DriverScore yet
            unscored_trips = (
                db.query(Trip)
                .filter(
                    Trip.status == "completed",
                    Trip.driver_id.isnot(None),
                    ~db.query(DriverScore)
                    .filter(DriverScore.trip_id == Trip.id)
                    .exists(),
                )
                .limit(50)
                .all()
            )

            logger.info(f"{len(unscored_trips)} trips are ready for scoring")

            for trip in unscored_trips:
                try:
                    self._score_trip(db, trip)
                except Exception as exc:
                    db.rollback()
                    logger.error(f"Trip {trip.id} processing failed: {exc}", exc_info=True)

        finally:
            db.close()

    # ------------------------------------------------------------------
    def _score_trip(self, db: Session, trip: Trip) -> None:
        trip_id = str(trip.id)

        # Guard: driver_id must be present (already filtered, but be explicit)
        if not trip.driver_id:
            logger.warning(f"Trip {trip_id}: driver_id is NULL; skipped")
            return

        # Fetch GPS points ordered by timestamp
        gps_rows = (
            db.query(GpsData)
            .filter(GpsData.trip_id == trip.id)
            .order_by(GpsData.gps_timestamp)
            .all()
        )

        if len(gps_rows) < 10:
            logger.warning(
                f"Trip {trip_id}: insufficient GPS data "
                f"({len(gps_rows)} points, minimum 10 required); skipped"
            )
            return

        gps_points = [
            GpsPoint(g.latitude, g.longitude, g.gps_timestamp)
            for g in gps_rows
        ]

        features = extract_trip_features(gps_points)
        if not features:
            logger.warning(f"Trip {trip_id}: feature extraction failed; skipped")
            return

        # Compute all scores via the pure formula function
        result = compute_driver_scores(features)

        speed_score   = result["speed_score"]
        brake_score   = result["brake_score"]
        accel_score   = result["accel_score"]
        overall_score = result["overall_score"]
        penalties     = result["penalties"]

        logger.info(
            f"📈 Trip {trip_id}: Overall={overall_score:.1f} | "
            f"Speed={speed_score:.1f}  Braking={brake_score:.1f}  Accel={accel_score:.1f} | "
            f"TemizTrip={result['is_clean_trip']}"
        )

        # ------------------------------------------------------------------
        # DB field note
        # ------------------------------------------------------------------
        # The DriverScore model has a column called `speeding_events`, but
        # the feature dict supplies `speeding_seconds` (a duration, not a
        # count).  We store speeding_seconds in that column intentionally;
        # the true semantic is captured in model_metadata below.
        # If the schema is ever migrated, rename the column to
        # `speeding_duration_seconds` for clarity.
        # ------------------------------------------------------------------

        score_record = DriverScore(
            trip_id=trip.id,
            driver_id=trip.driver_id,

            overall_score=overall_score,
            speed_score=speed_score,
            braking_score=brake_score,           # maps to DB column `braking_score`
            acceleration_score=accel_score,      # maps to DB column `acceleration_score`

            # idle_time is not yet modelled — default to neutral 100
            idle_time_score=100.0,

            total_trips=1,
            total_distance_km=round(features["distance_m"] / 1000.0, 2),
            total_duration_seconds=int(features["duration_sec"]),

            # ⚠️ Column name mismatch: `speeding_events` stores seconds here.
            speeding_events=int(features["speeding_seconds"]),
            harsh_acceleration_events=int(features["accel_event_count"]),
            harsh_braking_events=int(features["brake_event_count"]),

            period_type="TRIP",
            analysis_date=datetime.utcnow().date().isoformat(),
            calculated_at=datetime.utcnow(),

            model_metadata={
                "algo_version": ALGO_VERSION,
                # Raw features used for scoring
                "input_features": {
                    "duration_sec":        round(float(features["duration_sec"]), 2),
                    "distance_m":          round(float(features["distance_m"]), 2),
                    "p95_speed_mps":       round(float(features["p95_speed_mps"]), 4),
                    "speeding_ratio_pct":  round(float(features["speeding_ratio_pct"]), 4),
                    # NOTE: stored as `speeding_events` in DB — see comment above
                    "speeding_seconds":    round(float(features["speeding_seconds"]), 4),
                    "brake_event_count":   int(features["brake_event_count"]),
                    "brake_severity_sum":  round(float(features["brake_severity_sum"]), 4),
                    "accel_event_count":   int(features["accel_event_count"]),
                    "accel_severity_sum":  round(float(features["accel_severity_sum"]), 4),
                },
                # Intermediate penalty values
                "penalties": penalties,
                # Final scores
                "scores": {
                    "speed_score":   speed_score,
                    "brake_score":   brake_score,
                    "accel_score":   accel_score,
                    "overall_score": overall_score,
                    "is_clean_trip": result["is_clean_trip"],
                },
                # Scoring constants snapshot (helps reproduce past scores)
                "constants": {
                    "speed_limit_mps": SPEED_LIMIT_MPS,
                    "smoothing_hours": SMOOTHING_HOURS,
                    "lambda_speed":    LAMBDA_SPEED,
                    "lambda_brake":    LAMBDA_BRAKE,
                    "lambda_accel":    LAMBDA_ACCEL,
                    "weights":         {"speed": W_SPEED, "brake": W_BRAKE, "accel": W_ACCEL},
                    "blend":           {"weighted": BLEND_WEIGHTED, "min": BLEND_MIN},
                    "clean_trip_cap":  CLEAN_TRIP_CAP,
                },
            },
        )

        db.add(score_record)
        db.commit()
        logger.info(f"✅ Trip {trip_id}: DriverScore kaydedildi (driver={trip.driver_id})")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def driver_scoring_job_handler() -> None:
    """Celery / APScheduler task entry point."""
    job = DriverScoringJob()
    job.run()
