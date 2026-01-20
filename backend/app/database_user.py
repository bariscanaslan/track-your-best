# database_user.py

from app.db_connection import get_connection
from passlib.hash import bcrypt
from typing import Optional

class User:
    def __init__(self, id: int, username: str, full_name: str, created_at: str):
        self.id = id
        self.username = username
        self.full_name = full_name
        self.created_at = created_at

class UserDatabase:

    def create_user_table(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")

        conn.commit()
        conn.close()
        print("Users tablosu hazır")

    def create_user(self, username: str, password: str, full_name: Optional[str] = None) -> bool:
        try:
            conn = get_connection()
            cur = conn.cursor()

            password_hash = bcrypt.hash(password)

            cur.execute("""
                INSERT INTO users (username, password_hash, full_name)
                VALUES (?, ?, ?)
            """, (username, password_hash, full_name))

            conn.commit()
            conn.close()
            return True

        except Exception as e:
            print("User insert error:", e)
            return False

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
        conn.close()

        if row and bcrypt.verify(password, row["password_hash"]):
            return User(
                id=row["id"],
                username=row["username"],
                full_name=row["full_name"],
                created_at=row["created_at"]
            )

        return None

user_db = UserDatabase()
user_db.create_user_table()
