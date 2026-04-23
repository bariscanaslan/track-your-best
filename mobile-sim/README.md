# TYB Mobile GPS Simulator

A mobile-first web application that lets a logged-in user share their phone's live GPS location to the TYB MQTT broker, producing messages fully compatible with the existing IoT ingestion pipeline.

---

## Architecture

```
Phone browser
  └─ React (Vite) ──HTTPS/JSON──► FastAPI (Python)
                                       │
                                       │ paho-mqtt
                                       ▼
                                  MQTT Broker
                                       │
                                       ▼
                             TYB.IoTService (C#)
                             GpsMessageHandler
```

**Security boundary**: the browser never sees MQTT credentials or device secrets. All signing happens inside FastAPI.

---

## Folder Structure

```
mobile-sim/
├── backend/
│   ├── main.py               # FastAPI app — 3 endpoints
│   ├── auth.py               # JWT + bcrypt helpers
│   ├── mqtt_publisher.py     # MQTT client + GPS signing
│   ├── models.py             # Pydantic request/response models
│   ├── config.py             # env + data/config.json loader
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   └── config.json       # users & device assignments (fill in your values)
│   └── scripts/
│       └── hash_password.py  # generate bcrypt hashes for config.json
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── pages/
        │   ├── LoginPage.jsx
        │   └── DashboardPage.jsx
        ├── hooks/
        │   └── useGeolocation.js
        └── services/
            └── api.js
```

---

## Backend Setup

### 1. Install dependencies

```bash
cd mobile-sim/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, JWT_SECRET
```

### 3. Configure users and devices

Edit `data/config.json`. Generate a bcrypt hash for each user password:

```bash
python scripts/hash_password.py
# Enter password when prompted → copy the hash into config.json
```

Fill in your real device UUIDs and their SecretKey values from the TYB database.

Example `data/config.json`:
```json
{
  "users": {
    "driver1": {
      "password_hash": "$2b$12$...",
      "devices": ["550e8400-e29b-41d4-a716-446655440000"]
    }
  },
  "devices": {
    "550e8400-e29b-41d4-a716-446655440000": {
      "name": "TYB-Device-01",
      "secret": "the-device-secret-key-from-db"
    }
  }
}
```

The device UUID must match `DeviceIdentifier` in the TYB database, and the secret must match `SecretKey`.

### 4. Run the backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`.

---

## Frontend Setup

### 1. Install dependencies

```bash
cd mobile-sim/frontend
npm install
```

### 2. Configure API URL

```bash
cp .env.example .env
# For local dev: VITE_API_URL=http://localhost:8000
# For phone on same Wi-Fi: VITE_API_URL=http://192.168.1.X:8000
```

### 3. Run the dev server

```bash
npm run dev
```

Open `http://localhost:5173` in a browser (or your LAN IP on a phone).

---

## Testing on a Phone

1. Connect phone and computer to the same Wi-Fi network.
2. Find your computer's LAN IP (e.g., `192.168.1.42`).
3. Set `VITE_API_URL=http://192.168.1.42:8000` in `frontend/.env`.
4. Run `npm run dev` — Vite will expose the server on `0.0.0.0:5173`.
5. Open `http://192.168.1.42:5173` on the phone.
6. HTTPS is **required** for `navigator.geolocation` on most mobile browsers when not on localhost. Options:
   - Use `ngrok` to tunnel both the frontend and backend over HTTPS.
   - Or use a self-signed certificate with `vite --https` (add the cert to your phone's trusted list).

---

## MQTT Message Compatibility

### Topic
```
gps/{DEVICE_ID}
```

### Payload (exact match with Python simulator)
```json
{
  "device_id": "550e8400-...",
  "latitude": 40.854789,
  "longitude": 29.123456,
  "timestamp": 1714000000000,
  "signature": "a3f2..."
}
```

### Signature algorithm (replicated from `geography_route_simulator.py`)

```python
# 1. Build payload dict without signature
data = {
    "device_id": device_id,
    "latitude": round(lat, 6),
    "longitude": round(lon, 6),
    "timestamp": int(time.time() * 1000),
}
# 2. Minified JSON serialization
raw = json.dumps(data, separators=(',', ':'))
# 3. HMAC-SHA256 with device secret
signature = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
# 4. Add signature to payload
data["signature"] = signature
```

This is identical to `Simulator.gps_payload()` in `esp32-sim/geography_route_simulator.py`.

### Why it's compatible with C# verification

`GpsMessageHandler.BuildSignaturePayload` in the C# backend rebuilds the canonical signing string from the *deserialized* JSON values using `double.ToString("G", InvariantCulture)`. For GPS coordinates rounded to 6 decimal places, Python's `json.dumps` and C#'s `ToString("G")` produce the same string representation (e.g., `40.854789`). The existing Python simulator proves this works.

---

## Unavoidable Differences vs. a Real ESP32

| Aspect | ESP32 | Web Simulator |
|--------|-------|---------------|
| GPS source | Dedicated GNSS module | Phone IMU/A-GPS |
| GPS accuracy | 2–5 m typical | 5–50 m typical |
| Publish interval | Configurable (default 1 s) | 3 s (battery/network friendly) |
| Background operation | Continuous | May be throttled by OS/browser |
| MQTT connection | Direct to broker | Via FastAPI proxy |
| Signature | On-device | On FastAPI server |

The web simulator is intended for demo and testing purposes, not production fleet tracking.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Returns JWT token |
| GET | `/devices` | Bearer | Lists devices assigned to user |
| POST | `/location` | Bearer | Publishes one GPS fix to MQTT |
