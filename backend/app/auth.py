# auth.py

from app.database_gps import gps_db
from typing import Optional

def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = gps_db.authenticate_user(username=username, password=password)
    
    if user:
        return {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name
        }
    
    return None
