# TrackYourBest

TrackYourBest is an open-source smart fleet management platform for real-time vehicle tracking, IoT telemetry ingestion, route planning, predictive ETA, anomaly detection, and driver scoring.

## System Overview

TrackYourBest is built from four main runtime components that share one PostgreSQL/PostGIS database:

| Component | Stack | Responsibility |
| --- | --- | --- |
| `frontend/` | Next.js 16, React 19 | Admin, fleet manager, and driver web interfaces |
| `TYB.ApiService/` | ASP.NET Core 8 | REST API, auth, CRUD, trip lifecycle, route planning, geocoding |
| `TYB.IoTService/` | .NET 8 Worker | MQTT subscriber for GPS, heartbeat, and device-info messages |
| `TYB.MLService/` | Python 3.12 | Scheduled ETA prediction, anomaly detection, and driver scoring jobs |

External services:

- PostgreSQL 15+ with PostGIS
- MQTT broker, for example Mosquitto or HiveMQ
- OSRM route service
- Nominatim geocoding service

## Repository Layout

```text
frontend/              Next.js application
TYB.ApiService/        ASP.NET Core REST API
TYB.IoTService/        MQTT ingestion worker
TYB.MLService/         Python analytics worker
infra/
  nginx/               Example reverse proxy and TLS config
  postgres/            Initial extension/schema bootstrap SQL
docker-compose.yml     Production-oriented service composition
init-letsencrypt.sh    Optional first-run Certbot helper
.env.example           Root environment template for Compose
```

Generated files, local secrets, uploaded media, virtual environments, model binaries, and build outputs are ignored.

## Data Flow

1. ESP32 or simulator devices publish telemetry to MQTT topics.
2. `TYB.IoTService` subscribes to GPS, heartbeat, and device-info topics.
3. Valid GPS payloads are written to `tyb_spatial.gps_data` and `tyb_spatial.gps_raw`.
4. `TYB.ApiService` exposes authenticated APIs for organizations, users, devices, vehicles, drivers, trips, analytics, uploads, routing, and geocoding.
5. The frontend reads API data and renders live fleet, admin, and driver workflows.
6. `TYB.MLService` polls the database on intervals and writes analytics results to `tyb_analytics`.

## Database Schemas

- `tyb_core`: organizations, users, drivers, vehicles, devices
- `tyb_spatial`: trips, GPS data, GPS raw buffer
- `tyb_analytics`: ETA predictions, driver scores, anomalies

The bootstrap file `infra/postgres/init.sql` creates PostGIS, `uuid-ossp`, and the three schemas. Table creation/migrations are managed by the application database model and deployment process.

## Configuration

Copy the relevant templates before running services:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp TYB.ApiService/.env.example TYB.ApiService/.env
cp TYB.IoTService/.env.example TYB.IoTService/.env
cp TYB.MLService/.env.example TYB.MLService/.env
```

Important values:

- `TYB_JWT_SECRET`: at least 32 random characters
- `TYB_API_CONNECTION_STRING`: PostgreSQL/PostGIS connection for the API
- `TYB_IOT_CONNECTION_STRING`: PostgreSQL/PostGIS connection for the IoT worker
- `DATABASE_URL`: SQLAlchemy connection string for the ML worker
- `TYB_OSRM_BASE_URL`: OSRM base URL, usually `http://localhost:5000`
- `TYB_NOMINATIM_USER_AGENT`: identify your deployment and contact address
- `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`: broker connection
- `NEXT_PUBLIC_API_BASE_URL`: browser-visible API URL

Do not commit real `.env` files, model binaries, uploaded media, or production certificates.

## Local Development

### Prerequisites

- Docker
- .NET 8 SDK
- Node.js 20+
- Python 3.12
- PostgreSQL/PostGIS
- MQTT broker
- OSRM route server

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3003` by default.

### API Service

```bash
cd TYB.ApiService
dotnet restore
dotnet run
```

The API listens on the ASP.NET profile port, commonly `http://localhost:5110` in development.

### IoT Service

```bash
cd TYB.IoTService
dotnet restore
dotnet run
```

The worker connects to the configured MQTT broker and writes telemetry into PostgreSQL.

### ML Service

```bash
cd TYB.MLService
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
python main.py
```

Required model files belong in `TYB.MLService/models_bin/` and are intentionally ignored:

```text
eta_model_istanbul.pkl
anomaly_model.pkl
driver_scoring_model.pkl
model_meta.json
```

The included `data/ibb_traffic_patterns_2024_2025.csv` is aggregate traffic-pattern input used by ETA prediction.

## Analytics Jobs

`TYB.MLService` is a scheduled worker, not an HTTP service.

| Job | Interval | Reads | Writes |
| --- | ---: | --- | --- |
| ETA prediction | 20 seconds | active trips and route/GPS state | `tyb_analytics.eta_predictions` |
| Anomaly detection | 120 seconds | completed trips and GPS tracks | `tyb_analytics.anomalies` |
| Driver scoring | 300 seconds | completed trips and GPS features | `tyb_analytics.driver_scores` |

Job intervals are defined in `TYB.MLService/config/settings.py`.

## Deployment Notes

`docker-compose.yml` builds the API, IoT worker, ML worker, frontend, nginx, and Certbot containers. It assumes PostgreSQL, MQTT, OSRM, and DNS are already available through the configured environment.

Before using the nginx and Certbot files:

1. Replace `app.example.com` and `api.example.com` in `infra/nginx/default.conf`.
2. Set `APP_DOMAIN`, `API_DOMAIN`, and `CERTBOT_EMAIL` in `.env`.
3. Run `./init-letsencrypt.sh` once on the server.
4. Start the full stack with `docker compose up -d`.

## Security And Public Repository Hygiene

- Real secrets were removed from default configuration.
- Runtime uploads are ignored via `wwwroot/uploads/`.
- ML model binaries are ignored via `models_bin/`.
- Build caches such as `.next/`, `bin/`, `obj/`, `__pycache__/`, and `*.tsbuildinfo` are ignored.
- Example credentials are placeholders only and must be changed before deployment.

## License

This project is distributed under the MIT License.
