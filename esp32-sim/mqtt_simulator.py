#!/usr/bin/env python3
"""
Multi-device MQTT GPS Simulator
- Per-device HMAC secrets
- Randomized send times
- Payload logging
"""

import json
import time
import random
import math
import hmac
import hashlib
import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion

##################################################
# MQTT CONFIG
##################################################

MQTT_HOST = "51.20.118.85"
MQTT_PORT = 1883
MQTT_USERNAME = "tyb-device"
MQTT_PASSWORD = "Tyb.1905"

##################################################
# DEVICE SECRETS
##################################################

DEVICE_SECRETS = {
    "tyb00": "9bd71e81578fce257f3acf93aea9bdbced4b0b43d490850376a63fb59fcda3c8",
    "tyb01": "1fff2d3f2f1c2f164130518daf32191ba2f743d7b85ff8f27ba41287f4b80eb2",
    "tyb02": "1eb6bcfec8402afee74a52df0884e6a5a561d6b034eb3f043d73583a1c09ef01",
}

##################################################
# MAP / GPS CONFIG
##################################################

MIN_LAT, MAX_LAT = 40.95, 41.10
MIN_LON, MAX_LON = 28.85, 29.10

BASE_GPS_INTERVAL = 5        # seconds
GPS_JITTER_MIN = 0.5         # seconds
GPS_JITTER_MAX = 2.5         # seconds
HEARTBEAT_INTERVAL = 300     # seconds

##################################################
# DEVICES
##################################################

DEVICES = {
    "tyb00": {"lat": 41.0082, "lon": 28.9784, "speed": 1.4},
    "tyb01": {"lat": 41.0150, "lon": 29.0200, "speed": 5.0},
    "tyb02": {"lat": 40.9950, "lon": 28.9500, "speed": 13.0},
}

##################################################
# HELPERS
##################################################

def hmac_sha256(message: str, secret: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def meters_to_latlon(dx_m, dy_m, lat):
    dlat = dy_m / 111320
    dlon = dx_m / (40075000 * math.cos(math.radians(lat)) / 360)
    return dlat, dlon


def inside_bounds(lat, lon):
    return MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON

##################################################
# DEVICE CLASS
##################################################

class SimulatedDevice:
    def __init__(self, device_id, lat, lon, speed):
        self.device_id = device_id
        self.secret = DEVICE_SECRETS[device_id]
        self.lat = lat
        self.lon = lon
        self.speed = speed
        self.heading = random.uniform(0, 360)

        self.next_gps_time = time.time() + random.uniform(0, BASE_GPS_INTERVAL)
        self.next_heartbeat_time = time.time() + HEARTBEAT_INTERVAL

    def move(self, dt):
        distance = self.speed * dt
        angle = math.radians(self.heading)

        dx = distance * math.cos(angle)
        dy = distance * math.sin(angle)

        dlat, dlon = meters_to_latlon(dx, dy, self.lat)
        new_lat = self.lat + dlat
        new_lon = self.lon + dlon

        if not inside_bounds(new_lat, new_lon):
            self.heading = random.uniform(0, 360)
            return

        self.lat = new_lat + random.uniform(-0.00001, 0.00001)
        self.lon = new_lon + random.uniform(-0.00001, 0.00001)

    def gps_payload(self):
        data = {
            "device_id": self.device_id,
            "latitude": round(self.lat, 6),
            "longitude": round(self.lon, 6),
            "timestamp": int(time.time() * 1000),
        }
        raw = json.dumps(data, separators=(',', ':'))
        data["signature"] = hmac_sha256(raw, self.secret)
        return json.dumps(data)

    def heartbeat_payload(self):
        return json.dumps({"status": f"{self.device_id} alive"})

    def device_info_payload(self):
        return json.dumps({
            "imei": f"SIM{random.randint(10**14, 10**15 - 1)}",
            "ip_address": f"10.0.{random.randint(0,255)}.{random.randint(1,254)}",
            "signal_strength": random.randint(15, 30),
        })

    def schedule_next_gps(self):
        jitter = random.uniform(GPS_JITTER_MIN, GPS_JITTER_MAX)
        self.next_gps_time = time.time() + BASE_GPS_INTERVAL + jitter

##################################################
# MQTT SIMULATOR
##################################################

class Simulator:
    def __init__(self):
        self.client = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION2,
            client_id=f"sim-{random.randint(0,0xffff):04x}",
        )
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.devices = [SimulatedDevice(d, **cfg) for d, cfg in DEVICES.items()]

    def connect(self):
        self.client.connect(MQTT_HOST, MQTT_PORT, 60)
        self.client.loop_start()

        for d in self.devices:
            topic = f"device-info/{d.device_id}"
            payload = d.device_info_payload()
            self.client.publish(topic, payload)
            print(f"\n📤 {topic}\n📦 {payload}")

    def run(self):
        print("🚀 Multi-device GPS simulator started (randomized timing)")
        try:
            last_tick = time.time()

            while True:
                now = time.time()
                dt = now - last_tick
                last_tick = now

                for d in self.devices:
                    d.move(dt)

                    if now >= d.next_gps_time:
                        topic = f"gps/{d.device_id}"
                        payload = d.gps_payload()
                        self.client.publish(topic, payload)
                        print(f"\n📤 {topic}\n📦 {payload}")
                        d.schedule_next_gps()

                    if now >= d.next_heartbeat_time:
                        topic = f"heartbeat/{d.device_id}"
                        payload = d.heartbeat_payload()
                        self.client.publish(topic, payload)
                        print(f"\n📤 {topic}\n📦 {payload}")
                        d.next_heartbeat_time = now + HEARTBEAT_INTERVAL

                time.sleep(0.15)

        except KeyboardInterrupt:
            print("\n🛑 Simulator stopped")
        finally:
            self.client.loop_stop()
            self.client.disconnect()

##################################################
# MAIN
##################################################

if __name__ == "__main__":
    sim = Simulator()
    sim.connect()
    sim.run()
