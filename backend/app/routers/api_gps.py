# /routers/api_gps.py

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.utils.jwt_utils import get_current_user
from app.database_device import device_db
from app.database_gps import gps_db
from app.models import GPSData

router = APIRouter(prefix="/gps", tags=["GPS"])

@router.get("/last", response_model=GPSData)
async def last_gps(
    device_name: Optional[str] = None,
    user=Depends(get_current_user)
):

    if not device_name:
        raise HTTPException(400, "device_name parametresi zorunlu")

    device = device_db.get_device(device_name)
    if not device:
        raise HTTPException(404, f"Cihaz bulunamadı: {device_name}")

    device_fk = device["id"]

    gps_row = gps_db.get_last_gps(device_fk)
    if not gps_row:
        raise HTTPException(404, f"Bu cihaza ait GPS verisi bulunamadı: {device_name}")

    result = GPSData(
        latitude=gps_row["latitude"],
        longitude=gps_row["longitude"],
        device_id=gps_row["device_id"],
        device_name=device["device_name"],     
        timestamp=gps_row["timestamp"]
    )

    return result

