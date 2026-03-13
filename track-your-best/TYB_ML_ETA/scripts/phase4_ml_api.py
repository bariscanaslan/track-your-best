"""
PHASE 4: FLASK ML API FOR ETA PREDICTION
=========================================
REST API for Istanbul ETA prediction using trained model

Endpoints:
  GET  /health        - Health check
  POST /predict_eta   - ETA prediction
  POST /batch_predict - Batch ETA prediction
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Load model - ABSOLUTE PATHS
import sys

# Get script directory and project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR) if 'scripts' in SCRIPT_DIR else SCRIPT_DIR

MODEL_PATH = os.path.join(PROJECT_ROOT, 'models', 'eta_model_istanbul.pkl')
PATTERNS_PATH = os.path.join(PROJECT_ROOT, 'data', 'processed', 'ibb_traffic_patterns_2024_2025.csv')

print("=" * 80)
print("LOADING ML MODEL...")
print("=" * 80)

try:
    model_data = joblib.load(MODEL_PATH)
    model = model_data['model']
    features = model_data['features']
    print(f"✓ Model loaded: {MODEL_PATH}")
    print(f"  • Features: {len(features)}")
    print(f"  • Test MAE: {model_data['test_mae']:.2f} minutes")
    print(f"  • Test R²: {model_data['test_r2']:.4f}")
    print(f"  • Trained: {model_data.get('training_date', 'unknown')}")
except Exception as e:
    print(f"❌ ERROR loading model: {e}")
    model = None
    features = None

# Load traffic patterns
try:
    traffic_patterns = pd.read_csv(PATTERNS_PATH)
    print(f"✓ Traffic patterns loaded: {len(traffic_patterns)} patterns")
except Exception as e:
    print(f"⚠️  Warning: Could not load traffic patterns: {e}")
    traffic_patterns = None

print("=" * 80)

def get_traffic_pattern(hour, day_of_week):
    """Get İBB traffic pattern for given hour and day_of_week"""
    if traffic_patterns is None:
        # Fallback defaults
        return {
            'avg_speed': 65,
            'traffic_density': 50,
            'speed_factor': 0.93
        }
    
    pattern = traffic_patterns[
        (traffic_patterns['hour'] == hour) &
        (traffic_patterns['day_of_week'] == day_of_week)
    ]
    
    if len(pattern) == 0:
        # Fallback
        return {
            'avg_speed': 65,
            'traffic_density': 50,
            'speed_factor': 0.93
        }
    
    p = pattern.iloc[0]
    return {
        'avg_speed': float(p['avg_speed_kmh']),  # ✅ FIXED: Use avg_speed_kmh column!
        'traffic_density': float(p['traffic_density']),
        'speed_factor': float(p['speed_factor'])
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if model is not None else 'unhealthy',
        'model_loaded': model is not None,
        'traffic_patterns_loaded': traffic_patterns is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict_eta', methods=['POST'])
def predict_eta():
    """
    ETA Prediction Endpoint
    
    Request Body:
    {
        "distance_km": 15.5,
        "osrm_duration_sec": 1200,
        "timestamp": "2025-02-25 14:30:00"  (optional)
    }
    
    Response:
    {
        "eta_minutes": 18.5,
        "eta_seconds": 1110,
        "eta_hours": 0,
        "eta_minutes_display": 18,
        "confidence": 0.85,
        "traffic_info": {...}
    }
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        
        # Validate input
        if 'distance_km' not in data or 'osrm_duration_sec' not in data:
            return jsonify({
                'error': 'Missing required fields: distance_km, osrm_duration_sec'
            }), 400
        
        distance_km = float(data['distance_km'])
        osrm_duration_sec = int(data['osrm_duration_sec'])
        
        # Parse timestamp
        if 'timestamp' in data:
            try:
                ts = pd.to_datetime(data['timestamp'])
            except:
                ts = pd.Timestamp.now()
        else:
            ts = pd.Timestamp.now()
        
        hour = ts.hour
        day_of_week = ts.dayofweek
        is_weekend = 1 if day_of_week >= 5 else 0
        
        # CUSTOM RUSH HOUR CALCULATION - OPTIMIZED FOR ISTANBUL
        # Based on Google Maps validation and real testing
        # Peak rush: 8, 17, 18 (10th percentile)
        # Rush+Evening: 7, 9, 16, 19, 20, 21 (25th percentile)
        
        if is_weekend:
            # Weekend: No rush hour
            is_rush_hour = 0
        else:
            # Weekday: Custom rush hour pattern
            is_rush_hour = 1 if hour in [7, 8, 9, 16, 17, 18, 19, 20, 21] else 0
        
        # Get traffic pattern
        traffic_info = get_traffic_pattern(hour, day_of_week)
        
        # Prepare features
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
        eta_min = model.predict(input_features)[0]
        eta_sec = int(eta_min * 60)
        eta_hours = int(eta_sec // 3600)
        eta_minutes_remaining = int((eta_sec % 3600) // 60)
        
        # Response
        response = {
            'eta_minutes': round(eta_min, 2),
            'eta_seconds': eta_sec,
            'eta_hours': eta_hours,
            'eta_minutes_display': eta_minutes_remaining,
            'confidence': round(model_data['test_r2'], 3),
            'traffic_info': {
                'hour': hour,
                'day_of_week': day_of_week,
                'is_weekend': bool(is_weekend),
                'is_rush_hour': bool(is_rush_hour),
                'avg_speed_kmh': round(traffic_info['avg_speed'], 1),
                'traffic_density': round(traffic_info['traffic_density'], 1),
                'speed_factor': round(traffic_info['speed_factor'], 3)
            },
            'input': {
                'distance_km': distance_km,
                'osrm_duration_sec': osrm_duration_sec,
                'timestamp': ts.isoformat()
            },
            'model_info': {
                'mae_minutes': round(model_data['test_mae'], 2),
                'r2_score': round(model_data['test_r2'], 3)
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/batch_predict', methods=['POST'])
def batch_predict():
    """
    Batch ETA Prediction
    
    Request Body:
    {
        "predictions": [
            {"distance_km": 15.5, "osrm_duration_sec": 1200, "timestamp": "2025-02-25 14:30:00"},
            {"distance_km": 8.2, "osrm_duration_sec": 720}
        ]
    }
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        
        if 'predictions' not in data or not isinstance(data['predictions'], list):
            return jsonify({'error': 'Missing or invalid predictions array'}), 400
        
        results = []
        
        for item in data['predictions']:
            # Call predict_eta logic
            distance_km = float(item['distance_km'])
            osrm_duration_sec = int(item['osrm_duration_sec'])
            
            if 'timestamp' in item:
                try:
                    ts = pd.to_datetime(item['timestamp'])
                except:
                    ts = pd.Timestamp.now()
            else:
                ts = pd.Timestamp.now()
            
            hour = ts.hour
            day_of_week = ts.dayofweek
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # CUSTOM RUSH HOUR - ISTANBUL OPTIMIZED
            if is_weekend:
                is_rush_hour = 0
            else:
                is_rush_hour = 1 if hour in [7, 8, 9, 16, 17, 18, 19, 20, 21] else 0
            
            traffic_info = get_traffic_pattern(hour, day_of_week)
            
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
            
            eta_min = model.predict(input_features)[0]
            eta_sec = int(eta_min * 60)
            
            results.append({
                'eta_minutes': round(eta_min, 2),
                'eta_seconds': eta_sec,
                'distance_km': distance_km
            })
        
        return jsonify({
            'count': len(results),
            'predictions': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'service': 'Istanbul ETA Prediction API',
        'version': '1.0',
        'endpoints': {
            'health': 'GET /health',
            'predict': 'POST /predict_eta',
            'batch': 'POST /batch_predict'
        },
        'model_status': 'loaded' if model is not None else 'not loaded',
        'documentation': 'See phase4_ml_api.py for API details'
    })

if __name__ == '__main__':
    if model is None:
        print("\n❌ ERROR: Model not loaded!")
        print("   Lütfen önce 'python phase3_train_model.py' çalıştırın!")
        exit(1)
    
    print("\n" + "=" * 80)
    print("🚀 ISTANBUL ETA PREDICTION API")
    print("=" * 80)
    print(f"\n📊 Model Info:")
    print(f"   • Test MAE: {model_data['test_mae']:.2f} minutes")
    print(f"   • Test R²: {model_data['test_r2']:.4f}")
    print(f"   • Training samples: {model_data.get('training_samples', 'unknown')}")
    print(f"\n🌐 Server starting...")
    print(f"   • Host: 0.0.0.0")
    print(f"   • Port: 5001")
    print(f"\n📡 Endpoints:")
    print(f"   • GET  http://localhost:5001/health")
    print(f"   • POST http://localhost:5001/predict_eta")
    print(f"   • POST http://localhost:5001/batch_predict")
    print("\n" + "=" * 80)
    
    app.run(host='0.0.0.0', port=5001, debug=False)