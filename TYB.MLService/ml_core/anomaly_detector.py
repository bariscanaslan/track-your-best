"""
TYB MLService - Anomali Detector
================================
IsolationForest modeli ile anomali tespiti (PKL format)
"""

import joblib
import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """IsolationForest modeli wrapper (PKL format)"""

    def __init__(self, model_path: str):
        """
        Args:
            model_path: Anomaly model PKL dosyasının yolu
        """
        try:
            # PKL dosyasından modeli yükle (Bu model zaten Scaler içeriyor - Pipeline)
            self.model = joblib.load(model_path)
            logger.info(f"✅ Anomali modeli yüklendi (PKL): {model_path}")
        except FileNotFoundError:
            logger.warning(f"⚠️ Model dosyası bulunamadı: {model_path}")
            self.model = None
        except Exception as e:
            logger.warning(f"⚠️ Model yükleme hatası: {e}")
            self.model = None

        # EŞİK DEĞERİ: Normal sürücülerin listeye girmemesi için 60'a çıkardık
        self.threshold = 60.0

    def predict(self, features: dict) -> Tuple[float, bool, List[str], str]:
        """
        Anomali tespiti yap

        Args:
            features: Preprocessing'den gelen özellik dict'i

        Returns:
            (anomaly_score: 0-100, is_anomalous: bool, flags: List[str], severity: str)
        """
        anomaly_score = 50.0

        if self.model is not None:
            try:
                # 1. UYUMSUZ ANAHTARLARI EŞLEŞTİR (Sorunun Çözümü)
                max_jerk = features.get('max_jerk', 0.0)
                min_jerk = features.get('min_jerk', 0.0)
                max_accel = features.get('max_accel', 0.0)
                min_accel = features.get('min_accel', 0.0)

                jerk_magnitude = features.get('jerk_magnitude', max(abs(max_jerk), abs(min_jerk)))
                accel_intensity = features.get('accel_intensity', max(abs(max_accel), abs(min_accel)))

                # Özellikler dizisine dönüştür (Eğitim sırasıyla BİREBİR aynı olmalı)
                feature_order = [
                    features.get('gps_spike_ratio', 0.0),
                    features.get('velocity_oscillation', 0.0),
                    jerk_magnitude,
                    accel_intensity,
                    features.get('speed_variation_cv', 0.0),
                    features.get('accel_spike_frequency', 0.0),
                    features.get('duration_quality', 1.0),
                    max_accel,
                    min_accel
                ]

                # Özellik vektörü oluştur
                feature_vector = np.array([feature_order])

                # Model tahmin (Scaler kullanmıyoruz çünkü model Pipeline olarak kaydedildi)
                raw_score = self.model.decision_function(feature_vector)[0]

                # -1 (Anomali) ile +1 (Normal) arasını 0-100 arasına dönüştür
                anomaly_score = ((1.0 - raw_score) / 2.0) * 100.0
                anomaly_score = max(0.0, min(100.0, float(anomaly_score)))

            except Exception as e:
                logger.error(f"Anomali ML tahmini hatası: {e}")

        # ---------------------------------------------------------
        # FİZİKSEL KURAL MOTORU VE BAYRAKLAR (RULE-BASED OVERRIDE)
        # ---------------------------------------------------------
        flags = []

        # Fiziksel olarak imkansız sarsıntı (Jerk > 50)
        jerk_val = max(abs(features.get('max_jerk', 0.0)), abs(features.get('min_jerk', 0.0)))
        if jerk_val > 50.0:
            flags.append('IMPOSSIBLE_MOTION')
            anomaly_score = max(anomaly_score, 90.0)  # Skoru zorla fırlat
        elif jerk_val > 5.0:
            flags.append('JERK_HIGH')

        # Çarpışma veya Işınlanma Şüphesi (İvme > 15 m/s2)
        accel_val = max(abs(features.get('max_accel', 0.0)), abs(features.get('min_accel', 0.0)))
        if accel_val > 15.0:
            flags.append('CRASH_OR_TELEPORT_SUSPICION')
            anomaly_score = max(anomaly_score, 85.0)

        # Garip Hız Dalgalanması
        if features.get('velocity_oscillation', 0.0) > 5.0:
            flags.append('OSCILLATION')

        if features.get('gps_spike_ratio', 0.0) > 10.0:
            flags.append('GPS_SPIKE')

        # ---------------------------------------------------------
        # NİHAİ KARAR
        # ---------------------------------------------------------
        # Skor 60'ı geçtiyse VEYA fiziksel bir bayrak kalktıysa Anomali'dir.
        is_anomalous = anomaly_score >= self.threshold or len(flags) > 0

        severity = self._determine_severity(anomaly_score, flags)

        return float(anomaly_score), is_anomalous, flags, severity

    @staticmethod
    def _determine_severity(score: float, flags: List[str]) -> str:
        """Severity (ağırlık) belirle"""
        if score > 80.0 or 'IMPOSSIBLE_MOTION' in flags or 'CRASH_OR_TELEPORT_SUSPICION' in flags:
            return 'CRITICAL'
        elif score > 70.0 or len(flags) >= 2:
            return 'HIGH'
        elif score >= 60.0 or len(flags) == 1:
            return 'MEDIUM'
        else:
            return 'LOW'