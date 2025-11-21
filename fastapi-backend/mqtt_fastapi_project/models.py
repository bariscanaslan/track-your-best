from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional

class GPSData(BaseModel):
    """GPS koordinat verisi"""
    latitude: float = Field(..., ge=-90, le=90, description="Enlem (-90 to 90)")
    longitude: float = Field(..., ge=-180, le=180, description="Boylam (-180 to 180)")
    timestamp: Optional[datetime] = None
    device_id: Optional[str] = None
    
    @validator('timestamp', pre=True, always=True)
    def set_timestamp(cls, v):
        return v or datetime.now()
    
    class Config:
        schema_extra = {
            "example": {
                "latitude": 41.0082,
                "longitude": 28.9784,
                "device_id": "gps_device_001"
            }
        }

class GPSResponse(BaseModel):
    """API response modeli"""
    status: str
    message: str
    data: Optional[GPSData] = None

class MQTTCredentials(BaseModel):
    """MQTT bağlantı bilgileri"""
    username: str
    password: str