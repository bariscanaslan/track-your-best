# database_gps.py

from app.db_connection import get_connection
from app.models import GPSData
from datetime import datetime

class GPSDatabase:

    def create_gps_table(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS gps_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                device_id INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(device_id) REFERENCES devices(id)
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_gps_device_id ON gps_data(device_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_data(timestamp)")

        conn.commit()
        conn.close()
        print("GPS Data tablosu hazır")

    def add_gps(self, gps: GPSData) -> bool:
        try:
            conn = get_connection()
            cur = conn.cursor()

            cur.execute("""
                INSERT INTO gps_data (latitude, longitude, device_id)
                VALUES (?, ?, ?)
            """, (gps.latitude, gps.longitude, gps.device_id))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print("GPS insert error:", e)
            return False

    def get_last_gps(self, device_id: int):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT latitude, longitude, device_id, timestamp
            FROM gps_data
            WHERE device_id = ?
            ORDER BY datetime(timestamp) DESC
            LIMIT 1;
        """, (device_id,))

        row = cur.fetchone()
        conn.close()

        return row

gps_db = GPSDatabase()
gps_db.create_gps_table()