import logging
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from mqtt_publisher import publish_gps

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

SIM_USERNAME = os.getenv("SIM_USERNAME", "")
SIM_PASSWORD = os.getenv("SIM_PASSWORD", "")
JWT_SECRET   = os.getenv("JWT_SECRET", "")
JWT_ALGO     = "HS256"
JWT_MINUTES  = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

app = FastAPI(title="TYB Mobile Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

_bearer = HTTPBearer()


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    try:
        jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
def login(req: LoginRequest):
    if req.username != SIM_USERNAME or req.password != SIM_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_MINUTES)
    token = jwt.encode({"sub": req.username, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGO)
    return {"access_token": token, "token_type": "bearer"}


# ── Location ──────────────────────────────────────────────────────────────────

class LocationPayload(BaseModel):
    device_id: str
    secret_key: str
    latitude:  float = Field(..., ge=-90,  le=90)
    longitude: float = Field(..., ge=-180, le=180)


@app.post("/location", status_code=204, dependencies=[Depends(require_auth)])
def post_location(body: LocationPayload):
    publish_gps(body.device_id, body.latitude, body.longitude, body.secret_key)
