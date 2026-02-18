# TYB.IoTService Summary

This document summarizes the current IoT service structure, how MQTT ingestion works, and how data is persisted to PostgreSQL/PostGIS.

## Folder/Module Overview

`TYB.IoTService/Background/`
- `MqttWorker.cs`
  - Hosted worker that connects to the MQTT broker, subscribes to topics, and routes messages to handlers.

`TYB.IoTService/Configuration/`
- `MqttSettings.cs`
  - Strongly typed configuration for MQTT connection details and subscription topics.

`TYB.IoTService/Handlers/`
- `IMessageHandler.cs`
  - Contract for message handlers (topic match + async handle).
- `GpsMessageHandler.cs`
  - Parses `gps/<device-id>` payloads, writes raw + normalized GPS records.
- `HeartbeatMessageHandler.cs`
  - Parses `heartbeat/<device-id>` (with fallback to payload), updates device heartbeat fields.
- `DeviceInfoMessageHandler.cs`
  - Parses `device-info/<device-id>` payloads, updates device metadata fields.

`TYB.IoTService/Infrastructure/`
- `Data/IoTDbContext.cs`
  - EF Core context, schema mappings to `tyb_core` and `tyb_spatial`.
- `Entities/Core/Device.cs`
  - Device entity mapped to `tyb_core.devices`.
- `Entities/Spatial/GpsData.cs`
  - Normalized GPS record mapped to `tyb_spatial.gps_data` (includes PostGIS `location`).
- `Entities/Spatial/GpsRaw.cs`
  - Raw ingestion record mapped to `tyb_spatial.gps_raw`.

`TYB.IoTService/Models/`
- `GpsMessage.cs`
  - Incoming JSON payload shape for GPS messages.
- `HeartbeatMessage.cs`
  - Incoming JSON payload shape for heartbeat messages.
- `DeviceInfoMessage.cs`
  - Incoming JSON payload shape for device-info messages.

`TYB.IoTService/MQTT/`
- `IMqttService.cs`
  - Abstraction for MQTT operations.
- `MqttService.cs`
  - MQTTnet implementation; connects, subscribes, publishes.
  - Uses a unique client id per run and `CleanSession(true)` to avoid broker kicks.
- `MqttTopicManager.cs`
  - Returns subscription topics from configuration.

`TYB.IoTService/Routing/`
- `TopicRouter.cs`
  - Selects the correct handler based on topic prefix.
- `TopicParser.cs`
  - Extracts `device-id` from topic paths.

`TYB.IoTService/`
- `Program.cs`
  - DI setup + EF Core + MQTT registrations.
  - Reads connection string from `ConnectionStrings:IoT` or `TYB_IOT_CONNECTION_STRING`.
- `appsettings.json`
  - MQTT host/port/user/pass and subscription topics.

## MQTT Worker Flow (Runtime)

1. `MqttWorker` starts as a hosted service.
2. It connects to the broker via `IMqttService`.
3. It subscribes to topics from `MqttTopicManager`:
   - `gps/#`
   - `heartbeat/#`
   - `device-info/#`
4. Each incoming message is routed:
   - `TopicRouter` picks the first handler with `CanHandle(topic) == true`.
   - A new DI scope is created per message to ensure a fresh `IoTDbContext`.

## How Data Is Saved To PostgreSQL

### 1) GPS Payloads (`gps/<device-id>`)

**Source payload fields:**
- `device_id`, `latitude`, `longitude`, `timestamp`, `signature`

**Processing steps:**
1. Topic device id is extracted.
2. `tyb_core.devices` is queried by `device_identifier`.
3. Raw payload is saved into `tyb_spatial.gps_raw`.
4. Normalized record is saved into `tyb_spatial.gps_data`.
5. A PostGIS `location` point is created with SRID 4326.

**Tables used:**
- `tyb_core.devices` (lookup device + org)
- `tyb_spatial.gps_raw` (raw JSON, metadata)
- `tyb_spatial.gps_data` (normalized, spatially indexed)

### 2) Heartbeat Payloads (`heartbeat/<device-id>`)

**Source payload fields:**
- `status` (e.g., `tyb00 alive`)
- optional `device_id`

**Processing steps:**
1. Topic device id is extracted.
2. If the topic is wrong (`heartbeat/alive`), fallback to payload `device_id`.
3. If payload has no `device_id`, parse first token of `status`.
4. Update `tyb_core.devices.last_seen_at` and `updated_at`.

**Table used:**
- `tyb_core.devices`

### 3) Device Info Payloads (`device-info/<device-id>`)

**Source payload fields:**
- `device_id`, `imei`, `ip`, `rssi`

**Processing steps:**
1. Topic device id is extracted.
2. Device row is queried.
3. Fields update in `tyb_core.devices`:
   - `imei`, `ip_address`, `signal_strength`, `updated_at`

**Table used:**
- `tyb_core.devices`

## EF Core Schema Mapping

**Devices**
- Table: `tyb_core.devices`
- Key: `id` (uuid)
- Lookup column: `device_identifier`

**GPS Data**
- Table: `tyb_spatial.gps_data`
- Key: `id` (uuid)
- PostGIS: `location` (geography/geometry Point, SRID 4326)

**GPS Raw**
- Table: `tyb_spatial.gps_raw`
- Key: `id` (uuid)
- Stores full payload JSON + message metadata.

## Running the Service

Set the connection string by environment variable:

```
TYB_IOT_CONNECTION_STRING=Host=...;Port=5432;Database=trackyourbest;Username=...;Password=...;Ssl Mode=Disable;
```

Then run:

```
dotnet run --project TYB.IoTService/TYB.IoTService.csproj
```

To avoid file locks on rebuild:

```
dotnet run --project TYB.IoTService/TYB.IoTService.csproj --no-build
```

## Notes / Common Issues

- If the build fails with a locked `TYB.IoTService.exe`, stop running instances first.
- If device lookups fail, ensure `tyb_core.devices.device_identifier` matches the topic id (e.g., `tyb00`).
- If `location` type mismatches, ensure DB column type matches EF mapping (`geometry` vs `geography`).
