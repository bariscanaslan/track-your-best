# mqtt_client.py

import paho.mqtt.client as mqtt
import ssl
from typing import Callable, Optional

class MQTTClient:
    def __init__(
        self,
        broker: str,
        port: int = 443,
        username: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.client = mqtt.Client(transport="websockets")
        self.broker = broker
        self.port = port
        self.message_callback: Optional[Callable] = None

        if username and password:
            self.client.username_pw_set(username, password)
            print(f"🔐 MQTT Auth set: {username}")

        self.client.tls_set(
            cert_reqs=ssl.CERT_REQUIRED,
            tls_version=ssl.PROTOCOL_TLS_CLIENT
        )
        self.client.tls_insecure_set(False)

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    # ------------------------------
    # MQTT EVENT CALLBACKS
    # ------------------------------

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ Connected to MQTT WSS: {self.broker}:{self.port}")
        else:
            messages = {
                1: "Wrong protocol version",
                2: "Invalid client identifier",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized",
            }
            print(f"❌ MQTT Connect Error {rc}: {messages.get(rc, 'Unknown error')}")

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print(f"⚠️ Unexpected disconnect: {rc}")

    def on_message(self, client, userdata, msg):
        try:
            payload = msg.payload.decode("utf-8")
            print(f"📩 MQTT Message: {msg.topic} → {payload}")

            if self.message_callback:
                self.message_callback(msg.topic, payload)
        except Exception as e:
            print(f"❌ MQTT message handling error: {e}")

    # ------------------------------
    # MQTT ACTIONS
    # ------------------------------

    def connect(self):
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
            return True
        except Exception as e:
            print(f"❌ MQTT WSS connect error: {e}")
            return False

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        print("🔌 MQTT disconnected")

    def publish(self, topic: str, message: str, qos: int = 1):
        try:
            result = self.client.publish(topic, message, qos=qos)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📤 MQTT Publish OK → {topic}")
                return True
            else:
                print(f"❌ MQTT Publish Error: {result.rc}")
                return False
        except Exception as e:
            print(f"❌ Publish Exception: {e}")
            return False

    def subscribe(self, topic: str, qos: int = 1):
        try:
            result = self.client.subscribe(topic, qos)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                print(f"📥 Subscribed → {topic}")
                return True
            else:
                print(f"❌ Subscribe Error: {result[0]}")
                return False
        except Exception as e:
            print(f"❌ Subscribe Exception: {e}")
            return False

    def set_message_callback(self, callback: Callable):
        self.message_callback = callback