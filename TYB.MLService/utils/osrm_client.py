"""
OSRM Client
===========
Client for OpenStreetMap Routing Machine (OSRM)
"""

import requests
import logging
from config.settings import OSRM_BASE_URL

logger = logging.getLogger(__name__)


class OSRMClient:
    """Client for OSRM routing service"""
    
    def __init__(self, base_url=None):
        self.base_url = base_url or OSRM_BASE_URL
        logger.info(f"OSRM Client initialized with base URL: {self.base_url}")
    
    def get_route(self, start_lon, start_lat, end_lon, end_lat):
        """
        Get route between two points
        
        Args:
            start_lon: Start longitude
            start_lat: Start latitude
            end_lon: End longitude
            end_lat: End latitude
        
        Returns:
            dict: {
                'distance_km': float,
                'duration_sec': int
            }
        
        Raises:
            Exception: If OSRM request fails
        """
        try:
            # Build URL
            coords = f"{start_lon},{start_lat};{end_lon},{end_lat}"
            url = f"{self.base_url}/route/v1/driving/{coords}"
            
            # Parameters
            params = {
                "overview": "false",  # We don't need full geometry
                "steps": "false"
            }
            
            # Make request
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            # Parse response
            data = response.json()
            
            if data.get('code') != 'Ok':
                raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
            
            # Extract route info
            route = data['routes'][0]
            
            result = {
                'distance_km': route['distance'] / 1000.0,  # meters to km
                'duration_sec': int(route['duration'])  # seconds
            }
            
            logger.debug(f"OSRM route: {result['distance_km']:.2f} km, {result['duration_sec']} sec")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OSRM request failed: {e}")
            raise Exception(f"OSRM service unavailable: {e}")
        except Exception as e:
            logger.error(f"OSRM error: {e}")
            raise
    
    def health_check(self):
        """
        Check if OSRM service is available
        
        Returns:
            bool: True if service is up, False otherwise
        """
        try:
            # Simple test route (Istanbul center to Taksim)
            result = self.get_route(
                start_lon=28.9784,
                start_lat=41.0082,
                end_lon=28.9870,
                end_lat=41.0370
            )
            logger.info("✅ OSRM service is healthy")
            return True
        except Exception as e:
            logger.error(f"❌ OSRM health check failed: {e}")
            return False


if __name__ == "__main__":
    # Test OSRM client
    import logging
    logging.basicConfig(level=logging.INFO)
    
    client = OSRMClient()
    
    # Health check
    if client.health_check():
        # Test route: Kadıköy to Beşiktaş
        route = client.get_route(
            start_lon=29.0250,
            start_lat=40.9900,
            end_lon=29.0080,
            end_lat=41.0420
        )
        print(f"Route: {route['distance_km']:.2f} km, {route['duration_sec']} seconds")