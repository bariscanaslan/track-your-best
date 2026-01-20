# mqtt_client.py

import paho.mqtt.client as mqtt
from typing import Callable, Optional


class MQTTClient:
    def __init__(
        self,
        broker: str,
        port: int = 1883,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.broker = broker
        self.port = port
        self.message_callback: Optional[Callable] = None

        # TCP MQTT
        self.client = mqtt.Client(transport="tcp")

        if username and password:
            self.client.username_pw_set(username, password)
            print(f"MQTT Auth set: {username}")

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    # ------------------------------
    # MQTT CALLBACKS
    # ------------------------------

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT TCP: {self.broker}:{self.port}")
        else:
            errors = {
                1: "Wrong protocol version",
                2: "Invalid client ID",
                3: "Server unavailable",
                4: "Bad username or password",
                5: "Not authorized",
            }
            print(f"MQTT Connect Error {rc}: {errors.get(rc, 'Unknown error')}")

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print(f"Unexpected MQTT disconnect (rc={rc})")

    def on_message(self, client, userdata, msg):
        payload = msg.payload.decode("utf-8")
        print(f"MQTT Message → {msg.topic}: {payload}")

        if self.message_callback:
            self.message_callback(msg.topic, payload)

    # ------------------------------
    # ACTIONS
    # ------------------------------

    def connect(self):
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()
            return True
        except Exception as e:
            print(f"MQTT connect error: {e}")
            return False

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        print("MQTT disconnected")

    def subscribe(self, topic: str, qos: int = 1):
        self.client.subscribe(topic, qos)
        print(f"Subscribed → {topic}")

    def publish(self, topic: str, message: str, qos: int = 1):
        self.client.publish(topic, message, qos=qos)
        print(f"Published → {topic}")

    def set_message_callback(self, callback: Callable):
        self.message_callback = callback
