"""
TYB MLService - Anomaly Detector
=================================
IsolationForest + rule engine with two distinct output categories:

  device_health   — GPS artifacts, signal loss, teleportation jumps
  driver_behavior — crash suspicion, harsh driving, statistically abnormal patterns

The key context signal is `gps_spike_ratio`. When a physical impossibility
(jerk > 50, accel > 15) is accompanied by a GPS spike, the cause is almost
certainly a connectivity dropout — not the driver. Without a GPS spike the
same numbers point to a real driving event.
"""

import joblib
import numpy as np
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """IsolationForest pipeline wrapper with categorized output"""

    def __init__(self, model_path: str):
        try:
            self.model = joblib.load(model_path)
            logger.info(f"✅ Anomaly model loaded: {model_path}")
        except FileNotFoundError:
            logger.warning(f"⚠️ Model file not found: {model_path}")
            self.model = None
        except Exception as e:
            logger.warning(f"⚠️ Model load error: {e}")
            self.model = None

        self.threshold = 60.0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, features: dict) -> dict:
        """
        Run anomaly detection and return categorized results.

        Returns:
            {
                'anomaly_score': float (0-100),
                'is_anomalous':  bool,
                'severity':      str  (worst-case across both categories),
                'device_health': {
                    'detected': bool,
                    'flags':    List[str],
                    'severity': str
                },
                'driver_behavior': {
                    'detected': bool,
                    'flags':    List[str],
                    'severity': str
                }
            }
        """
        anomaly_score = self._ml_score(features)

        device_flags, driver_flags, anomaly_score = self._classify_flags(
            features, anomaly_score
        )

        device_detected = len(device_flags) > 0
        driver_detected = len(driver_flags) > 0
        is_anomalous = device_detected or driver_detected

        device_severity = self._device_severity(device_flags) if device_detected else 'LOW'
        driver_severity = self._driver_severity(anomaly_score, driver_flags) if driver_detected else 'LOW'

        return {
            'anomaly_score': float(anomaly_score),
            'is_anomalous': is_anomalous,
            'severity': self._worst_severity(device_severity, driver_severity),
            'device_health': {
                'detected': device_detected,
                'flags': device_flags,
                'severity': device_severity,
            },
            'driver_behavior': {
                'detected': driver_detected,
                'flags': driver_flags,
                'severity': driver_severity,
            },
        }

    # ------------------------------------------------------------------
    # ML score
    # ------------------------------------------------------------------

    def _ml_score(self, features: dict) -> float:
        if self.model is None:
            return 50.0
        try:
            max_jerk = features.get('max_jerk', 0.0)
            min_jerk = features.get('min_jerk', 0.0)
            max_accel = features.get('max_accel', 0.0)
            min_accel = features.get('min_accel', 0.0)

            jerk_magnitude = features.get('jerk_magnitude', max(abs(max_jerk), abs(min_jerk)))
            accel_intensity = features.get('accel_intensity', max(abs(max_accel), abs(min_accel)))

            feature_vector = np.array([[
                features.get('gps_spike_ratio', 0.0),
                features.get('velocity_oscillation', 0.0),
                jerk_magnitude,
                accel_intensity,
                features.get('speed_variation_cv', 0.0),
                features.get('accel_spike_frequency', 0.0),
                features.get('duration_quality', 1.0),
                max_accel,
                min_accel,
            ]])

            raw_score = self.model.decision_function(feature_vector)[0]
            score = ((1.0 - raw_score) / 2.0) * 100.0
            return float(max(0.0, min(100.0, score)))

        except Exception as e:
            logger.error(f"ML scoring error: {e}")
            return 50.0

    # ------------------------------------------------------------------
    # Flag classification
    # ------------------------------------------------------------------

    def _classify_flags(
        self, features: dict, anomaly_score: float
    ):
        """
        Separate physical flags into device_health vs driver_behavior.

        Context rule: if a GPS spike is present, physically impossible values
        (jerk > 50, accel > 15) are caused by coordinate jumps — device issue.
        Without a GPS spike, the same values implicate the driver.
        """
        device_flags: List[str] = []
        driver_flags: List[str] = []

        gps_spike_present = features.get('gps_spike_ratio', 0.0) > 10.0
        jerk_val = max(
            abs(features.get('max_jerk', 0.0)),
            abs(features.get('min_jerk', 0.0))
        )
        accel_val = max(
            abs(features.get('max_accel', 0.0)),
            abs(features.get('min_accel', 0.0))
        )

        # --- Device health checks ---

        if gps_spike_present:
            device_flags.append('GPS_SPIKE')

        if features.get('velocity_oscillation', 0.0) > 5.0:
            # Velocity oscillation at this level is GPS signal noise, not driving
            device_flags.append('GPS_SIGNAL_NOISE')

        # --- Context-dependent: jerk > 50 (physically impossible for a vehicle) ---
        if jerk_val > 50.0:
            if gps_spike_present:
                # Coordinate jump caused by signal dropout then reconnect
                _add_unique(device_flags, 'GPS_TELEPORT_ARTIFACT')
            else:
                driver_flags.append('CRASH_SUSPICION')
            anomaly_score = max(anomaly_score, 90.0)

        # --- Context-dependent: acceleration > 15 m/s² ---
        if accel_val > 15.0:
            if gps_spike_present:
                _add_unique(device_flags, 'GPS_TELEPORT_ARTIFACT')
            else:
                _add_unique(driver_flags, 'CRASH_SUSPICION')
            anomaly_score = max(anomaly_score, 85.0)

        # --- Moderate jerk (5–50): only flag as driver behavior if no GPS spike ---
        if 5.0 < jerk_val <= 50.0 and not gps_spike_present:
            driver_flags.append('HARSH_DRIVING')

        # --- Pure ML anomaly: high score with no physical explanation ---
        # Only raised when no device issues explain the elevated score,
        # so it points clearly at an unusual driving pattern.
        if anomaly_score >= self.threshold and not driver_flags and not device_flags:
            driver_flags.append('ABNORMAL_DRIVING_PATTERN')

        return device_flags, driver_flags, anomaly_score

    # ------------------------------------------------------------------
    # Severity helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _device_severity(flags: List[str]) -> str:
        if 'GPS_TELEPORT_ARTIFACT' in flags:
            return 'HIGH'
        if len(flags) >= 2:
            return 'HIGH'
        return 'MEDIUM'

    @staticmethod
    def _driver_severity(score: float, flags: List[str]) -> str:
        if 'CRASH_SUSPICION' in flags:
            return 'CRITICAL'
        if score > 80.0 or len(flags) >= 2:
            return 'HIGH'
        if score >= 60.0 or len(flags) == 1:
            return 'MEDIUM'
        return 'LOW'

    @staticmethod
    def _worst_severity(s1: str, s2: str) -> str:
        order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        return s1 if order.index(s1) >= order.index(s2) else s2


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _add_unique(lst: List[str], value: str) -> None:
    if value not in lst:
        lst.append(value)
