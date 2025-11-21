import paho.mqtt.client as mqtt
import json
from typing import Callable, Optional

class MQTTClient:
    def __init__(
        self, 
        broker_address: str, 
        port: int = 1883,
        username: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.client = mqtt.Client()
        self.broker_address = broker_address
        self.port = port
        self.message_callback = None
        
        # Authentication ayarla
        if username and password:
            self.client.username_pw_set(username, password)
            print(f"MQTT Authentication ayarlandı: {username}")
        
        # Callback fonksiyonlarını ayarla
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ MQTT Broker'a bağlandı: {self.broker_address}:{self.port}")
        else:
            error_messages = {
                1: "Yanlış protokol versiyonu",
                2: "Geçersiz client ID",
                3: "Sunucu erişilemez",
                4: "Hatalı kullanıcı adı veya şifre",
                5: "Yetkilendirme hatası"
            }
            print(f"❌ Bağlantı hatası (code {rc}): {error_messages.get(rc, 'Bilinmeyen hata')}")
    
    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print(f"⚠️ Beklenmeyen bağlantı kopması: {rc}")
    
    def on_message(self, client, userdata, msg):
        try:
            payload = msg.payload.decode('utf-8')
            print(f"📩 Mesaj alındı: {msg.topic}")
            print(f"   Veri: {payload}")
            
            if self.message_callback:
                self.message_callback(msg.topic, payload)
        except Exception as e:
            print(f"❌ Mesaj işleme hatası: {e}")
    
    def connect(self):
        """Broker'a bağlan"""
        try:
            self.client.connect(self.broker_address, self.port, 60)
            self.client.loop_start()
            return True
        except Exception as e:
            print(f"❌ Bağlantı hatası: {e}")
            return False
    
    def disconnect(self):
        """Bağlantıyı kes"""
        self.client.loop_stop()
        self.client.disconnect()
        print("🔌 MQTT bağlantısı kapatıldı")
    
    def publish(self, topic: str, message: str, qos: int = 1) -> bool:
        """Mesaj gönder"""
        try:
            result = self.client.publish(topic, message, qos=qos)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📤 Mesaj gönderildi: {topic}")
                return True
            else:
                print(f"❌ Mesaj gönderilemedi: {result.rc}")
                return False
        except Exception as e:
            print(f"❌ Publish hatası: {e}")
            return False
    
    def subscribe(self, topic: str, qos: int = 1):
        """Topic'e abone ol"""
        try:
            result = self.client.subscribe(topic, qos=qos)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                print(f"📥 Topic'e abone olundu: {topic}")
                return True
            else:
                print(f"❌ Abone olunamadı: {result[0]}")
                return False
        except Exception as e:
            print(f"❌ Subscribe hatası: {e}")
            return False
    
    def set_message_callback(self, callback: Callable):
        """Mesaj callback fonksiyonu ayarla"""
        self.message_callback = callback