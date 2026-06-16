import signal
import sys
import time

from config.settings import LOG_LEVEL
from jobs.scheduler import get_scheduler
from utils.logger import setup_logging

logger = setup_logging(log_level=LOG_LEVEL, use_json=False)


def main():
    """Start the ML worker service."""
    logger.info("=" * 60)
    logger.info("TYB ML Worker Service is starting...")
    logger.info("=" * 60)

    try:
        scheduler = get_scheduler()
        scheduler.start()

        logger.info("Service started successfully")
        logger.info("Active jobs:")
        for job in scheduler.get_jobs():
            logger.info(f"  - {job.name} (id: {job.id})")

        def signal_handler(sig, frame):
            logger.info("Shutdown signal received...")
            scheduler.stop()
            logger.info("Service stopped")
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        logger.info("Service is running... Press CTRL+C to stop.")

        while True:
            time.sleep(1)

    except Exception as exc:
        logger.error(f"Service error: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
