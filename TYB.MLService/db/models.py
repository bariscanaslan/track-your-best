"""
TYB MLService - Database ORM Modelleri
======================================
tyb_spatial ve tyb_analytics şemalarının SQLAlchemy modelleri
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON, Uuid
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


class Trip(Base):
    """tyb_spatial.trips"""
    __tablename__ = 'trips'
    __table_args__ = {'schema': 'tyb_spatial'}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    device_id = Column(Uuid, nullable=False)
    driver_id = Column(Uuid)
    vehicle_id = Column(Uuid)
    status = Column(String(50), default='pending')  # pending, in_progress, completed
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    duration_seconds = Column(Integer)
    total_distance_km = Column(Float)
    avg_speed = Column(Float)
    max_speed = Column(Float)
    stop_count = Column(Integer)
    harsh_acceleration_count = Column(Integer)
    harsh_braking_count = Column(Integer)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GpsData(Base):
    """tyb_spatial.gps_data"""
    __tablename__ = 'gps_data'
    __table_args__ = {'schema': 'tyb_spatial'}

    id = Column(Integer, primary_key=True, autoincrement=True) # UUID değil BigInt olarak güncellendi
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    gps_timestamp = Column(DateTime, nullable=False)
    received_timestamp = Column(DateTime, default=datetime.utcnow) # created_at yerine bunu ekle


class DriverScore(Base):
    """tyb_analytics.driver_scores"""
    __tablename__ = 'driver_scores'
    __table_args__ = {'schema': 'tyb_analytics'}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False, unique=True)
    driver_id = Column(Uuid)
    overall_score = Column(Float)  # ML Score (0-100)
    speed_score = Column(Float)
    acceleration_score = Column(Float)
    braking_score = Column(Float)
    idle_time_score = Column(Float)
    total_trips = Column(Integer)
    total_distance_km = Column(Float)
    total_duration_seconds = Column(Integer)
    speeding_events = Column(Integer)
    harsh_acceleration_events = Column(Integer)
    harsh_braking_events = Column(Integer)
    period_type = Column(String(20), default='TRIP')  # TRIP, DAILY, WEEKLY
    analysis_date = Column(String(20))
    calculated_at = Column(DateTime, default=datetime.utcnow)
    model_metadata = Column('metadata', JSON)  # {ml_score, features, raw_score, ...}


class Anomaly(Base):
    """tyb_analytics.anomalies"""
    __tablename__ = 'anomalies'
    __table_args__ = {'schema': 'tyb_analytics'}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid, nullable=False)
    anomaly_type = Column(String(100))  # isolation_forest_anomaly, low_score, etc.
    severity = Column(String(20))  # low, medium, high, critical
    description = Column(String(500))
    confidence_score = Column(Float)  # 0-1
    algorithm_used = Column(String(100))  # IsolationForest_v1, etc.
    detected_at = Column(DateTime, default=datetime.utcnow)
    model_metadata = Column('metadata', JSON)  # {anomaly_score, flags, raw_score, ...}

