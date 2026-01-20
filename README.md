# Track Your Best Prototype version 1.4 - How to Start

- First you have to create an sqlite database named as tyb.db

## tyb.db Creation

``` powershell 
CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT UNIQUE NOT NULL,
    mqtt_username TEXT NOT NULL,
    mqtt_password TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE gps_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    device_id INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id)
)

CREATE TABLE sqlite_sequence(name,seq)

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE UNIQUE INDEX idx_device_name ON devices(device_name)
CREATE INDEX idx_gps_device_id ON gps_data(device_id)
CREATE INDEX idx_gps_timestamp ON gps_data(timestamp)
CREATE UNIQUE INDEX idx_users_username ON users(username)

``` 

- Then you should insert some data into this database like device registration or user registration.

- Put tyb.db to backend/tyb.db location

## How to Run

- Edit .env.example file from backend side.

- Then continue editing with .env.example file for frontend side.

- After the .env process finished,

``` powershell

git clone https://github.com/bariscanaslan/track-your-best.git

git checkout prototypeV1

cd track-your-best

sudo docker compose build

sudo docker compose up -d

```

And ta daa!

- Frontend: Port 3003
- Backend: Port 8001