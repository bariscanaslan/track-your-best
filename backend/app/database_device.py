# database_device.py

from app.db_connection import get_connection
from typing import Optional, Dict

class DeviceDatabase:

    def create_device_table(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_name TEXT UNIQUE NOT NULL,
                mqtt_username TEXT NOT NULL,
                mqtt_password TEXT NOT NULL,
                secret_key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_device_name ON devices(device_name)")

        conn.commit()
        conn.close()
        print("Devices tablosu hazır")

    def register_device(self, device_name: str, mqtt_username: str, mqtt_password: str, secret_key: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO devices (device_name, mqtt_username, mqtt_password, secret_key)
            VALUES (?, ?, ?, ?)
        """, (device_name, mqtt_username, mqtt_password, secret_key))

        conn.commit()
        conn.close()

    def get_device(self, device_name: str) -> Optional[Dict]:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, device_name, mqtt_username, mqtt_password, secret_key
            FROM devices
            WHERE device_name = ?
        """, (device_name,))

        row = cur.fetchone()
        conn.close()

        return dict(row) if row else None

    def get_device_id(self, device_name: str) -> Optional[int]:
        device = self.get_device(device_name)
        return device["id"] if device else None

    def get_secret_key(self, device_name: str) -> Optional[str]:
        device = self.get_device(device_name)
        return device["secret_key"] if device else None


device_db = DeviceDatabase()
device_db.create_device_table()
