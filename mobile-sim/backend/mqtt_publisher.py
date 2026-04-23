"""
MQTT GPS publisher — replicates geography_route_simulator.py signing logic exactly.

Signing steps (must match C# GpsMessageHandler.BuildSignaturePayload):
  1. Build dict WITHOUT signature: {device_id, latitude (round 6), longitude (round 6), timestamp (ms int)}
  2. Serialize to minified JSON: json.dumps(data, separators=(',', ':'))
  3. HMAC-SHA256(minified_json, device_secret) → hexdigest
  4. Add "signature" key and publish full payload
"""

import hashlib
import hmac
import json
import logging
import time

import os

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from paho.mqtt.client import CallbackAPIVersion

load_dotenv()

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

logger = logging.getLogger(__name__)

_client: mqtt.Client | None = None


def _get_client() -> mqtt.Client:
    global _client
    if _client is None:
        c = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION2,
            client_id="tyb-mobile-sim",
        )
        if MQTT_USERNAME:
            c.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        c.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        c.loop_start()
        _client = c
        logger.info("MQTT connected → %s:%d", MQTT_HOST, MQTT_PORT)
    return _client


def publish_gps(device_id: str, lat: float, lon: float, secret: str) -> None:
    data: dict = {
        "device_id": device_id,
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "timestamp": int(time.time() * 1000),
    }

    # Sign minified JSON before adding the signature field
    raw = json.dumps(data, separators=(",", ":"))
    data["signature"] = hmac.new(
        secret.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()

    _get_client().publish(f"gps/{device_id}", json.dumps(data))
    logger.debug("→ gps/%s  lat=%.6f  lon=%.6f", device_id, lat, lon)
