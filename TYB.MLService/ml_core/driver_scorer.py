"""
TYB MLService - Driver Scoring (PKL)
=====================================
Random Forest modeli ile sürücü puanlandırması (PKL format)
"""

import joblib
import numpy as np
import logging
from typing import Dict, Tuple

logger = logging.getLogger(__name__)


class DriverScorer:
    """Random Forest model wrapper (PKL format)"""
    
    def __init__(self, model_path: str):
        """
        Args:
            model_path: PKL model dosyasının yolu
        """
        try:
            # PKL dosyasından modeli yükle
            self.pipeline = joblib.load(model_path)
            logger.info(f"✅ Driver scoring modeli yüklendi (PKL): {model_path}")
        except FileNotFoundError:
            logger.error(f"❌ Model dosyası bulunamadı: {model_path}")
            self.pipeline = None
        except Exception as e:
            logger.error(f"❌ Model yükleme hatası: {e}")
            self.pipeline = None
    
    def predict(self, features: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
        """
        Sürücü puanı tahmin et
        
        Args:
            features: 4 özellik dict'i
                {
                    'p95_speed_mps': float,
                    'harsh_accel_per_hour': float,
                    'harsh_brake_per_hour': float,
                    'stop_count_per_hour': float
                }
        
        Returns:
            (score: 0-100, debug_info: dict)
        """
        
        if self.pipeline is None:
            logger.warning("Model yüklenemedi, tahmin yapılamıyor")
            return 50.0, {}
        
        try:
            # Özellik sırası önemli!
            feature_order = [
                'p95_speed_mps',
                'harsh_accel_per_hour',
                'harsh_brake_per_hour',
                'stop_count_per_hour'
            ]
            
            feature_vector = np.array([
                [features.get(k, 0.0) for k in feature_order]
            ], dtype=np.float32)
            
            # Pipeline tahmin (scaler + model)
            score = self.pipeline.predict(feature_vector)[0]
            score = max(0.0, min(100.0, float(score)))
            
            debug_info = {
                'raw_score': float(score),
                'features': features,
                'feature_count': len(feature_vector[0])
            }
            
            logger.debug(f"Driver score predicted: {score:.2f}")
            return score, debug_info
            
        except Exception as e:
            logger.error(f"Tahmin hatası: {e}")
            return 50.0, {}

