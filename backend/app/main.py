# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os
import hmac, hashlib
import json

from app.mqtt_client import MQTTClient
import app.mqtt_state as mqtt_state

from app.routers.api_auth import router as auth_router
from app.routers.api_gps import router as gps_router
from app.routers.api_mqtt import router as mqtt_router
from app.routers.api_device import router as device_router

from app.database_device import device_db
from app.database_gps import gps_db

from app.models import GPSData

load_dotenv()

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", "443"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
GPS_TOPIC = os.getenv("GPS_TOPIC")

def message_handler(topic: str, message: str):
    try:
        data = json.loads(message)

        if "signature" not in data:
            print("❌ Signature eksik → reddedildi")
            return

        signature = data.pop("signature")
        device_name = data.get("device_id")

        if not device_name:
            print("❌ device_id yok → reddedildi")
            return

        topic_device = topic.split("/")[1]
        if topic_device != device_name:
            print("❌ Topic ile device_id uyuşmuyor → sahte mesaj!")
            return

        secret = device_db.get_secret_key(device_name)
        if not secret:
            print("❌ Bilinmeyen cihaz → reddedildi")
            return

        raw_payload = json.dumps(data, separators=(',', ':'))
        expected_sig = hmac.new(
            secret.encode(),
            raw_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if expected_sig != signature:
            print("❌ HMAC uyumsuz → sahte veri!")
            return

        lat = float(data["latitude"])
        lon = float(data["longitude"])

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            print("❌ GPS sınır hatası → reddedildi")
            return

        device_fk = device_db.get_device_id(device_name)
        if not device_fk:
            print("❌ Device FK bulunamadı")
            return

        gps_data = GPSData(
            latitude=lat,
            longitude=lon,
            device_id=device_fk,
            timestamp=data.get("timestamp")
        )

        gps_db.add_gps(gps_data)
        print(f"✔ GPS kaydedildi: {lat}, {lon}")

    except Exception as e:
        print("Message Handler Error:", e)

@asynccontextmanager
async def lifespan(app: FastAPI):

    if MQTT_BROKER:
        mqtt_state.mqtt_client = MQTTClient(
            MQTT_BROKER,
            MQTT_PORT,
            username=MQTT_USERNAME,
            password=MQTT_PASSWORD,
        )

        mqtt_state.mqtt_client.set_message_callback(message_handler)

        if mqtt_state.mqtt_client.connect():
            mqtt_state.mqtt_client.subscribe(GPS_TOPIC)
            print(f"Subscribed → {GPS_TOPIC}")

    yield

    if mqtt_state.mqtt_client:
        mqtt_state.mqtt_client.disconnect()

app = FastAPI(
    title="GPS Tracking API",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(gps_router)
app.include_router(mqtt_router)
app.include_router(device_router)

@app.get("/")
async def root():
    return {"message": "TYB API çalışıyor"}