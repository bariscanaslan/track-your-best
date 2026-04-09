"""
ETA Prediction Job
==================
Background job to predict ETA for approved trips
"""

from datetime import datetime
import pytz
import logging

from db.database import get_db
from db.models import Trip, EtaPrediction, get_pending_trips, create_eta_prediction
from ml_core.eta_predictor import ETAPredictor
from utils.osrm_client import OSRMClient
from config.settings import TIMEZONE, ETA_BATCH_SIZE

logger = logging.getLogger(__name__)


class ETAPredictionJob:
    """Background job for ETA predictions"""
    
    def __init__(self):
        """Initialize job with predictor and OSRM client"""
        self.predictor = ETAPredictor()
        self.osrm = OSRMClient()
        self.tz = pytz.timezone(TIMEZONE)
        self.batch_size = ETA_BATCH_SIZE
        
        logger.info("✅ ETA Prediction Job initialized")
    
    def run(self):
        """
        Main job execution:
        Process approved trips (status='driver_approve')
        - Initial ETA if no GPS data yet
        - Live ETA updates if GPS data exists
        """
        try:
            with get_db() as session:
                # Get all driver_approve trips
                pending_trips = get_pending_trips(session)
                
                if len(pending_trips) == 0:
                    logger.debug("No trips to process")
                    return
                
                logger.info(f"Processing {len(pending_trips)} trips (total driver_approve: {len(pending_trips)})")
                
                success_count = 0
                error_count = 0
                
                # Process trips (batch limit)
                for trip in pending_trips[:self.batch_size]:
                    try:
                        self._process_trip(session, trip)
                        success_count += 1
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Failed to process trip {trip.id}: {e}")
                
                logger.info(f"✅ Batch complete: {success_count} successful, {error_count} errors")
                
        except Exception as e:
            logger.error(f"❌ ETA Prediction Job failed: {e}")
    
    def _process_trip(self, session, trip):
        """
        Process a single trip:
        1. Get current location (GPS if available, otherwise start_location)
        2. Calculate route to destination
        3. Predict ETA
        4. Save to database
        
        Args:
            session: SQLAlchemy session
            trip: Trip object (status='driver_approve')
        """
        from geoalchemy2.shape import to_shape
        from db.models import GpsData
        
        # Get destination from trip
        if not trip.end_location:
            raise ValueError(f"Trip {trip.id} missing end_location")
        
        end_point = to_shape(trip.end_location)
        end_lon = end_point.x
        end_lat = end_point.y
        
        # Try to get current location from GPS, otherwise use start_location
        latest_gps = session.query(GpsData).filter(
            GpsData.trip_id == trip.id
        ).order_by(
            GpsData.gps_timestamp.desc()
        ).first()
        
        if latest_gps and latest_gps.latitude and latest_gps.longitude:
            # Use GPS location (user is driving)
            # Create PostGIS POINT from lat/lon
            from geoalchemy2.elements import WKTElement
            current_lon = latest_gps.longitude
            current_lat = latest_gps.latitude
            current_location_geom = WKTElement(f'POINT({current_lon} {current_lat})', srid=4326)
            location_source = "GPS"
        else:
            # Use start location (initial ETA, user hasn't started yet)
            if not trip.start_location:
                raise ValueError(f"Trip {trip.id} has no start_location")
            current_point = to_shape(trip.start_location)
            current_lon = current_point.x
            current_lat = current_point.y
            current_location_geom = trip.start_location
            location_source = "start"
        
        logger.debug(
            f"Trip {trip.id} [{location_source}]: "
            f"Current ({current_lat:.4f}, {current_lon:.4f}) "
            f"→ Destination ({end_lat:.4f}, {end_lon:.4f})"
        )
        
        # Get OSRM route from current location to destination
        route = self.osrm.get_route(
            start_lon=current_lon,
            start_lat=current_lat,
            end_lon=end_lon,
            end_lat=end_lat
        )
        
        # Predict ETA
        timestamp = datetime.now(self.tz)
        
        prediction = self.predictor.predict(
            distance_km=route['distance_km'],
            osrm_duration_sec=route['duration_sec'],
            timestamp=timestamp
        )
        
        # Add route distance to prediction
        prediction['distance_km'] = route['distance_km']
        prediction['osrm_duration_sec'] = route['duration_sec']
        
        # Save to database
        eta_record = create_eta_prediction(
            session=session,
            trip_id=trip.id,
            start_location=current_location_geom,  # Current location (GPS or start)
            end_location=trip.end_location,         # Destination
            prediction_data=prediction
        )
        
        # Keep status as 'driver_approve' for continuous updates
        # User will change to 'cancelled' when trip ends
        
        logger.info(
            f"✅ Trip {trip.id} [{location_source}]: "
            f"ETA={prediction['eta_minutes']:.1f}min, "
            f"Distance={route['distance_km']:.2f}km, "
            f"Speed={prediction['traffic_info']['avg_speed_kmh']:.1f}km/h"
        )
        
        return eta_record
    
    def health_check(self):
        """Check if job dependencies are healthy"""
        
        # Check OSRM
        if not self.osrm.health_check():
            logger.error("❌ OSRM service is not available")
            return False
        
        # Check model
        try:
            test_prediction = self.predictor.predict(
                distance_km=10,
                osrm_duration_sec=600,
                timestamp=datetime.now(self.tz)
            )
            logger.info("✅ ETA Predictor is healthy")
        except Exception as e:
            logger.error(f"❌ ETA Predictor health check failed: {e}")
            return False
        
        return True


# Job handler for scheduler
def eta_prediction_job_handler():
    """Handler function for scheduler"""
    job = ETAPredictionJob()
    job.run()


if __name__ == "__main__":
    # Test job
    import logging
    logging.basicConfig(level=logging.INFO)
    
    job = ETAPredictionJob()
    
    # Health check
    if job.health_check():
        print("✅ Job is healthy, running test...")
        job.run()
    else:
        print("❌ Job health check failed")