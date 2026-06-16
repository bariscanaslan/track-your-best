"""APScheduler job registration for TYB.MLService."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from config.settings import JOB_INTERVALS
from jobs.anomaly_job import anomaly_job_handler
from jobs.driver_scoring_job import driver_scoring_job_handler
from jobs.eta_prediction_job import eta_prediction_job_handler

logger = logging.getLogger(__name__)


class JobScheduler:
    """Manage scheduled background jobs."""

    def __init__(self):
        self.scheduler = BackgroundScheduler()

    def start(self):
        """Start the scheduler and register jobs."""
        logger.info("Scheduler is starting...")

        self.scheduler.add_job(
            anomaly_job_handler,
            trigger=IntervalTrigger(seconds=JOB_INTERVALS["anomaly_detection"]),
            id="anomaly_job",
            name="Anomaly Detection",
            coalesce=True,
            max_instances=1,
        )
        logger.info(
            f"Anomaly job registered (interval: {JOB_INTERVALS['anomaly_detection']}s)"
        )

        self.scheduler.add_job(
            driver_scoring_job_handler,
            trigger=IntervalTrigger(seconds=JOB_INTERVALS["driver_scoring"]),
            id="driver_scoring_job",
            name="Driver Scoring",
            coalesce=True,
            max_instances=1,
        )
        logger.info(
            f"Driver scoring job registered (interval: {JOB_INTERVALS['driver_scoring']}s)"
        )

        self.scheduler.add_job(
            eta_prediction_job_handler,
            trigger=IntervalTrigger(seconds=JOB_INTERVALS["eta_prediction"]),
            id="eta_prediction_job",
            name="ETA Prediction",
            coalesce=True,
            max_instances=1,
        )
        logger.info(
            f"ETA prediction job registered (interval: {JOB_INTERVALS['eta_prediction']}s)"
        )

        self.scheduler.start()
        logger.info("Scheduler started")

    def stop(self):
        """Stop the scheduler."""
        logger.info("Scheduler is stopping...")
        self.scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")

    def get_jobs(self):
        """Return active jobs."""
        return self.scheduler.get_jobs()


_scheduler = None


def get_scheduler() -> JobScheduler:
    """Return the singleton scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = JobScheduler()
    return _scheduler
