# /routers/api_device.py

from fastapi import APIRouter, HTTPException
import secrets
from app.database_device import device_db  

router = APIRouter(prefix="/device", tags=["Devices"])

@router.post("/register")
async def register_new_device(device_name: str):
    mqtt_username = device_name
    mqtt_password = secrets.token_hex(8)
    secret_key = secrets.token_hex(32)

    try:
        device_db.register_device(device_name, mqtt_username, mqtt_password, secret_key)
    except Exception as e:
        raise HTTPException(400, f"Cihaz eklenemedi: {e}")

    return {
        "status": "success",
        "device_name": device_name,
        "mqtt_username": mqtt_username,
        "mqtt_password": mqtt_password,
        "secret_key": secret_key
    }
