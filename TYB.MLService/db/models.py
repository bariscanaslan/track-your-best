"""SQLAlchemy models for the TrackYourBest spatial and analytics schemas."""

from datetime import datetime, timedelta, timezone
import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, Numeric, String, Text, Uuid, text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Trip(Base):
    """tyb_spatial.trips."""

    __tablename__ = "trips"
    __table_args__ = {"schema": "tyb_spatial"}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(Uuid)
    driver_id = Column(Uuid)
    trip_name = Column(String(255))
    status = Column(String(50))
    start_location = Column(Geometry("POINT", srid=4326))
    end_location = Column(Geometry("POINT", srid=4326))
    route_geometry = Column(Geometry("LINESTRING", srid=4326))
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
    notes = Column(Text)
    extra_data = Column("metadata", JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    pause_count = Column(Integer, default=0)
    anomaly_checked = Column(Boolean, default=False, nullable=False)


class GpsData(Base):
    """tyb_spatial.gps_data."""

    __tablename__ = "gps_data"
    __table_args__ = {"schema": "tyb_spatial"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    gps_timestamp = Column(DateTime, nullable=False)
    received_timestamp = Column(DateTime, default=datetime.utcnow)


class DriverScore(Base):
    """tyb_analytics.driver_scores."""

    __tablename__ = "driver_scores"
    __table_args__ = {"schema": "tyb_analytics"}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False, unique=True)
    driver_id = Column(Uuid)
    overall_score = Column(Float)
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
    period_type = Column(String(20), default="TRIP")
    analysis_date = Column(String(20))
    calculated_at = Column(DateTime, default=datetime.utcnow)
    model_metadata = Column("metadata", JSON)


class Anomaly(Base):
    """tyb_analytics.anomalies."""

    __tablename__ = "anomalies"
    __table_args__ = {"schema": "tyb_analytics"}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid, nullable=False)
    anomaly_type = Column(String(100))
    severity = Column(String(20))
    description = Column(String(500))
    confidence_score = Column(Float)
    algorithm_used = Column(String(100))
    detected_at = Column(DateTime, default=datetime.utcnow)
    model_metadata = Column("metadata", JSON)
    location = Column(Geometry("POINT", srid=4326))


class EtaPrediction(Base):
    """tyb_analytics.eta_predictions."""

    __tablename__ = "eta_predictions"
    __table_args__ = {"schema": "tyb_analytics"}

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    trip_id = Column(Uuid, nullable=False)
    device_id = Column(Uuid)
    prediction_time = Column(DateTime, nullable=False)
    predicted_arrival_time = Column(DateTime, nullable=False)
    actual_arrival_time = Column(DateTime)
    current_location = Column(Geometry("POINT", srid=4326), nullable=False)
    destination = Column(Geometry("POINT", srid=4326), nullable=False)
    remaining_distance_km = Column(Numeric(10, 2))
    prediction_error_seconds = Column(Integer)
    accuracy_percentage = Column(Numeric(5, 2))
    model_version = Column(String(50))
    confidence_score = Column(Numeric(5, 2))
    traffic_factor = Column(Numeric(5, 2))
    weather_factor = Column(Numeric(5, 2))
    historical_performance = Column(Numeric(5, 2))
    extra_data = Column("metadata", JSON, default={})


def get_pending_trips(session):
    """Return recent ongoing or paused trips that need ETA calculation."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=2)
    cutoff_naive = cutoff.replace(tzinfo=None)

    return session.query(Trip).filter(
        Trip.status.in_(["ongoing", "paused"]),
        Trip.created_at >= cutoff_naive,
    ).all()


def get_device_id_for_trip(session, trip_id):
    """Resolve a trip's device_id from GPS data or the assigned vehicle."""
    gps = session.query(GpsData).filter(
        GpsData.trip_id == trip_id,
        GpsData.device_id.isnot(None),
    ).order_by(GpsData.gps_timestamp.desc()).first()
    if gps:
        return gps.device_id

    row = session.execute(
        text("""
            SELECT v.device_id
            FROM tyb_core.vehicles v
            JOIN tyb_spatial.trips t ON t.vehicle_id = v.id
            WHERE t.id = :trip_id AND v.device_id IS NOT NULL
            LIMIT 1
        """),
        {"trip_id": str(trip_id)},
    ).fetchone()

    if row:
        return uuid.UUID(str(row[0]))
    return None


def create_eta_prediction(session, trip_id, start_location, end_location, prediction_data):
    """Create a new ETA prediction record."""
    traffic_info = prediction_data.get("traffic_info", {})
    avg_speed = traffic_info.get("avg_speed_kmh", 50)
    traffic_factor = 50.0 / avg_speed if avg_speed > 0 else 1.0

    extra_data = {
        "eta_minutes": prediction_data["eta_minutes"],
        "eta_formatted": prediction_data.get("eta_formatted", ""),
        "is_rush_hour": traffic_info.get("is_rush_hour", False),
        "avg_speed_kmh": avg_speed,
        "traffic_density": traffic_info.get("traffic_density", 0),
        "hour": traffic_info.get("hour", 0),
        "day_of_week": traffic_info.get("day_of_week", 0),
        "is_weekend": traffic_info.get("is_weekend", False),
        "model_info": prediction_data.get("model_info", {}),
    }

    eta_record = EtaPrediction(
        trip_id=trip_id,
        device_id=get_device_id_for_trip(session, trip_id),
        prediction_time=prediction_data["prediction_timestamp"],
        predicted_arrival_time=prediction_data["predicted_arrival_time"],
        current_location=start_location,
        destination=end_location,
        remaining_distance_km=prediction_data.get("distance_km", 0),
        model_version="eta_model_istanbul",
        confidence_score=prediction_data.get("confidence", 0) * 100,
        traffic_factor=traffic_factor,
        weather_factor=1.0,
        historical_performance=None,
        extra_data=extra_data,
    )

    session.add(eta_record)
    session.commit()

    return eta_record
