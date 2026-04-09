"""
TYB MLService - Ana Giriş Noktası
===============================
Scheduler'ı başlat ve servisi çalıştır
"""

import sys
import signal
import logging
from utils.logger import setup_logging
from jobs.scheduler import get_scheduler
from config.settings import LOG_LEVEL

# Logging'i konfigüre et (human-readable format)
logger = setup_logging(log_level=LOG_LEVEL, use_json=False)


def main():
    """Ana fonksiyon"""
    logger.info("=" * 60)
    logger.info("🚀 TYB ML Worker Service başlatılıyor...")
    logger.info("=" * 60)

    try:
        # Scheduler'ı al ve başlat
        scheduler = get_scheduler()
        scheduler.start()

        logger.info("✅ Service başarıyla başlatıldı")
        logger.info("📊 Aktif Jobs:")
        for job in scheduler.get_jobs():
            logger.info(f"  - {job.name} (id: {job.id})")

        # Graceful shutdown için signal handler'ı set et
        def signal_handler(sig, frame):
            logger.info("🛑 Shutdown sinyali alındı...")
            scheduler.stop()
            logger.info("✅ Service kapatıldı")
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Service'i çalıştırmaya devam et (asenkron)
        logger.info("⏳ Service çalışıyor... (CTRL+C ile kapatmak için)")

        import time
        while True:
            time.sleep(1)

    except Exception as e:
        logger.error(f"❌ Service hatası: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()