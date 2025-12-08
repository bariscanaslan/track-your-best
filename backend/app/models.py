# models.py

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


# ==========================================================
# DEVICE MODELS
# ==========================================================

class DeviceCreate(BaseModel):
    device_name: str

class DevicePublic(BaseModel):
    id: int
    device_name: str
    mqtt_username: str
    mqtt_password: str
    secret_key: str


# ==========================================================
# GPS DATA MODELS (FK uyumlu)
# ==========================================================

class GPSData(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    device_id: int  # Devices tablosundaki FK ID
    device_name: str
    timestamp: Optional[datetime] = None

    @validator("timestamp", pre=True, always=True)
    def set_timestamp(cls, v):
        return v or datetime.utcnow()

    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 41.0082,
                "longitude": 28.9784,
                "device_id": 1,
                "device_name": "tyb01"
            }
        }

class GPSResponse(BaseModel):
    status: str
    message: str
    data: Optional[GPSData]


# ==========================================================
# MQTT AUTH MODELS
# ==========================================================

class MQTTCredentials(BaseModel):
    username: str
    password: str


class MQTTGPSMessage(BaseModel):
    latitude: float
    longitude: float
    device_id: str   
    timestamp: Optional[datetime]
    signature: str 


# ==========================================================
# USER ACCOUNT MODELS
# ==========================================================

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str
    recaptcha_token: str

class UserPublic(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None


# ==========================================================
# AUTH RESPONSE MODELS
# ==========================================================

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

class TokenData(BaseModel):
    username: Optional[str] = None
    uid: Optional[int] = None
    full_name: Optional[str] = None
