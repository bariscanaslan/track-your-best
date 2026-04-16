"""
TYB MLService - Scheduler (APScheduler)
======================================
Zamanlanmış görevleri yönet ve çalıştır
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from config.settings import JOB_INTERVALS
from jobs.anomaly_job import anomaly_job_handler
from jobs.driver_scoring_job import driver_scoring_job_handler
from jobs.eta_prediction_job import eta_prediction_job_handler  # ← YENİ IMPORT!

logger = logging.getLogger(__name__)


class JobScheduler:
    """Zamanlanmış görevleri yönet"""

    def __init__(self):
        self.scheduler = BackgroundScheduler()

    def start(self):
        """Scheduler'ı başlat ve görevleri ekle"""
        logger.info("🚀 Scheduler başlatılıyor...")

        # Anomali Detection Job
        self.scheduler.add_job(
            anomaly_job_handler,
            trigger=IntervalTrigger(seconds=JOB_INTERVALS['anomaly_detection']),
            id='anomaly_job',
            name='Anomali Detection',
            coalesce=True,
            max_instances=1
        )
        logger.info(f"✅ Anomali Job eklendi (interval: {JOB_INTERVALS['anomaly_detection']}s)")

        # Driver Scoring Job
        self.scheduler.add_job(
            driver_scoring_job_handler,
            trigger=IntervalTrigger(seconds=JOB_INTERVALS['driver_scoring']),
            id='driver_scoring_job',
            name='Driver Scoring',
            coalesce=True,
            max_instances=1
        )
        logger.info(f"✅ Driver Scoring Job eklendi (interval: {JOB_INTERVALS['driver_scoring']}s)")

        # ETA Prediction Job (DEVRE DIŞI - test için)
        # self.scheduler.add_job(
        #     eta_prediction_job_handler,
        #     trigger=IntervalTrigger(seconds=JOB_INTERVALS['eta_prediction']),
        #     id='eta_prediction_job',
        #     name='ETA Prediction',
        #     coalesce=True,
        #     max_instances=1
        # )
        # logger.info(f"✅ ETA Prediction Job eklendi (interval: {JOB_INTERVALS['eta_prediction']}s)")

        # Scheduler'ı başlat
        self.scheduler.start()
        logger.info("✅ Scheduler başlatıldı (ETA Prediction devre dışı)")

    def stop(self):
        """Scheduler'ı durdur"""
        logger.info("🛑 Scheduler durduruluyor...")
        self.scheduler.shutdown(wait=False)
        logger.info("✅ Scheduler durduruldu")

    def get_jobs(self):
        """Aktif görevleri listele"""
        return self.scheduler.get_jobs()


# Global scheduler instance
_scheduler = None


def get_scheduler() -> JobScheduler:
    """Singleton scheduler instance döndür"""
    global _scheduler
    if _scheduler is None:
        _scheduler = JobScheduler()
    return _scheduler