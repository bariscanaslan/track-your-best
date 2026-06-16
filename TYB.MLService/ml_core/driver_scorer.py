"""Driver scoring model loader."""

import logging
from typing import Dict, Tuple

import joblib
import numpy as np

logger = logging.getLogger(__name__)


class DriverScorer:
    """Random Forest model wrapper for PKL model files."""

    def __init__(self, model_path: str):
        try:
            self.pipeline = joblib.load(model_path)
            logger.info(f"Driver scoring model loaded: {model_path}")
        except FileNotFoundError:
            logger.error(f"Model file not found: {model_path}")
            self.pipeline = None
        except Exception as exc:
            logger.error(f"Model loading error: {exc}")
            self.pipeline = None

    def predict(self, features: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
        """Predict a driver score from the expected feature dictionary."""
        if self.pipeline is None:
            logger.warning("Model is not loaded; prediction cannot be made")
            return 50.0, {}

        try:
            feature_order = [
                "p95_speed_mps",
                "harsh_accel_per_hour",
                "harsh_brake_per_hour",
                "stop_count_per_hour",
            ]

            feature_vector = np.array(
                [[features.get(k, 0.0) for k in feature_order]],
                dtype=np.float32,
            )

            score = self.pipeline.predict(feature_vector)[0]
            score = max(0.0, min(100.0, float(score)))

            debug_info = {
                "raw_score": float(score),
                "features": features,
                "feature_count": len(feature_vector[0]),
            }

            logger.debug(f"Driver score predicted: {score:.2f}")
            return score, debug_info

        except Exception as exc:
            logger.error(f"Prediction error: {exc}")
            return 50.0, {}
