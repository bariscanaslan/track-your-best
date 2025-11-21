from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from contextlib import asynccontextmanager
from typing import Optional, List
import json
import os
from dotenv import load_dotenv
from mqtt_client import MQTTClient
from models import GPSData, GPSResponse, MQTTCredentials
from database import gps_db
from auth import authenticate_user

# .env dosyasını yükle
load_dotenv()

# MQTT ayarları
MQTT_BROKER = os.getenv("MQTT_BROKER", "test.mosquitto.org")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

# GPS topic - Kendinize özel topic (başkaları karışmasın)
GPS_TOPIC = "gps/tracker2025/location/#"  # Benzersiz yapın

mqtt_client = None
security = HTTPBasic()

def message_handler(topic: str, message: str):
    """MQTT'den gelen GPS verilerini işle"""
    try:
        # JSON parse et
        data = json.loads(message)
        
        # JSON içinde latitude/longitude var mı kontrol et
        if not isinstance(data, dict) or 'latitude' not in data or 'longitude' not in data:
            # Geçersiz format, sessizce atla
            return
        
        # GPS verisi oluştur
        gps_data = GPSData(
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            device_id=data.get("device_id", "unknown")
        )
        
        # Veritabanına kaydet
        gps_db.add_gps_data(gps_data)
        print(f"✅ GPS verisi kaydedildi: Lat={gps_data.latitude}, Lon={gps_data.longitude}, Device={gps_data.device_id}")
        
    except json.JSONDecodeError:
        # NMEA veya başka format - sessizce atla
        pass
    except Exception as e:
        print(f"❌ Veri işleme hatası: {e}")

# Lifespan yönetimi
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global mqtt_client
    mqtt_client = MQTTClient(
        MQTT_BROKER, 
        MQTT_PORT,
        username=MQTT_USERNAME,
        password=MQTT_PASSWORD
    )
    mqtt_client.set_message_callback(message_handler)
    
    if mqtt_client.connect():
        # GPS topic'ine abone ol
        mqtt_client.subscribe(GPS_TOPIC)
        print(f"🌍 GPS Topic dinleniyor: {GPS_TOPIC}")
    
    yield
    
    # Shutdown
    if mqtt_client:
        mqtt_client.disconnect()

app = FastAPI(
    title="GPS Tracking API with MQTT",
    description="GPS konumlarını MQTT üzerinden alan ve saklayan API",
    version="1.0.0",
    lifespan=lifespan
)

# Authentication dependency
def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    """API authentication"""
    user = authenticate_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı veya şifre",
            headers={"WWW-Authenticate": "Basic"},
        )
    return user

# ============= API ENDPOINTS =============

@app.get("/")
async def root():
    """Ana sayfa"""
    return {
        "message": "GPS Tracking API",
        "broker": MQTT_BROKER,
        "gps_topic": GPS_TOPIC,
        "docs": "/docs",
        "total_records": gps_db.get_total_count()
    }

@app.get("/health")
async def health_check():
    """Sistem durumu"""
    return {
        "status": "healthy",
        "mqtt_connected": mqtt_client is not None,
        "total_gps_records": gps_db.get_total_count()
    }

@app.post("/gps/publish", response_model=GPSResponse)
async def publish_gps_data(
    gps_data: GPSData,
    user: dict = Depends(verify_credentials)
):
    """
    GPS verisi gönder (MQTT üzerinden)
    Arkadaşınız bu endpoint'i kullanarak size GPS verisi gönderebilir
    """
    # Device ID'yi kullanıcıdan al
    if not gps_data.device_id:
        gps_data.device_id = user.get("device_id", "unknown")
    
    # MQTT topic'ini oluştur
    topic = f"gps/location/{gps_data.device_id}"
    
    # JSON'a çevir
    message = json.dumps({
        "latitude": gps_data.latitude,
        "longitude": gps_data.longitude,
        "device_id": gps_data.device_id,
        "timestamp": gps_data.timestamp.isoformat()
    })
    
    # MQTT'ye gönder
    success = mqtt_client.publish(topic, message)
    
    if success:
        # NOT: Veritabanına kaydetme! message_handler otomatik kaydedecek
        # Böylece çift kayıt önlenir
        

        gps_db.add_gps_data(gps_data)
        return GPSResponse(
            status="success",
            message="GPS verisi başarıyla gönderildi ve MQTT'ye iletildi",
            data=gps_data
        )
    else:
        raise HTTPException(
            status_code=500,
            detail="GPS verisi MQTT'ye gönderilemedi"
        )

@app.get("/gps/latest", response_model=List[GPSData])
async def get_latest_gps(
    device_id: Optional[str] = None,
    limit: int = 10,
    user: dict = Depends(verify_credentials)
):
    """Son GPS verilerini getir"""
    data = gps_db.get_latest_gps_data(device_id=device_id, limit=limit)
    return data

@app.get("/gps/all", response_model=List[GPSData])
async def get_all_gps(user: dict = Depends(verify_credentials)):
    """Tüm GPS verilerini getir"""
    return gps_db.get_all_gps_data()

@app.get("/gps/devices")
async def get_devices(user: dict = Depends(verify_credentials)):
    """Sistemdeki cihazları listele"""
    device_ids = gps_db.get_device_ids()
    return {
        "total_devices": len(device_ids),
        "devices": device_ids
    }

@app.post("/mqtt/subscribe")
async def subscribe_to_topic(
    topic: str,
    user: dict = Depends(verify_credentials)
):
    """Yeni bir MQTT topic'ine abone ol"""
    success = mqtt_client.subscribe(topic)
    if success:
        return {"status": "success", "topic": topic}
    else:
        raise HTTPException(status_code=500, detail="Topic'e abone olunamadı")

@app.get("/mqtt/credentials")
async def get_mqtt_info():
    """
    MQTT bağlantı bilgileri (MQTT Explorer için)
    NOT: Gerçek projede şifre döndürmeyin!
    """
    return {
        "broker": MQTT_BROKER,
        "port": MQTT_PORT,
        "username": MQTT_USERNAME if MQTT_USERNAME else "Gerekli değil",
        "gps_topic": GPS_TOPIC,
        "publish_format": {
            "topic": "gps/location/YOUR_DEVICE_ID",
            "message": {
                "latitude": 41.0082,
                "longitude": 28.9784,
                "device_id": "gps_device_001"
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)