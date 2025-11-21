from passlib.context import CryptContext
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Basit kullanıcılar
USERS_DB = {
    "gps_client": {
        "username": "gps_client",
        "password": "gps123456",  # Geçici: plain text
        "device_id": "gps_device_001"
    },
    "admin": {
        "username": "admin",
        "password": "admin123",  # Geçici: plain text
        "device_id": "admin_device"
    }
}

def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Kullanıcı authentication"""
    user = USERS_DB.get(username)
    if not user:
        return None
    # Geçici: direkt karşılaştırma
    if user["password"] != password:
        return None
    return user 