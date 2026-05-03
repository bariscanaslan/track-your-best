"""
TYB MLService - Test Driver Scoring ve Anomaly Detection Jobs
==============================================================
Bu script driver scoring ve anomaly detection joblarını manuel olarak çalıştırır
"""

import sys
import logging
from datetime import datetime
from utils.logger import setup_logging

# Logging kurulumu
logger = setup_logging(log_level='INFO', use_json=False)


def main():
    """Ana test fonksiyonu"""
    logger.info("=" * 70)
    logger.info("🧪 Driver Scoring ve Anomaly Detection Jobs Test Başladı")
    logger.info("=" * 70)
    logger.info(f"Başlangıç Zamanı: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")

    try:
        # ============================================================
        # ANOMALY DETECTION JOB
        # ============================================================
        logger.info("🔍 ANOMALY DETECTION JOB Çalıştırılıyor...")
        logger.info("-" * 70)
        
        from jobs.anomaly_job import anomaly_job_handler
        
        try:
            anomaly_job_handler()
            logger.info("✅ ANOMALY DETECTION JOB başarıyla tamamlandı")
        except Exception as e:
            logger.error(f"❌ ANOMALY DETECTION JOB hatası: {e}", exc_info=True)
        
        logger.info("")
        logger.info("")

        # ============================================================
        # DRIVER SCORING JOB
        # ============================================================
        logger.info("📊 DRIVER SCORING JOB Çalıştırılıyor...")
        logger.info("-" * 70)
        
        from jobs.driver_scoring_job import driver_scoring_job_handler
        
        try:
            driver_scoring_job_handler()
            logger.info("✅ DRIVER SCORING JOB başarıyla tamamlandı")
        except Exception as e:
            logger.error(f"❌ DRIVER SCORING JOB hatası: {e}", exc_info=True)

        logger.info("")
        logger.info("=" * 70)
        logger.info("✅ Test Tamamlandı")
        logger.info(f"Bitiş Zamanı: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"❌ Test Hatası: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
