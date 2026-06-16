"""
ETA Prediction Job
==================
Background job to predict ETA for active trips.

Route distance, duration, and geometry are managed entirely by the backend
(via OSRM calls in RefreshRouteFromCurrentPositionAsync / PlanTripAsync).
The ML service reads those pre-computed values from the DB — no direct OSRM
calls needed here.
"""

from datetime import datetime
import pytz
import logging

from db.database import get_db
from db.models import Trip, EtaPrediction, get_pending_trips, create_eta_prediction
from ml_core.eta_predictor import ETAPredictor
# from utils.osrm_client import OSRMClient  # Not used: routes are managed by the backend
from config.settings import TIMEZONE, ETA_BATCH_SIZE

logger = logging.getLogger(__name__)


class ETAPredictionJob:
    """Background job for ETA predictions"""

    def __init__(self):
        """Initialize job with ML predictor"""
        self.predictor = ETAPredictor()
        # self.osrm = OSRMClient()  # Not used: distance/duration come from the DB
        self.tz = pytz.timezone(TIMEZONE)
        self.batch_size = ETA_BATCH_SIZE

        logger.info("✅ ETA Prediction Job initialized")

    def run(self):
        """
        Main job execution: process driver_approve and ongoing trips.
        """
        try:
            with get_db() as session:
                pending_trips = get_pending_trips(session)

                if len(pending_trips) == 0:
                    logger.debug("No trips to process")
                    return

                logger.info(f"Processing {len(pending_trips)} trips")

                success_count = 0
                error_count = 0

                for trip in pending_trips[:self.batch_size]:
                    try:
                        self._process_trip(session, trip)
                        success_count += 1
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Failed to process trip {trip.id}: {e}")
                        session.rollback()

                logger.info(f"✅ Batch complete: {success_count} successful, {error_count} errors")

        except Exception as e:
            logger.error(f"❌ ETA Prediction Job failed: {e}")

    def _process_trip(self, session, trip):
        """
        Process a single trip:

        Current position — resolved in priority order:
          1. First point of route_geometry  (most accurate; backend updates it every 30 s
             by re-routing from the vehicle's live GPS position via OSRM)
          2. Latest GPS record for the trip (fallback)
          3. trip.start_location            (last resort for pre-start driver_approve trips)

        Distance / duration come straight from the trip record — the backend
        already stores the remaining OSRM values there whenever it refreshes
        the route geometry.  No second OSRM call is made here.
        """
        from geoalchemy2.shape import to_shape
        from geoalchemy2.elements import WKTElement
        from db.models import GpsData

        # ── Destination ──────────────────────────────────────────────────────
        if not trip.end_location:
            raise ValueError(f"Trip {trip.id} missing end_location")

        end_point = to_shape(trip.end_location)
        end_lon = end_point.x
        end_lat = end_point.y

        # ── Current position resolution ──────────────────────────────────────
        current_lat = None
        current_lon = None
        current_location_geom = None
        location_source = None

        # Priority 1: first point of route_geometry
        # The backend rewrites this linestring every 30 s from the vehicle's
        # live position, so its first coordinate is always the current location.
        if trip.route_geometry is not None:
            try:
                route_shape = to_shape(trip.route_geometry)
                first_coord = list(route_shape.coords)[0]  # (lon, lat)
                current_lon = first_coord[0]
                current_lat = first_coord[1]
                current_location_geom = WKTElement(
                    f'POINT({current_lon} {current_lat})', srid=4326
                )
                location_source = "route_geometry"
            except Exception as e:
                logger.warning(f"Trip {trip.id}: could not read route_geometry first point: {e}")

        # Priority 2: latest GPS record
        if current_lat is None:
            latest_gps = (
                session.query(GpsData)
                .filter(GpsData.trip_id == trip.id)
                .order_by(GpsData.gps_timestamp.desc())
                .first()
            )
            if latest_gps and latest_gps.latitude and latest_gps.longitude:
                current_lon = latest_gps.longitude
                current_lat = latest_gps.latitude
                current_location_geom = WKTElement(
                    f'POINT({current_lon} {current_lat})', srid=4326
                )
                location_source = "GPS"

        # Priority 3: static start_location
        if current_lat is None:
            if not trip.start_location:
                raise ValueError(f"Trip {trip.id} has no start_location or GPS data")
            start_point = to_shape(trip.start_location)
            current_lon = start_point.x
            current_lat = start_point.y
            current_location_geom = trip.start_location
            location_source = "start_location"

        logger.debug(
            f"Trip {trip.id} [{location_source}]: "
            f"Current ({current_lat:.4f}, {current_lon:.4f}) "
            f"→ Destination ({end_lat:.4f}, {end_lon:.4f})"
        )

        # ── Distance / duration from DB ───────────────────────────────────────
        # These are maintained by the backend's route-refresh logic and always
        # reflect the remaining leg of the journey — no OSRM call needed.
        if trip.total_distance_km is None or trip.duration_seconds is None:
            raise ValueError(
                f"Trip {trip.id} is missing total_distance_km or duration_seconds. "
                "These should be set by the backend when the route is planned or refreshed."
            )

        distance_km = float(trip.total_distance_km)
        duration_sec = float(trip.duration_seconds)

        # ── ETA prediction ───────────────────────────────────────────────────
        timestamp = datetime.now(self.tz)

        prediction = self.predictor.predict(
            distance_km=distance_km,
            osrm_duration_sec=duration_sec,
            timestamp=timestamp
        )

        prediction['distance_km'] = distance_km
        prediction['osrm_duration_sec'] = duration_sec

        # ── Persist ──────────────────────────────────────────────────────────
        eta_record = create_eta_prediction(
            session=session,
            trip_id=trip.id,
            start_location=current_location_geom,
            end_location=trip.end_location,
            prediction_data=prediction
        )

        logger.info(
            f"✅ Trip {trip.id} [{location_source}]: "
            f"ETA={prediction['eta_minutes']:.1f}min, "
            f"Distance={distance_km:.2f}km, "
            f"Speed={prediction['traffic_info']['avg_speed_kmh']:.1f}km/h"
        )

        return eta_record

    def health_check(self):
        """Check if job dependencies are healthy"""

        # OSRM health check removed — the ML service no longer calls OSRM directly.
        # Route data comes from the backend which manages its own OSRM connection.
        # if not self.osrm.health_check():
        #     logger.error("❌ OSRM service is not available")
        #     return False

        try:
            self.predictor.predict(
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
    import logging
    logging.basicConfig(level=logging.INFO)

    job = ETAPredictionJob()

    if job.health_check():
        print("✅ Job is healthy, running test...")
        job.run()
    else:
        print("❌ Job health check failed")
