# Intervals

This sheet created for identification of Interval Values of all the services.

The interval refers to how many seconds between each service execution.

## Device Side (ESP32 — `device_register.ino`)

| Event                              | Interval          | Constant / Location                         |
|------------------------------------|-------------------|---------------------------------------------|
| GPS publish — fix acquired         | every 5 seconds   | `GPS_INTERVAL_FIX_MS = 5000`                |
| GPS poll attempt — no fix yet      | every 1.5 seconds | `GPS_INTERVAL_NOFIX_MS = 1500`              |
| GNSS soft reset after no fix       | after 120 seconds | `GPS_NOFIX_RESET_MS = 120000`               |
| Heartbeat publish                  | every 5 minutes   | hardcoded `300000` ms in `loop()`           |
| Device-info publish                | once on connect   | called once inside `connectMQTT()`          |
| GPRS reconnect retry               | every 5 seconds   | `delay(5000)` in `ensureGPRS()`             |
| MQTT reconnect retry (device side) | every 5 seconds   | `delay(5000)` in `ensureMQTT()`             |

## TYB.IoTService

| Event                       | Interval / Duration | Location                               |
|-----------------------------|---------------------|----------------------------------------|
| MQTT keep-alive period      | 30 seconds          | `MqttService` — `WithKeepAlivePeriod`  |
| Reconnect delay after drop  | 5 seconds           | `MqttService` — `DisconnectedAsync`    |
| Worker idle poll            | 1 second            | `MqttWorker` — `Task.Delay(1000)`      |

## TYB.MLService

| Job | Handler | Interval | Source constant |
|-----|---------|----------|-----------------|
| Anomaly Detection | `anomaly_job_handler` | **120 seconds** | `JOB_INTERVALS['anomaly_detection']` |
| Driver Scoring | `driver_scoring_job_handler` | **300 seconds** | `JOB_INTERVALS['driver_scoring']` |
| ETA Prediction | `eta_prediction_job_handler` | **20 seconds** | `JOB_INTERVALS['eta_prediction']` |

