# app/routers/api_mqtt.py

from fastapi import APIRouter, HTTPException, Depends
from app.utils.jwt_utils import get_current_user
from app.mqtt_state import mqtt_client

router = APIRouter(prefix="/mqtt", tags=["MQTT"])

@router.post("/subscribe")
async def subscribe(topic: str, user=Depends(get_current_user)):

    if mqtt_client is None:
        raise HTTPException(500, "MQTT client initialized değil")

    success = mqtt_client.subscribe(topic)

    if not success:
        raise HTTPException(500, "Subscribe başarısız")

    return {"status": "success", "topic": topic}
