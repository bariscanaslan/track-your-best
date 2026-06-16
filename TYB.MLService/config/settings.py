import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/trackyourbest",
)

OSRM_BASE_URL = os.getenv("OSRM_URL", "http://localhost:5000")
OSRM_API_KEY = os.getenv("OSRM_API_KEY", "")

TIMEZONE = "Europe/Istanbul"

SCHEDULER_CONFIG = {
    "apscheduler.schedulers.asyncio.AsyncIOScheduler": {
        "apscheduler.job_defaults.coalesce": "true",
        "apscheduler.job_defaults.max_instances": "1",
        "apscheduler.job_defaults.misfire_grace_time": "15",
    }
}

JOB_INTERVALS = {
    "anomaly_detection": 120,
    "driver_scoring": 300,
    "eta_prediction": 20,
}

MODELS_DIR = Path(os.getenv("MODELS_DIR", BASE_DIR / "models_bin"))
DATA_DIR = BASE_DIR / "data"

MODELS = {
    "driver_scoring": MODELS_DIR / "driver_scoring_model.pkl",
    "isolation_forest": MODELS_DIR / "anomaly_model.pkl",
    "eta_model": MODELS_DIR / "eta_model_istanbul.pkl",
}

ETA_TRAFFIC_PATTERNS = DATA_DIR / "ibb_traffic_patterns_2024_2025.csv"

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "json"

SPEED_THRESHOLD_MPS = 33.33
HARSH_ACCELERATION_MPS2 = 2.5
HARSH_BRAKING_MPS2 = 2.5
STOP_SPEED_MPS = 1.0

ANOMALY_THRESHOLD_SCORE = 50.0
GPS_SPIKE_THRESHOLD = 10.0
JERK_THRESHOLD = 2.0
OSCILLATION_THRESHOLD = 5.0

ETA_BATCH_SIZE = 10
ETA_RUSH_HOURS = [7, 8, 9, 16, 17, 18, 19, 20, 21]


def validate_settings():
    """Validate that all required local model/data files exist."""
    for name, path in MODELS.items():
        if not path.exists():
            print(f"Warning: Model not found: {path}")

    if not ETA_TRAFFIC_PATTERNS.exists():
        print(f"Warning: Traffic patterns not found: {ETA_TRAFFIC_PATTERNS}")

    print("Settings validation complete")


if __name__ == "__main__":
    validate_settings()
