"""
TYB MLService - Anomaly Detector (v2)
======================================
Changelog vs v1:
  - Replaced broken probability formula ((1 - raw_score) / 2 * 100) with
    a calibrated ml_anomaly_strength approach that reflects how negative
    the IsolationForest decision_function value actually is.
  - Rule-based flags now add deterministic score boosts on top of the ML
    baseline instead of only calling max(score, hard_floor).
  - raw_score is returned and stored correctly (was hardcoded to 0.0).
  - Full debug metadata is returned from predict() so the job can persist it.
  - Severity is derived from the final score so it is always consistent
    with confidence (no more "Medium priority / 49% confidence").
"""

import numpy as np
import logging
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tuning constants
# ---------------------------------------------------------------------------

# IsolationForest decision_function for a clear anomaly typically sits in
# [-0.3 … -0.05].  Multiplying -raw_score by SCALE_FACTOR maps that range
# onto [0 … 35] additional points above the 50-point ML baseline.
# Increase this value if your anomalies are still bunching near 50.
ML_SCALE_FACTOR: float = 100.0

# Maximum contribution from the ML model alone (beyond the 50-pt baseline)
ML_MAX_BOOST: float = 40.0

# Baseline score when prediction == -1 (anomaly) and raw_score ≈ 0
ML_ANOMALY_BASELINE: float = 50.0

# Baseline score when prediction == 1 (normal) — still penalise slightly
# so borderline-normal trips with flags can cross the threshold.
ML_NORMAL_BASELINE: float = 20.0

# Score boosts for each rule flag (additive, applied after ML base)
FLAG_BOOSTS: Dict[str, float] = {
    "IMPOSSIBLE_MOTION":          50.0,   # forces score near/above 90
    "CRASH_OR_TELEPORT_SUSPICION": 38.0,  # forces score near/above 85
    "JERK_HIGH":                  12.0,
    "OSCILLATION":                 8.0,
    "GPS_SPIKE":                   8.0,
}

# Hard floors applied after all boosts (safety net for critical flags)
FLAG_FLOORS: Dict[str, float] = {
    "IMPOSSIBLE_MOTION":          90.0,
    "CRASH_OR_TELEPORT_SUSPICION": 85.0,
}

# Anomaly threshold: trips below this are not saved
ANOMALY_THRESHOLD: float = 60.0

# Feature names — must match training order exactly
FEATURE_ORDER: List[str] = [
    "gps_spike_ratio",
    "velocity_oscillation",
    "jerk_magnitude",
    "accel_intensity",
    "speed_variation_cv",
    "accel_spike_frequency",
    "duration_quality",
    "max_accel",
    "min_accel",
]

ALGO_VERSION: str = "v2_calibrated_isolation_forest"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """
    IsolationForest anomaly detector with calibrated confidence scoring.

    The pipeline (scaler + IsolationForest) is loaded from a PKL file once.
    ``predict()`` returns a rich dict instead of a plain tuple so callers
    have full debug visibility.
    """

    def __init__(self, model_path: str):
        try:
            import joblib
            self.model = joblib.load(model_path)
            logger.info(f"✅ Anomaly model loaded (PKL): {model_path}")
        except FileNotFoundError:
            logger.warning(f"⚠️ Model file not found: {model_path}")
            self.model = None
        except Exception as exc:
            logger.warning(f"⚠️ Model load error: {exc}")
            self.model = None

        self.threshold = ANOMALY_THRESHOLD

    # ------------------------------------------------------------------
    def predict(self, features: dict) -> dict:
        """
        Run anomaly detection and return a fully documented result dict.

        Parameters
        ----------
        features : dict
            Output of ``features_to_anomaly_input()``.

        Returns
        -------
        dict with keys:
            anomaly_score     – float 0-100 (used for threshold comparison)
            confidence_score  – float 0.0-1.0 (stored in DB decimal column)
            is_anomalous      – bool
            flags             – List[str]
            severity          – str  CRITICAL / HIGH / MEDIUM / LOW
            debug             – dict  (full metadata for model_metadata column)
        """
        # --- Build feature vector -----------------------------------------
        max_jerk = features.get("max_jerk", 0.0)
        min_jerk = features.get("min_jerk", 0.0)
        max_accel = features.get("max_accel", 0.0)
        min_accel = features.get("min_accel", 0.0)

        jerk_magnitude = features.get(
            "jerk_magnitude", max(abs(max_jerk), abs(min_jerk))
        )
        accel_intensity = features.get(
            "accel_intensity", max(abs(max_accel), abs(min_accel))
        )

        feature_values = [
            features.get("gps_spike_ratio", 0.0),
            features.get("velocity_oscillation", 0.0),
            jerk_magnitude,
            accel_intensity,
            features.get("speed_variation_cv", 0.0),
            features.get("accel_spike_frequency", 0.0),
            features.get("duration_quality", 1.0),
            max_accel,
            min_accel,
        ]
        feature_vector = np.array([feature_values], dtype=np.float32)

        # --- ML scoring ---------------------------------------------------
        raw_score: float = 0.0
        model_prediction: int = 1      # 1 = normal, -1 = anomaly
        ml_anomaly_strength: float = 0.0
        ml_score: float = ML_NORMAL_BASELINE
        ml_available: bool = self.model is not None

        if ml_available:
            try:
                # predict() returns -1 (anomaly) or +1 (normal)
                model_prediction = int(self.model.predict(feature_vector)[0])

                # decision_function: more negative → stronger anomaly
                raw_score = float(self.model.decision_function(feature_vector)[0])

                if model_prediction == -1:
                    # -raw_score is positive when raw_score is negative
                    ml_anomaly_strength = max(0.0, -raw_score)
                    ml_score = ML_ANOMALY_BASELINE + min(
                        ML_MAX_BOOST, ml_anomaly_strength * ML_SCALE_FACTOR
                    )
                else:
                    # Normal prediction but may still be close to boundary.
                    # Give a small penalty proportional to how close to -1 it is.
                    closeness = max(0.0, -raw_score)   # positive only if raw<0
                    ml_score = ML_NORMAL_BASELINE + min(20.0, closeness * ML_SCALE_FACTOR)

            except Exception as exc:
                logger.error(f"ML prediction error: {exc}", exc_info=True)
                ml_available = False

        # --- Rule-based flags and boosts ----------------------------------
        flags: List[str] = []
        rule_score_boost: float = 0.0

        jerk_val = max(abs(features.get("max_jerk", 0.0)), abs(features.get("min_jerk", 0.0)))
        accel_val = max(abs(max_accel), abs(min_accel))

        if jerk_val > 50.0:
            flags.append("IMPOSSIBLE_MOTION")
        elif jerk_val > 5.0:
            flags.append("JERK_HIGH")

        if accel_val > 15.0:
            flags.append("CRASH_OR_TELEPORT_SUSPICION")

        if features.get("velocity_oscillation", 0.0) > 5.0:
            flags.append("OSCILLATION")

        if features.get("gps_spike_ratio", 0.0) > 10.0:
            flags.append("GPS_SPIKE")

        # Additive boosts from flags
        for flag in flags:
            rule_score_boost += FLAG_BOOSTS.get(flag, 0.0)

        # --- Combine ML + rule scores -------------------------------------
        combined_score = _clamp(ml_score + rule_score_boost)

        # Apply hard floors for safety-critical flags
        for flag in flags:
            floor = FLAG_FLOORS.get(flag)
            if floor is not None:
                combined_score = max(combined_score, floor)

        anomaly_score: float = round(_clamp(combined_score), 2)

        # --- Final decision -----------------------------------------------
        # Only save when the COMBINED score clears the threshold.
        # Rule flags alone do not force is_anomalous=True — they must push
        # the score over 60.  This eliminates "Medium / 49%" paradox.
        is_anomalous: bool = anomaly_score >= self.threshold

        severity: str = _determine_severity(anomaly_score, flags)

        confidence_score: float = round(anomaly_score / 100.0, 4)

        # --- Debug metadata -----------------------------------------------
        debug: dict = {
            "algo_version":         ALGO_VERSION,
            "ml_available":         ml_available,
            "model_prediction":     model_prediction,       # -1 or +1
            "raw_decision_score":   round(raw_score, 6),    # actual value, not 0.0
            "ml_anomaly_strength":  round(ml_anomaly_strength, 6),
            "ml_score":             round(ml_score, 2),
            "rule_flags":           flags,
            "rule_score_boost":     round(rule_score_boost, 2),
            "final_anomaly_score":  anomaly_score,
            "final_confidence_score": confidence_score,
            "severity":             severity,
            "feature_order":        FEATURE_ORDER,
            "feature_vector":       feature_values,
            "constants": {
                "ml_scale_factor":   ML_SCALE_FACTOR,
                "ml_max_boost":      ML_MAX_BOOST,
                "anomaly_baseline":  ML_ANOMALY_BASELINE,
                "normal_baseline":   ML_NORMAL_BASELINE,
                "flag_boosts":       FLAG_BOOSTS,
                "flag_floors":       FLAG_FLOORS,
                "threshold":         ANOMALY_THRESHOLD,
            },
        }

        logger.debug(
            f"Anomaly result: score={anomaly_score:.1f} conf={confidence_score:.2f} "
            f"severity={severity} flags={flags} raw={raw_score:.4f}"
        )

        return {
            "anomaly_score":    anomaly_score,
            "confidence_score": confidence_score,
            "is_anomalous":     is_anomalous,
            "flags":            flags,
            "severity":         severity,
            "debug":            debug,
        }


# ---------------------------------------------------------------------------
# Severity helper (module-level so it can be unit-tested independently)
# ---------------------------------------------------------------------------

def _determine_severity(score: float, flags: List[str]) -> str:
    """
    Map final anomaly score + flags to a severity label.
    Consistent with the confidence ranges specified in the requirements:

        score ≥ 90  or IMPOSSIBLE_MOTION              → CRITICAL
        score ≥ 75  or CRASH_OR_TELEPORT_SUSPICION
                    or ≥ 2 flags                       → HIGH
        score ≥ 60  or any flag                        → MEDIUM
        otherwise                                      → LOW
    """
    if score >= 90.0 or "IMPOSSIBLE_MOTION" in flags:
        return "CRITICAL"
    if score >= 75.0 or "CRASH_OR_TELEPORT_SUSPICION" in flags or len(flags) >= 2:
        return "HIGH"
    if score >= 60.0 or len(flags) >= 1:
        return "MEDIUM"
    return "LOW"