"""
ETA Predictor
=============
Machine Learning model for ETA prediction using Istanbul traffic patterns
"""

import joblib
import pandas as pd
from datetime import datetime, timedelta
import pytz
import logging

from config.settings import MODELS, ETA_TRAFFIC_PATTERNS, TIMEZONE

logger = logging.getLogger(__name__)


class ETAPredictor:
    """ETA Prediction using trained ML model"""
    
    def __init__(self):
        """Initialize predictor with model and traffic patterns"""
        
        # Load ML model
        try:
            model_path = MODELS['eta_model']
            self.model_data = joblib.load(model_path)
            self.model = self.model_data['model']
            self.features = self.model_data['features']
            
            logger.info(f"✅ ETA Model loaded: {model_path}")
            logger.info(f"   Test MAE: {self.model_data.get('test_mae', 'N/A'):.2f} minutes")
            logger.info(f"   Test R²: {self.model_data.get('test_r2', 'N/A'):.4f}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load ETA model: {e}")
            raise
        
        # Load traffic patterns
        try:
            self.traffic_patterns = pd.read_csv(ETA_TRAFFIC_PATTERNS)
            logger.info(f"✅ Traffic patterns loaded: {len(self.traffic_patterns)} patterns")
            
        except Exception as e:
            logger.error(f"❌ Failed to load traffic patterns: {e}")
            raise
        
        # Timezone
        self.tz = pytz.timezone(TIMEZONE)
    
    def _get_traffic_pattern(self, hour, day_of_week):
        """
        Get traffic pattern for given hour and day of week
        
        Args:
            hour: Hour of day (0-23)
            day_of_week: Day of week (0=Monday, 6=Sunday)
        
        Returns:
            dict: Traffic pattern data
        """
        pattern = self.traffic_patterns[
            (self.traffic_patterns['hour'] == hour) &
            (self.traffic_patterns['day_of_week'] == day_of_week)
        ]
        
        if len(pattern) == 0:
            # Fallback to average
            logger.warning(f"No traffic pattern for hour={hour}, day={day_of_week}, using fallback")
            return {
                'avg_speed': 50.0,
                'traffic_density': 50.0,
                'speed_factor': 0.7
            }
        
        p = pattern.iloc[0]
        return {
            'avg_speed': float(p['avg_speed_kmh']),
            'traffic_density': float(p['traffic_density']),
            'speed_factor': float(p['speed_factor'])
        }
    
    def predict(self, distance_km, osrm_duration_sec, timestamp=None):
        """
        Predict ETA for a trip
        
        Args:
            distance_km: Trip distance in kilometers
            osrm_duration_sec: OSRM route duration in seconds
            timestamp: Prediction timestamp (default: now in Istanbul timezone)
        
        Returns:
            dict: Prediction results with ETA, traffic info, and model metadata
        """
        try:
            # Use Istanbul timezone
            if timestamp is None:
                timestamp = datetime.now(self.tz)
            elif timestamp.tzinfo is None:
                # Make timezone-aware if naive
                timestamp = self.tz.localize(timestamp)
            else:
                # Convert to Istanbul timezone
                timestamp = timestamp.astimezone(self.tz)
            
            # Extract time features
            hour = timestamp.hour
            day_of_week = timestamp.weekday()  # 0=Monday, 6=Sunday
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Rush hour definition (Istanbul traffic pattern)
            is_rush_hour = 1 if hour in [7, 8, 9, 16, 17, 18, 19, 20, 21] else 0
            
            # Get traffic pattern
            traffic_info = self._get_traffic_pattern(hour, day_of_week)
            
            # Prepare features for model
            input_features = pd.DataFrame([{
                'distance_km': distance_km,
                'hour': hour,
                'day_of_week': day_of_week,
                'is_weekend': is_weekend,
                'is_rush_hour': is_rush_hour,
                'ibb_avg_speed': traffic_info['avg_speed'],
                'ibb_traffic_density': traffic_info['traffic_density'],
                'ibb_speed_factor': traffic_info['speed_factor'],
                'osrm_duration_sec': osrm_duration_sec
            }])
            
            # Predict
            eta_minutes = self.model.predict(input_features)[0]
            
            # Calculate derived values
            eta_seconds = int(eta_minutes * 60)
            eta_hours = int(eta_seconds // 3600)
            eta_minutes_remaining = int((eta_seconds % 3600) // 60)
            
            # Format ETA
            if eta_hours > 0:
                eta_formatted = f"{eta_hours}h {eta_minutes_remaining}min"
            else:
                eta_formatted = f"{eta_minutes_remaining}min"
            
            # Predicted arrival time
            predicted_arrival = timestamp + timedelta(seconds=eta_seconds)
            
            # Build response
            result = {
                'eta_minutes': round(eta_minutes, 2),
                'eta_seconds': eta_seconds,
                'eta_hours': eta_hours,
                'eta_minutes_display': eta_minutes_remaining,
                'eta_formatted': eta_formatted,
                'predicted_arrival_time': predicted_arrival,
                'prediction_timestamp': timestamp,
                'confidence': round(self.model_data.get('test_r2', 0.99), 3),
                'traffic_info': {
                    'hour': hour,
                    'day_of_week': day_of_week,
                    'is_weekend': bool(is_weekend),
                    'is_rush_hour': bool(is_rush_hour),
                    'avg_speed_kmh': round(traffic_info['avg_speed'], 1),
                    'traffic_density': round(traffic_info['traffic_density'], 1),
                    'speed_factor': round(traffic_info['speed_factor'], 3)
                },
                'model_info': {
                    'test_mae': round(self.model_data.get('test_mae', 0), 2),
                    'test_r2': round(self.model_data.get('test_r2', 0), 4),
                    'training_date': self.model_data.get('training_date', 'unknown')
                }
            }
            
            logger.debug(f"ETA prediction: {eta_minutes:.1f} min (distance: {distance_km:.2f} km, hour: {hour})")
            
            return result
            
        except Exception as e:
            logger.error(f"ETA prediction failed: {e}")
            raise
    
    def batch_predict(self, trips):
        """
        Predict ETA for multiple trips
        
        Args:
            trips: List of dicts with keys: distance_km, osrm_duration_sec, timestamp
        
        Returns:
            list: List of prediction results
        """
        results = []
        
        for trip in trips:
            try:
                result = self.predict(
                    distance_km=trip['distance_km'],
                    osrm_duration_sec=trip['osrm_duration_sec'],
                    timestamp=trip.get('timestamp')
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Batch prediction failed for trip: {e}")
                results.append(None)
        
        return results


if __name__ == "__main__":
    # Test predictor
    from datetime import datetime
    import logging
    logging.basicConfig(level=logging.INFO)
    
    predictor = ETAPredictor()
    
    # Test prediction
    result = predictor.predict(
        distance_km=35.48,
        osrm_duration_sec=2400,
        timestamp=datetime(2026, 3, 11, 18, 30)  # 18:30 on Tuesday (rush hour)
    )
    
    print(f"\n📊 ETA PREDICTION TEST:")
    print(f"   ETA: {result['eta_formatted']}")
    print(f"   Confidence: {result['confidence']*100:.1f}%")
    print(f"   Traffic: {result['traffic_info']['avg_speed_kmh']} km/h (rush: {result['traffic_info']['is_rush_hour']})")
    print(f"   Arrival: {result['predicted_arrival_time']}")