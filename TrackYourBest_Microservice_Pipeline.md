# Track Your Best (TYB) - Microservice Architecture Pipeline

## Solution Structure

    TrackYourBest.sln
    │
    ├── TYB.ApiService      → ASP.NET Core Web API
    ├── TYB.IoTService      → .NET Worker Service
    ├── TYB.MLService       → .NET Worker Service
    └── TYB.Shared          → Class Library (Contracts / Entities)

------------------------------------------------------------------------

# 1. High-Level Architecture

    ESP32 Devices
         ↓
    MQTT Broker
         ↓
    TYB.IoTService (Worker Service)
         ↓
    PostgreSQL Database
         ↓
    TYB.MLService (Worker Service)
         ↓
    PostgreSQL (Analysis Results)
         ↓
    TYB.ApiService (Web API)
         ↓
    Frontend (Next.js)

------------------------------------------------------------------------

# 2. Service Responsibilities

## TYB.ApiService (Web API)

-   Communicates with frontend
-   Handles authentication (JWT)
-   Queries PostgreSQL
-   Returns device, location and ML analysis data
-   Exposes REST endpoints

## TYB.IoTService (Worker Service)

-   Subscribes to MQTT topics
-   Parses incoming GPS messages
-   Validates device identity
-   Writes location data to PostgreSQL
-   Runs continuously in background

## TYB.MLService (Worker Service)

-   Periodically reads historical location data
-   Runs Machine Learning models
-   Writes ETA predictions, anomaly detection, and route analysis back
    to PostgreSQL
-   Runs as scheduled background processor

## TYB.Shared (Class Library)

Contains only shared contracts:

-   Database entities (Device, Location, MLAnalysisResult)
-   Common DTOs (LocationMessageDto, MLResultDto)
-   Shared enums and constants

------------------------------------------------------------------------

# 3. Database Flow

### Location Ingestion Flow

1.  ESP32 publishes GPS data via MQTT
2.  IoTService receives message
3.  Message parsed into LocationMessageDto
4.  Device validated
5.  Location stored in PostgreSQL

### ML Analysis Flow

1.  MLService runs periodically
2.  Fetches recent location history
3.  Executes ML model
4.  Stores analysis results in MLAnalysisResult table

### API Query Flow

1.  Frontend calls ApiService endpoint
2.  ApiService queries database
3.  Returns JSON response

------------------------------------------------------------------------

# 4. Microservice Communication Rules

-   Frontend → ApiService (HTTP)
-   IoTService → PostgreSQL (Direct DB Access)
-   MLService → PostgreSQL (Direct DB Access)
-   No HTTP communication between internal services
-   Shared database used as integration layer

------------------------------------------------------------------------

# 5. Deployment Model (Dockerized)

Each service is containerized:

-   api container
-   iot container
-   ml container
-   postgres container

Deployment flow:

    Git Push
       ↓
    Build
       ↓
    Docker Build
       ↓
    Docker Compose
       ↓
    AWS EC2 Deployment

------------------------------------------------------------------------

# 6. Architecture Principles

-   Event-driven ingestion
-   Background processing for ML
-   Decoupled services
-   Shared persistence layer
-   Scalable container-based deployment
-   Clear separation between API layer and processing layer

------------------------------------------------------------------------

# Summary

Track Your Best uses a hybrid microservice architecture:

-   Web API for client communication
-   Worker services for IoT ingestion and ML processing
-   PostgreSQL as shared persistence
-   MQTT as device communication layer

The system is scalable, modular, and production-ready.

7. Database Schema Structure

The Track Your Best database is organized using a schema-based domain separation strategy.

Schemas:

tyb_core

tyb_spatial

tyb_analytics

tyb_audit

This structure enables bounded context separation while keeping a shared PostgreSQL instance.

7.1 tyb_core (Core Domain)

Responsible for system identity, organizations, devices, vehicles and users.

organizations

id (PK)

name

legal_name

tax_number

address

city

country

phone

email

website

is_active

created_at

updated_at

created_by

users

id (PK)

organization_id (FK → organizations.id)

username

email

password_hash

full_name

phone

role

is_active

is_verified

last_login

failed_login_attempts

account_locked_until

avatar_url

preferences

created_at

updated_at

created_by

drivers

id (PK)

organization_id (FK)

user_id (FK → users.id)

license_number

license_type

license_expiry

date_of_birth

hire_date

emergency_contact_name

emergency_contact_phone

is_active

metadata

created_at

updated_at

devices

id (PK)

organization_id (FK)

device_name

device_identifier

device_model

firmware_version

mqtt_username

mqtt_password

secret_key

status

installation_date

last_maintenance_date

next_maintenance_date

battery_level

signal_strength

metadata

is_active

created_at

updated_at

created_by

vehicles

id (PK)

organization_id (FK)

device_id (FK → devices.id)

vehicle_name

plate_number

brand

model

year

vin

color

fuel_type

capacity

odometer_reading

insurance_expiry

inspection_expiry

is_active

metadata

created_at

updated_at

created_by

7.2 tyb_spatial (Geospatial & Tracking Domain)

Responsible for raw GPS data, trips and geofences.

gps_data

id (PK)

device_id (FK → devices.id)

trip_id (FK → trips.id)

location (GEOGRAPHY/POINT)

latitude

longitude

altitude

accuracy

speed

heading

is_moving

is_stopped

acceleration

gps_timestamp

received_timestamp

battery_level

signal_quality

metadata

trips

id (PK)

device_id (FK)

vehicle_id (FK)

driver_id (FK)

trip_name

status

start_location

end_location

start_address

end_address

start_time

end_time

planned_end_time

duration_seconds

total_distance_km

odometer_start

odometer_end

route_geometry

max_speed

avg_speed

stop_count

harsh_acceleration_count

harsh_braking_count

purpose

notes

metadata

created_at

updated_at

geofences

id (PK)

organization_id (FK)

name

description

area (GEOMETRY)

fence_type

radius_meters

alert_on_entry

alert_on_exit

is_active

metadata

created_at

updated_at

created_by

7.3 tyb_analytics (Machine Learning & Insights Domain)

Responsible for AI outputs and behavioral analytics.

anomalies

id (PK)

device_id (FK)

trip_id (FK)

gps_data_id (FK)

anomaly_type

severity

description

location

confidence_score

algorithm_used

is_resolved

resolved_at

resolved_by

resolution_notes

detected_at

metadata

driver_scores

id (PK)

driver_id (FK)

trip_id (FK)

analysis_date

period_type

overall_score

speed_score

acceleration_score

braking_score

cornering_score

idle_time_score

total_trips

total_distance_km

total_duration_seconds

speeding_events

harsh_acceleration_events

harsh_braking_events

fuel_efficiency_score

estimated_fuel_consumption

metadata

calculated_at

eta_predictions

id (PK)

trip_id (FK)

device_id (FK)

prediction_time

predicted_arrival_time

actual_arrival_time

current_location

destination

remaining_distance_km

prediction_error_seconds

accuracy_percentage

model_version

confidence_score

traffic_factor

weather_factor

historical_performance

metadata

route_optimizations

id (PK)

trip_id (FK)

original_route

optimized_route

original_distance_km

optimized_distance_km

distance_saved_km

original_duration_seconds

estimated_duration_seconds

time_saved_seconds

algorithm_used

optimization_criteria

was_followed

actual_route

created_at

metadata

7.4 tyb_audit (System Monitoring & Logging Domain)

Responsible for observability and system tracking.

data_quality_logs

id (PK)

device_id (FK)

check_timestamp

total_records_checked

invalid_records

duplicate_records

missing_fields

quality_score

issues_found

corrective_action

records_cleaned

metadata

session_logs

id (PK)

user_id (FK)

session_token

action

resource_type

resource_id

ip_address

user_agent

request_method

request_path

request_body

response_status

old_values

new_values

action_timestamp

duration_ms

description

metadata

system_events

id (PK)

event_type

severity

component

message

error_code

stack_trace

device_id

user_id

event_timestamp

metadata

7.5 Microservice ↔ Schema Mapping
Service	Used Schemas
ApiService	tyb_core, tyb_spatial, tyb_analytics, tyb_audit
IoTService	tyb_spatial (gps_data), minimal tyb_core (devices)
MLService	tyb_spatial, tyb_analytics
Audit logic	tyb_audit
7.6 Architectural Rationale

Schema separation enables domain isolation.

Each microservice maps only required schemas.

Shared PostgreSQL instance with role-based access control.

Prevents distributed monolith by limiting entity scope per service.

Supports scalable, modular microservice deployment.