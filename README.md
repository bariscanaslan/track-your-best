# Track Your Best

It's a project that Smart IoT-Based Fleet Management and Real-Time Vehicle Tracking System with Predictive Analytics.

## Git Clone

Clone the repository from Github.

bash:

git clone https://github.com/bariscanaslan/track-your-best.git
cd track-your-best

## Frontend

It's React Next.js frontend service

bash:
cd frontend

After that,
Add .env.local file,

NEXT_PUBLIC_API_BASE_URL=http://localhost:5110

bash:
npm run dev

## OSRM

Please follow OSRM.md file to run this service before running the backend services.

## Backend

### TYB.ApiService

This service creates API endpoints for communicating frontend 

bash:
cd backend
cd TYB.ApiService

Add .env file with these parameters,

TYB_API_CONNECTION_STRING=
TYB_OSRM_BASE_URL=http://localhost:5000
TYB_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
TYB_NOMINATIM_USER_AGENT=TYB.ApiService/1.0 (contact: your@contact.com)
TYB_JWT_SECRET=
TYB_JWT_EXPIRY_HOURS=

bash:

dotnet build
dotnet run

### TYB.IoTService

This is the service for communicating IoT devices

It's directly connected with MQTT Broker that we created and if it get any topic message from Broker, directly saved the related information to the database.

bash:

cd backend
cd TYB.IoTService

Add .env with these credentials,

TYB_IOT_CONNECTION_STRING=
TYB_IOT_MQTT_BROKER_HOST=
TYB_IOT_MQTT_BROKER_PORT=
TYB_IOT_MQTT_BROKER_USERNAME=
TYB_IOT_MQTT_BROKER_PASSWORD=

## ML Service

ML Service is created for calculating ETA prediction and Anomaly Detection for creating Driver Grading Scores.

bash:
cd TYB.MLService
python -m venv .venv
-- if Windows:
.venv\Scripts\activate
pip install -r requirements.txt

After that add .env to,

DATABASE_URL=
OSRM_URL=
LOG_LEVEL=
MODELS_DIR=./models_bin

Add necessary models to models_bin folder:
-- anomaly_model.pkl, anomaly_scaler.pkl, eta_model_istanbul.pkl, model_meta.json

Test variables should be added to the database.

bash:
python main.py

## ESP32 Simulation

This simulation structure created for Real Time simulation for IoT devices.
Before to run that, you had to run all the services to observe the changes. 
It's basically add to new data to backend thanks to TYB.IoTService microservice.

bash: 
cd esp32-sim
python -m venv .venv
-- if Windows:
.venv\Scripts\activate
pip install -r requirements.txt


