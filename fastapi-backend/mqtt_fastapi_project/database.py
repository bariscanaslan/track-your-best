import sqlite3
from typing import List, Optional
from models import GPSData
from datetime import datetime, timedelta

class GPSDatabase:
    """GPS verilerini SQLite database'de saklar"""
    
    def __init__(self, db_path: str = "gps_data.db"):
        self.db_path = db_path
        self.create_table()
    
    def get_connection(self):
        """Database bağlantısı oluştur"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Dict gibi erişim için
        return conn
    
    def create_table(self):
        """GPS tablosunu oluştur"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gps_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                device_id TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Index oluştur (hızlı sorgulama için)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_device_id 
            ON gps_data(device_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON gps_data(timestamp)
        """)
        
        conn.commit()
        conn.close()
        print("✅ GPS Database tablosu hazır")
    
    def add_gps_data(self, gps: GPSData) -> bool:
        """Yeni GPS verisi ekle"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO gps_data (latitude, longitude, device_id, timestamp)
                VALUES (?, ?, ?, ?)
            """, (
                gps.latitude,
                gps.longitude,
                gps.device_id,
                gps.timestamp or datetime.now()
            ))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"❌ Database ekleme hatası: {e}")
            return False
    
    def get_all_gps_data(self) -> List[GPSData]:
        """Tüm GPS verilerini getir"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT latitude, longitude, device_id, timestamp
            FROM gps_data
            ORDER BY timestamp DESC
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            GPSData(
                latitude=row['latitude'],
                longitude=row['longitude'],
                device_id=row['device_id'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None
            )
            for row in rows
        ]
    
    def get_latest_gps_data(self, device_id: Optional[str] = None, limit: int = 10) -> List[GPSData]:
        """En son GPS verilerini getir"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if device_id:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                WHERE device_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (device_id, limit))
        else:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            GPSData(
                latitude=row['latitude'],
                longitude=row['longitude'],
                device_id=row['device_id'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None
            )
            for row in rows
        ]
    
    def get_last_gps(self, device_id: Optional[str] = None) -> Optional[GPSData]:
        """
        En son gelen tek GPS verisini getir
        
        Args:
            device_id: Belirli bir cihazın son verisi için (opsiyonel)
            
        Returns:
            En son GPS verisi veya None
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if device_id:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                WHERE device_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
            """, (device_id,))
        else:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                ORDER BY timestamp DESC
                LIMIT 1
            """)
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return GPSData(
                latitude=row['latitude'],
                longitude=row['longitude'],
                device_id=row['device_id'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None
            )
        return None
    
    def get_gps_data_by_time_range(
        self, 
        start_time: datetime, 
        end_time: datetime,
        device_id: Optional[str] = None
    ) -> List[GPSData]:
        """Zaman aralığına göre GPS verilerini getir"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if device_id:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                WHERE timestamp BETWEEN ? AND ?
                AND device_id = ?
                ORDER BY timestamp DESC
            """, (start_time, end_time, device_id))
        else:
            cursor.execute("""
                SELECT latitude, longitude, device_id, timestamp
                FROM gps_data
                WHERE timestamp BETWEEN ? AND ?
                ORDER BY timestamp DESC
            """, (start_time, end_time))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            GPSData(
                latitude=row['latitude'],
                longitude=row['longitude'],
                device_id=row['device_id'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None
            )
            for row in rows
        ]
    
    def get_device_ids(self) -> List[str]:
        """Sistemdeki tüm cihaz ID'lerini getir"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT DISTINCT device_id
            FROM gps_data
            WHERE device_id IS NOT NULL
            ORDER BY device_id
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return [row['device_id'] for row in rows]
    
    def clear_old_data(self, days: int = 7):
        """Eski verileri temizle"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cutoff_time = datetime.now() - timedelta(days=days)
        
        cursor.execute("""
            DELETE FROM gps_data
            WHERE timestamp < ?
        """, (cutoff_time,))
        
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        print(f"🗑️ {deleted_count} eski GPS verisi silindi")
        return deleted_count
    
    def get_total_count(self) -> int:
        """Toplam GPS kayıt sayısı"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM gps_data")
        result = cursor.fetchone()
        conn.close()
        
        return result['count'] if result else 0
    
    def delete_all_data(self):
        """TÜM verileri sil (dikkatli kullanın!)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM gps_data")
        conn.commit()
        conn.close()
        
        print("⚠️ TÜM GPS verileri silindi!")

# Global database instance
gps_db = GPSDatabase()