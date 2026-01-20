# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import os
import hmac
import hashlib
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
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
GPS_TOPIC = os.getenv("GPS_TOPIC")  # gps/tyb01/location


def message_handler(topic: str, message: str):
    try:
        # JSON parse
        data = json.loads(message)

        signature = data.pop("signature", None)
        if not signature:
            print("Signature eksik")
            return

        # device_id (payload + topic kontrolü)
        device_name = data.get("device_id")
        if not device_name:
            print("device_id yok")
            return

        topic_device = topic.split("/")[1]
        if topic_device != device_name:
            print("Topic ile device_id uyuşmuyor")
            return

        # DB’den secret al
        secret = device_db.get_secret_key(device_name)
        if not secret:
            print("DB’de secret bulunamadı")
            return

        # ESP32 ile AYNI RAW STRING
        raw_payload = json.dumps(data, separators=(",", ":"))

        expected_sig = hmac.new(
            secret.encode(),
            raw_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        if expected_sig != signature:
            print("HMAC uyumsuz")
            return

        # GPS validasyon
        lat = float(data["latitude"])
        lon = float(data["longitude"])

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            print("GPS sınır hatası")
            return

        device_fk = device_db.get_device_id(device_name)
        if not device_fk:
            print("Device FK bulunamadı")
            return

        # DB’ye yaz
        gps_db.add_gps(GPSData(
            latitude=lat,
            longitude=lon,
            device_id=device_fk,
            timestamp=data.get("timestamp")
        ))

        print(f"GPS kaydedildi → {device_name}: {lat}, {lon}")

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
    allow_origins=[
        "https://app.trackyourbest.net",
        "http://app.trackyourbest.net",
        "http://localhost:3003",
        "https://localhost:3003",
        "http://100.64.0.4:3003",
        "https://100.64.0.4:3003",
    ],
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
