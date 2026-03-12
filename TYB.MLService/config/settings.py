"""
TYB MLService - Ayarlar (Configuration)
========================================
Veritabanı bağlantısı, scheduler ayarları, model yolları
"""

import os
from dotenv import load_dotenv

load_dotenv()

# =============================================
# DATABASE SETTINGS
# =============================================
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://postgres:password@localhost:5432/tyb_production'
)

# =============================================
# SCHEDULER SETTINGS (APScheduler)
# =============================================
SCHEDULER_CONFIG = {
    'apscheduler.schedulers.asyncio.AsyncIOScheduler': {
        'apscheduler.job_defaults.coalesce': 'true',
        'apscheduler.job_defaults.max_instances': '1',
        'apscheduler.job_defaults.misfire_grace_time': '15'
    }
}

# Job Intervals (saniye cinsinden)
JOB_INTERVALS = {
    'anomaly_detection': 120,      # Her 2 dakika
    'eta_prediction': 300,         # Her 5 dakika
    'route_optimization': 600      # Her 10 dakika
}

# =============================================
# MODEL SETTINGS
# =============================================
MODELS_DIR = os.path.join(os.path.dirname(__file__), '../models_bin')

MODELS = {
    'driver_scoring': os.path.join(MODELS_DIR, 'driver_scoring_model.pkl'),
    'isolation_forest': os.path.join(MODELS_DIR, 'anomaly_model.pkl'),
    'eta_predictor': os.path.join(MODELS_DIR, 'eta_predictor.pkl')
}

# =============================================
# LOGGING SETTINGS
# =============================================
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = 'json'  # JSON formatında loglama

# =============================================
# FEATURE EXTRACTION THRESHOLDS
# =============================================
SPEED_THRESHOLD_MPS = 33.33  # 120 km/h
HARSH_ACCELERATION_MPS2 = 2.5
HARSH_BRAKING_MPS2 = 2.5
STOP_SPEED_MPS = 1.0

# =============================================
# ANOMALY DETECTION THRESHOLDS
# =============================================
ANOMALY_THRESHOLD_SCORE = 50.0  # >50 = anomali
GPS_SPIKE_THRESHOLD = 10.0
JERK_THRESHOLD = 2.0
OSCILLATION_THRESHOLD = 5.0

