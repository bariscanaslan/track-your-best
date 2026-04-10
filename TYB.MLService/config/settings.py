"""
TYB MLService - Ayarlar (Configuration)
========================================
Veritabanı bağlantısı, scheduler ayarları, model yolları
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# =============================================
# DATABASE SETTINGS
# =============================================
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://postgres:Tyb.1905@localhost:5432/trackyourbest_local'
)

# =============================================
# OSRM SETTINGS (ETA için gerekli!)
# =============================================
OSRM_BASE_URL = os.getenv('OSRM_URL', 'http://localhost:5000')

# =============================================
# TIMEZONE SETTINGS
# =============================================
TIMEZONE = 'Europe/Istanbul'

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
    'driver_scoring': 300,         # Her 5 dakika
    'eta_prediction': 20,         # Her 3 dakika ← ETA EKLENDİ!
}

# =============================================
# MODEL SETTINGS
# =============================================
MODELS_DIR = BASE_DIR / 'models_bin'
DATA_DIR = BASE_DIR / 'data'

MODELS = {
    'driver_scoring': MODELS_DIR / 'driver_scoring_model.pkl',
    'isolation_forest': MODELS_DIR / 'anomaly_model.pkl',
    'eta_model': MODELS_DIR / 'eta_model_istanbul.pkl',  # ← ETA EKLENDİ!
}

# ETA specific data files
ETA_TRAFFIC_PATTERNS = DATA_DIR / 'ibb_traffic_patterns_2024_2025.csv'  # ← ETA EKLENDİ!

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

# =============================================
# ETA PREDICTION SETTINGS (YENİ!)
# =============================================
ETA_BATCH_SIZE = 10  # Tek seferde işlenecek trip sayısı
ETA_RUSH_HOURS = [7, 8, 9, 16, 17, 18, 19, 20, 21]  # İstanbul rush saatleri

# =============================================
# VALIDATION
# =============================================
def validate_settings():
    """Validate that all required files exist"""
    
    # Check model files
    for name, path in MODELS.items():
        if not path.exists():
            print(f"⚠️  Warning: Model not found: {path}")
    
    # Check ETA traffic patterns
    if not ETA_TRAFFIC_PATTERNS.exists():
        print(f"⚠️  Warning: Traffic patterns not found: {ETA_TRAFFIC_PATTERNS}")
    
    print("✅ Settings validation complete")

if __name__ == "__main__":
    validate_settings()