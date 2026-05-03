# TYB.IoTService

Real-time IoT ingestion service for the **Track Your Best (TYB)** platform.  
This service connects to the MQTT broker, receives messages from IoT devices, validates and parses them, then writes the processed data into PostgreSQL.

---

## What This Service Does

- Maintains a persistent connection to the MQTT broker
- Subscribes to three topic patterns: `gps/#`, `heartbeat/#`, `device-info/#`
- Routes each incoming message to the correct handler
- Validates GPS message authenticity using HMAC-SHA256 signatures
- Writes GPS records (raw + normalized) to PostgreSQL with PostGIS spatial data
- Updates device last-seen timestamps from heartbeat messages
- Updates device metadata (IMEI, IP, signal strength) from device-info messages

This is a **Worker Service** — it has no HTTP endpoints, no controllers. It runs as a long-lived background process.

---

## Why This Service Exists

The API service (`TYB.ApiService`) serves web clients and is stateless per request. IoT devices publish data continuously over MQTT, which requires a permanently connected subscriber. `TYB.IoTService` fills that role — it is the real-time ingestion layer between physical devices and the database.

---

## Project Structure

```
TYB.IoTService/
├── Background/
│   └── MqttWorker.cs              # Hosted service — MQTT lifecycle + message dispatch
├── Configuration/
│   └── MqttSettings.cs            # Strongly-typed config model for MQTT settings
├── Handlers/
│   ├── IMessageHandler.cs         # Handler contract
│   ├── GpsMessageHandler.cs       # Handles gps/# messages
│   ├── HeartbeatMessageHandler.cs # Handles heartbeat/# messages
│   └── DeviceInfoMessageHandler.cs # Handles device-info/# messages
├── Infrastructure/
│   ├── Data/
│   │   └── IoTDbContext.cs        # EF Core database context
│   └── Entities/
│       ├── Core/
│       │   ├── Device.cs          # tyb_core.devices entity
│       │   └── Vehicle.cs         # tyb_core.vehicles entity
│       └── Spatial/
│           ├── GpsData.cs         # tyb_spatial.gps_data entity
│           ├── GpsRaw.cs          # tyb_spatial.gps_raw entity
│           └── Trip.cs            # tyb_spatial.trips entity
├── Models/
│   ├── GpsMessage.cs              # Incoming GPS JSON payload shape
│   ├── HeartbeatMessage.cs        # Incoming heartbeat JSON payload shape
│   └── DeviceInfoMessage.cs       # Incoming device-info JSON payload shape
├── MQTT/
│   ├── IMqttService.cs            # MQTT service interface
│   ├── MqttService.cs             # MQTTnet implementation (connect, subscribe, publish)
│   └── MqttTopicManager.cs        # Reads topic list from configuration
├── Routing/
│   ├── TopicRouter.cs             # Picks the correct handler for each topic
│   └── TopicParser.cs             # Extracts device ID from topic string
├── Program.cs                     # DI container setup + app entry point
├── appsettings.json               # MQTT connection + logging config
└── .env                           # Local environment variables (DB connection string)
```

---

## Important Files

### Background/MqttWorker.cs

The only hosted service in the application. Registered via `AddHostedService<MqttWorker>()`.

On startup it:
1. Registers a `MessageReceived` event handler on `IMqttService`
2. Calls `ConnectAsync` to connect to the broker
3. Calls `SubscribeAsync` with the topic list from `MqttTopicManager`
4. Enters an idle loop (`Task.Delay(1000)`) to keep the host alive

Each incoming MQTT message triggers the event handler, which:
- Creates a new DI scope (so `IoTDbContext` is scoped, not shared across messages)
- Resolves `TopicRouter` from that scope
- Calls `router.RouteAsync(topic, payload)`

### MQTT/MqttService.cs

Wraps the MQTTnet v4 client. Key behaviors:

- **Client ID**: `{ClientId}-{newGuid}` — generates a unique suffix each run to avoid broker session conflicts
- **Keep-alive**: 30 seconds (`WithKeepAlivePeriod`)
- **Clean session**: `true` — does not resume previous sessions on reconnect
- **On disconnect**: waits **5 seconds**, then reconnects and re-subscribes to all topics automatically
- **On connect**: re-subscribes to all topics from `appsettings.json`
- **QoS for publish**: `AtLeastOnce`

**Reconnect interval: 5 seconds** (hardcoded in `DisconnectedAsync` handler).

### MQTT/MqttTopicManager.cs

Reads `SubscribeTopics` from `MqttSettings` and exposes them as `IEnumerable<string>`. Single responsibility: topic list management.

### MQTT/IMqttService.cs

Interface contract exposing:
- `event Func<string, string, Task>? MessageReceived` — fired for every incoming message
- `ConnectAsync(CancellationToken)`
- `SubscribeAsync(IEnumerable<string>)`
- `PublishAsync(string topic, string payload)`

### Routing/TopicRouter.cs

Iterates all registered `IMessageHandler` implementations and calls `HandleAsync` on the first one where `CanHandle(topic)` returns `true`. If no handler matches, logs to console. First-match wins — handler registration order in DI matters.

### Routing/TopicParser.cs

Static utility. Splits a topic string by `/` and returns the second segment as the device ID.

```
gps/tyb00         → deviceId = "tyb00"
heartbeat/tyb00   → deviceId = "tyb00"
device-info/tyb00 → deviceId = "tyb00"
```

Requires exactly two segments; otherwise returns `false`.

### Handlers/GpsMessageHandler.cs

Handles `gps/<device-id>` topics.

**Steps:**
1. Extracts device ID from topic via `TopicParser`
2. Deserializes JSON payload into `GpsMessage`
3. Validates that the payload `device_id` matches the topic device ID
4. Looks up the device in `tyb_core.devices` by `device_identifier`
5. Rejects messages from inactive devices
6. **Validates HMAC-SHA256 signature** — if invalid, saves a `GpsRaw` record marked `is_valid = false` and stops
7. Looks up the active (status = `"ongoing"`) trip for the vehicle assigned to this device
8. Saves a `GpsRaw` record (`tyb_spatial.gps_raw`) — always saved for valid signatures
9. Saves a `GpsData` record (`tyb_spatial.gps_data`) — normalized, includes PostGIS `location` point (SRID 4326)

**Signature validation algorithm:**
- Canonical payload: `{"device_id":"<id>","latitude":<lat>,"longitude":<lon>,"timestamp":<ts>}`
- HMAC key: `device.SecretKey` (stored in `tyb_core.devices.secret_key`)
- Algorithm: HMAC-SHA256, hex-encoded
- Comparison: constant-time string equality to prevent timing attacks

### Handlers/HeartbeatMessageHandler.cs

Handles `heartbeat/<device-id>` topics.

**Device ID resolution order:**
1. Topic segment (e.g. `heartbeat/tyb00` → `tyb00`)
2. If topic segment is literally `"alive"`, it is ignored
3. Payload `device_id` field
4. First token of payload `status` string (e.g. `"tyb00 alive"` → `"tyb00"`)
5. First token of raw payload text (if JSON parsing fails)

**On success:** updates `last_seen_at` and `updated_at` on the device row.

**No new rows are inserted.** Only an UPDATE on the existing device record.

### Handlers/DeviceInfoMessageHandler.cs

Handles `device-info/<device-id>` and `device-info` topics.

**Device ID resolution:**
- From topic segment if present
- For exact topic `device-info` (no sub-segment): uses `imei` from payload, then `device_id`
- Cross-checks payload `device_id` against topic device ID — mismatches are rejected

**Fields updated on the device row (`tyb_core.devices`):**
- `imei` (from `message.Imei`)
- `ip_address` (from `message.IpAddress` or `message.Ip`)
- `signal_strength` (from `message.SignalStrength` or `message.Rssi`)
- `updated_at`

### Infrastructure/Data/IoTDbContext.cs

EF Core `DbContext` with manual column mappings — no auto-conventions.

| `DbSet`    | Schema        | Table      |
|------------|---------------|------------|
| `Devices`  | `tyb_core`    | `devices`  |
| `Vehicles` | `tyb_core`    | `vehicles` |
| `Trips`    | `tyb_spatial` | `trips`    |
| `GpsData`  | `tyb_spatial` | `gps_data` |
| `GpsRaw`   | `tyb_spatial` | `gps_raw`  |

PostGIS column type for `GpsData.Location`: `geography (point, 4326)`.

Indexes defined:
- `devices.device_identifier`
- `gps_raw.device_id`
- `gps_raw.received_at`

### Configuration/MqttSettings.cs

Bound to the `"Mqtt"` section of `appsettings.json`.

| Property          | Type           | Description                         |
|-------------------|----------------|-------------------------------------|
| `Host`            | `string`       | MQTT broker hostname or IP          |
| `Port`            | `int`          | MQTT broker port (default 1883)     |
| `Username`        | `string`       | Broker auth username                |
| `Password`        | `string`       | Broker auth password                |
| `ClientId`        | `string`       | Base client ID (suffix is appended) |
| `SubscribeTopics` | `List<string>` | Topics to subscribe on startup      |

### Program.cs

Registers all services and starts the host:

```csharp
// Database
AddDbContext<IoTDbContext>()       // Scoped (default)

// MQTT
AddSingleton<IMqttService, MqttService>()
AddSingleton<MqttTopicManager>()

// Message handlers (Scoped — new instance per message)
AddScoped<TopicRouter>()
AddScoped<IMessageHandler, GpsMessageHandler>()
AddScoped<IMessageHandler, HeartbeatMessageHandler>()
AddScoped<IMessageHandler, DeviceInfoMessageHandler>()

// Background worker
AddHostedService<MqttWorker>()
```

Connection string resolution order:
1. `ConnectionStrings:IoT` (from `appsettings.json` or environment)
2. `TYB_IOT_CONNECTION_STRING` (environment variable)

Startup throws `InvalidOperationException` if neither is found.

`.env` file loading: tries three candidate paths (working directory, base directory, one level up). Falls back to manual environment variable injection if `DotNetEnv` does not set them.

---

## MQTT Topics

| Topic Pattern   | Description                            | Handler                     |
|-----------------|----------------------------------------|-----------------------------|
| `gps/#`         | GPS coordinates from a device          | `GpsMessageHandler`         |
| `heartbeat/#`   | Device alive signal                    | `HeartbeatMessageHandler`   |
| `device-info/#` | Device metadata (IMEI, IP, signal)     | `DeviceInfoMessageHandler`  |

Topics follow the format `<type>/<device-identifier>`.  
Example: `gps/tyb00`, `heartbeat/tyb00`, `device-info/tyb00`.

---

## Message Flow

```
IoT Device
    │
    │  MQTT publish → gps/tyb00
    ▼
MQTT Broker (51.20.118.85:1883)
    │
    │  MQTTnet ApplicationMessageReceivedAsync event
    ▼
MqttService (IMqttService)
    │
    │  fires MessageReceived event
    ▼
MqttWorker (event handler)
    │
    │  creates DI scope
    ▼
TopicRouter.RouteAsync(topic, payload)
    │
    │  CanHandle("gps/tyb00") == true
    ▼
GpsMessageHandler.HandleAsync(topic, payload)
    │
    ├─ parse JSON payload
    ├─ lookup device in DB (tyb_core.devices)
    ├─ validate HMAC-SHA256 signature
    ├─ resolve ongoing trip via vehicle → trip join
    ├─ save GpsRaw to tyb_spatial.gps_raw
    └─ save GpsData to tyb_spatial.gps_data (PostGIS point)
    │
    ▼
PostgreSQL
  tyb_spatial.gps_raw   ← raw JSON + validation metadata
  tyb_spatial.gps_data  ← normalized coordinates + trip link
```

---

## Database Write Flow

### GPS message — valid signature

```
tyb_core.devices          ← READ  (lookup by device_identifier)
tyb_core.vehicles         ← READ  (find vehicle for this device)
tyb_spatial.trips         ← READ  (find ongoing trip for vehicle)
tyb_spatial.gps_raw       ← WRITE (raw payload, is_valid = true)
tyb_spatial.gps_data      ← WRITE (normalized coords + PostGIS point)
```

### GPS message — invalid signature

```
tyb_core.devices          ← READ
tyb_spatial.gps_raw       ← WRITE (is_valid = false, validation_error set)
```

No `gps_data` record is written for invalid signatures.

### Heartbeat message

```
tyb_core.devices          ← UPDATE (last_seen_at, updated_at)
```

### Device-info message

```
tyb_core.devices          ← UPDATE (imei, ip_address, signal_strength, updated_at)
```

---

## Intervals and Timers

### Device Side (ESP32 — `device_register.ino`)

| Event                              | Interval          | Constant / Location                         |
|------------------------------------|-------------------|---------------------------------------------|
| GPS publish — fix acquired         | every 5 seconds   | `GPS_INTERVAL_FIX_MS = 5000`                |
| GPS poll attempt — no fix yet      | every 1.5 seconds | `GPS_INTERVAL_NOFIX_MS = 1500`              |
| GNSS soft reset after no fix       | after 120 seconds | `GPS_NOFIX_RESET_MS = 120000`               |
| Heartbeat publish                  | every 5 minutes   | hardcoded `300000` ms in `loop()`           |
| Device-info publish                | once on connect   | called once inside `connectMQTT()`          |
| GPRS reconnect retry               | every 5 seconds   | `delay(5000)` in `ensureGPRS()`             |
| MQTT reconnect retry (device side) | every 5 seconds   | `delay(5000)` in `ensureMQTT()`             |

**Notes:**
- When the device has no GPS fix, it polls the SIM808 every 1.5 seconds but **does not publish** to the broker — no GPS message is sent until coordinates are confirmed valid.
- If no fix is obtained for 120 seconds continuously, the device performs a GNSS soft reset (`AT+CGNSPWR=0` / `AT+CGNSPWR=1`) and resets the no-fix timer. The reset itself cannot fire more often than once per 120 seconds.
- Device-info (IMEI, IP, signal strength) is only published once when the MQTT connection is (re-)established, not on a recurring timer.

### Service Side (TYB.IoTService)

| Event                       | Interval / Duration | Location                               |
|-----------------------------|---------------------|----------------------------------------|
| MQTT keep-alive period      | 30 seconds          | `MqttService` — `WithKeepAlivePeriod`  |
| Reconnect delay after drop  | 5 seconds           | `MqttService` — `DisconnectedAsync`    |
| Worker idle poll            | 1 second            | `MqttWorker` — `Task.Delay(1000)`      |

There are no polling workers, cron jobs, flush timers, or batch processing loops on the service side. All processing is event-driven — a database write happens immediately when each MQTT message arrives.

---

## Error Handling

| Scenario                                | Behavior                                                        |
|-----------------------------------------|-----------------------------------------------------------------|
| MQTT broker disconnects                 | Auto-reconnects after 5 seconds, re-subscribes all topics       |
| JSON deserialization fails              | Logs a warning, message is dropped                              |
| Device not found in DB                  | Logs a warning, message is dropped                              |
| Device is inactive                      | Logs a warning, GPS message is dropped                          |
| GPS device ID mismatch (topic/payload)  | Logs a warning, message is dropped                              |
| HMAC signature invalid                  | Saves `GpsRaw` with `is_valid = false`, no `GpsData` written    |
| Missing connection string on startup    | Throws `InvalidOperationException`, service does not start      |
| No handler matches the topic            | Logs to console, message is dropped silently                    |

There is no retry logic for failed database writes — if `SaveChangesAsync` throws, the exception propagates and the message is lost. MQTT QoS for incoming messages depends on broker and device configuration.

---

## Logging

Uses `Microsoft.Extensions.Logging` (`ILogger<T>`).

| Level            | Where used                                                            |
|------------------|-----------------------------------------------------------------------|
| `LogWarning`     | Invalid payloads, device not found, signature failures, ID mismatches |
| `Console.WriteLine` | MQTT connect/disconnect/reconnect events, unhandled topics         |

Default log level is `Information` (set in `appsettings.json`). No structured logging sinks (Serilog, etc.) are configured.

---

## Configuration

### appsettings.json

```json
{
  "Mqtt": {
    "Host": "51.20.118.85",
    "Port": 1883,
    "Username": "tyb-device",
    "Password": "Tyb.1905",
    "ClientId": "TYB.IoTService",
    "SubscribeTopics": [ "gps/#", "heartbeat/#", "device-info/#" ]
  }
}
```

### Environment Variables

| Variable                    | Description                                   |
|-----------------------------|-----------------------------------------------|
| `TYB_IOT_CONNECTION_STRING` | PostgreSQL connection string                  |
| `ConnectionStrings__IoT`    | Alternative (ASP.NET-style env var format)    |

The `.env` file at the project root is loaded automatically at startup. It takes lower priority than actual environment variables — existing env vars are never overwritten.

Example `.env`:

```
TYB_IOT_CONNECTION_STRING=Host=localhost;Port=5432;Database=trackyourbest_local;Username=postgres;Password=Tyb.1905;Ssl Mode=Disable;
```

---

## Dependency Injection Summary

| Service                   | Lifetime   | Notes                                            |
|---------------------------|------------|--------------------------------------------------|
| `IoTDbContext`            | Scoped     | One instance per DI scope (per message)          |
| `IMqttService`            | Singleton  | Single MQTT connection for the process lifetime  |
| `MqttTopicManager`        | Singleton  | Reads from config once                           |
| `TopicRouter`             | Scoped     | Resolved per message inside a new scope          |
| `GpsMessageHandler`       | Scoped     | One instance per message scope                   |
| `HeartbeatMessageHandler` | Scoped     | One instance per message scope                   |
| `DeviceInfoMessageHandler`| Scoped     | One instance per message scope                   |
| `MqttWorker`              | Hosted     | Singleton lifetime, managed by `IHost`           |

`IServiceScopeFactory` is injected into `MqttWorker` to create a fresh scope for each message. This ensures `IoTDbContext` (Scoped) is isolated per message and not shared across concurrent message handlers.

---

## How to Run Locally

**Prerequisites:**
- .NET 8 SDK
- PostgreSQL running locally with the `trackyourbest_local` database
- MQTT broker accessible (or update `appsettings.json` to point to a local broker)

**Steps:**

1. Set the database connection string in `.env` at the project root:

```
TYB_IOT_CONNECTION_STRING=Host=localhost;Port=5432;Database=trackyourbest_local;Username=postgres;Password=yourpassword;Ssl Mode=Disable;
```

2. Run the service from the solution root or the project directory:

```bash
dotnet run --project TYB.IoTService.csproj
```

The service will connect to the MQTT broker, subscribe to all configured topics, and begin processing messages. You will see output like:

```
MQTT Connected & Subscribed.
```

---

## Notes for Future Developers

- **Handler registration order matters.** `TopicRouter` uses `FirstOrDefault` — the first handler whose `CanHandle` returns `true` wins. Register more specific handlers before catch-all ones.
- **Scoped context per message is intentional.** Never inject `IoTDbContext` as Singleton. The `IServiceScopeFactory` pattern in `MqttWorker` ensures each message gets a fresh DB context.
- **Signature validation is required for GPS.** Devices must sign their payloads with HMAC-SHA256 using their `secret_key`. Invalid messages are stored in `gps_raw` for audit purposes but not processed further.
- **Inactive devices are rejected.** Setting `is_active = false` on a device in the database will cause all its GPS messages to be dropped silently (logged as a warning).
- **`heartbeat/alive` is a special case.** The literal topic `heartbeat/alive` is not treated as a device-specific heartbeat. The handler ignores that segment and falls back to the payload to resolve the device ID.
- **`device-info` (bare topic) is supported.** Devices can publish to the exact topic `device-info` without a sub-segment. The handler resolves the device using `imei` or `device_id` from the payload.
- **There is no HTTP interface.** This service exposes no endpoints. Monitoring must be done via logs or database queries.
- **Reconnect is a flat delay, not exponential.** The current reconnect logic retries after a flat 5-second delay on every disconnect. If the broker is unavailable for a long time, it will retry indefinitely.
- **No migrations run here.** Schema management is handled externally. `IoTDbContext` is read/write only — no `EnsureCreated` or `Migrate` calls at startup.
- **If the build fails with a locked executable**, stop any running instances of the service before rebuilding.
- **Device identifier must match exactly.** `tyb_core.devices.device_identifier` must match the topic segment (e.g., `tyb00`). Case-insensitive comparison is used for payload fields but the DB lookup is exact.
