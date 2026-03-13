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


from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON, Uuid, Numeric, Text
from sqlalchemy.ext.declarative import declarative_base
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

Base = declarative_base()


class Trip(Base):
    """tyb_spatial.trips"""
    __tablename__ = 'trips'
    __table_args__ = {'schema': 'tyb_spatial'}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(Uuid)
    driver_id = Column(Uuid)
    trip_name = Column(String(255))
    status = Column(String(50))  # ongoing, completed, cancelled, driver_approve
    
    # PostGIS geometry columns
    start_location = Column(Geometry('POINT', srid=4326))
    end_location = Column(Geometry('POINT', srid=4326))
    route_geometry = Column(Geometry('LINESTRING', srid=4326))
    
    start_address = Column(Text)
    end_address = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    planned_end_time = Column(DateTime)
    duration_seconds = Column(Integer)
    total_distance_km = Column(Numeric(10, 2))
    max_speed = Column(Numeric(6, 2))
    avg_speed = Column(Numeric(6, 2))
    stop_count = Column(Integer, default=0)
    harsh_acceleration_count = Column(Integer, default=0)
    harsh_braking_count = Column(Integer, default=0)
    purpose = Column(String(255))
    notes = Column(Text)
    extra_data = Column('metadata', JSON, default={})  # Map to 'metadata' column in DB
    created_at = Column(DateTime, default=datetime.utcnow)
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


# ============================================
# ETA PREDICTION MODEL (UPDATED TO MATCH ACTUAL DB SCHEMA)
# ============================================

class EtaPrediction(Base):
    """tyb_analytics.eta_predictions - ML-based ETA predictions"""
    __tablename__ = 'eta_predictions'
    __table_args__ = {'schema': 'tyb_analytics'}
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid)
    
    # Timestamps
    prediction_time = Column(DateTime, nullable=False)
    predicted_arrival_time = Column(DateTime, nullable=False)
    actual_arrival_time = Column(DateTime)
    
    # Locations (PostGIS geometry)
    current_location = Column(Geometry('POINT', srid=4326), nullable=False)
    destination = Column(Geometry('POINT', srid=4326), nullable=False)
    
    # Prediction data
    remaining_distance_km = Column(Numeric(10, 2))
    prediction_error_seconds = Column(Integer)
    accuracy_percentage = Column(Numeric(5, 2))
    
    # Model metadata
    model_version = Column(String(50))
    confidence_score = Column(Numeric(5, 2))
    
    # Factors
    traffic_factor = Column(Numeric(5, 2))
    weather_factor = Column(Numeric(5, 2))
    historical_performance = Column(Numeric(5, 2))
    
    # Additional metadata (JSON) - mapped to 'metadata' column in DB
    extra_data = Column('metadata', JSON, default={})


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_pending_trips(session):
    """
    Get trips that need ETA calculation
    
    Status flow:
    - 'driver_approve': Route selected, calculate ETA every 3 minutes
    - 'cancelled': Trip cancelled, skip
    
    Returns:
        List of Trip objects with status='driver_approve'
    """
    
    # Get all approved trips
    pending = session.query(Trip).filter(
        Trip.status == 'driver_approve'
    ).all()
    
    return pending


def create_eta_prediction(session, trip_id, start_location, end_location, prediction_data):
    """
    Create a new ETA prediction record
    
    Args:
        session: SQLAlchemy session
        trip_id: UUID of the trip
        start_location: WKB geometry of current location (POINT)
        end_location: WKB geometry of destination (POINT)
        prediction_data: dict with prediction results from ETAPredictor
    """
    from geoalchemy2.elements import WKBElement
    
    # Calculate traffic factor from prediction data
    traffic_info = prediction_data.get('traffic_info', {})
    avg_speed = traffic_info.get('avg_speed_kmh', 50)
    # Traffic factor: 1.0 = normal, >1.0 = slow, <1.0 = fast
    traffic_factor = 50.0 / avg_speed if avg_speed > 0 else 1.0
    
    # Store additional data in extra_data JSON (maps to 'metadata' column in DB)
    extra_data = {
        'eta_minutes': prediction_data['eta_minutes'],
        'eta_formatted': prediction_data.get('eta_formatted', ''),
        'is_rush_hour': traffic_info.get('is_rush_hour', False),
        'avg_speed_kmh': avg_speed,
        'traffic_density': traffic_info.get('traffic_density', 0),
        'hour': traffic_info.get('hour', 0),
        'day_of_week': traffic_info.get('day_of_week', 0),
        'is_weekend': traffic_info.get('is_weekend', False),
        'model_info': prediction_data.get('model_info', {})
    }
    
    eta_record = EtaPrediction(
        trip_id=trip_id,
        device_id=None,  # Can be added if needed
        prediction_time=prediction_data['prediction_timestamp'],
        predicted_arrival_time=prediction_data['predicted_arrival_time'],
        current_location=start_location,  # WKBElement
        destination=end_location,  # WKBElement
        remaining_distance_km=prediction_data.get('distance_km', 0),
        model_version='eta_model_istanbul',  # Match training version
        confidence_score=prediction_data.get('confidence', 0) * 100,  # Convert to percentage
        traffic_factor=traffic_factor,
        weather_factor=1.0,  # Default, can be enhanced later
        historical_performance=None,  # Can be calculated from past predictions
        extra_data=extra_data
    )
    
    session.add(eta_record)
    session.commit()
    
    return eta_record