"""
TYB MLService - Database Bağlantısı
===================================
SQLAlchemy Engine ve Session Factory
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from config.settings import DATABASE_URL

# Engine oluştur (pool settings optimize edilmiş)
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_pre_ping=True  # Connection health check
)

# SessionFactory oluştur
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)


@contextmanager
def get_db():
    """Context manager: veritabanı session'ı otomatik kapat"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def get_session() -> Session:
    """Tek bir session döndür"""
    return SessionLocal()

