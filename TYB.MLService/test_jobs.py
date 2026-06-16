"""Manual test runner for driver scoring and anomaly detection jobs."""

import sys
from datetime import datetime

from utils.logger import setup_logging

logger = setup_logging(log_level="INFO", use_json=False)


def main():
    """Run analytics jobs once for local validation."""
    logger.info("=" * 70)
    logger.info("Driver scoring and anomaly detection job test started")
    logger.info("=" * 70)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")

    try:
        logger.info("Running anomaly detection job...")
        logger.info("-" * 70)

        from jobs.anomaly_job import anomaly_job_handler

        try:
            anomaly_job_handler()
            logger.info("Anomaly detection job completed successfully")
        except Exception as exc:
            logger.error(f"Anomaly detection job failed: {exc}", exc_info=True)

        logger.info("")
        logger.info("")

        logger.info("Running driver scoring job...")
        logger.info("-" * 70)

        from jobs.driver_scoring_job import driver_scoring_job_handler

        try:
            driver_scoring_job_handler()
            logger.info("Driver scoring job completed successfully")
        except Exception as exc:
            logger.error(f"Driver scoring job failed: {exc}", exc_info=True)

        logger.info("")
        logger.info("=" * 70)
        logger.info("Test completed")
        logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 70)

    except Exception as exc:
        logger.error(f"Test failed: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
