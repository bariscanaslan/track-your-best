"""Database connection and session management for TYB.MLService."""

from contextlib import contextmanager

from config.settings import DATABASE_URL
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


@contextmanager
def get_db():
    """Context manager that closes the database session automatically."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


def get_session() -> Session:
    """Return a single database session."""
    return SessionLocal()
