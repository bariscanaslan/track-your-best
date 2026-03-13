"""
PHASE 2: GENERATE ML TRAINING DATA - EXTENDED RANGE (UP TO 100KM)
==================================================================
İstanbul POI'ları arasında 2000 rastgele rota oluşturur.
Her rota için OSRM'den gerçek mesafe/süre alır ve İBB traffic pattern'leri ile birleştirir.

EXTENDED RANGE: Max distance ~100km (added outer districts)
"""

import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
import random
from tqdm import tqdm
from pathlib import Path

# Config
PATTERNS_FILE = Path('data/processed/ibb_traffic_patterns_2024_2025.csv')
OUTPUT_FILE = Path('data/processed/istanbul_eta_training.csv')
OSRM_URL = "http://localhost:5000"
N_SAMPLES = 2000

# Istanbul POI coordinates (EXTENDED for 80-100km range!)
ISTANBUL_POIS = [
    # City center (existing)
    ("Kadıköy", 40.9900, 29.0250),
    ("Beşiktaş", 40.0420, 29.0080),
    ("Taksim", 41.0370, 28.9850),
    ("Üsküdar", 41.0230, 29.0150),
    ("Levent", 41.0810, 28.9940),
    ("Bakırköy", 40.9800, 28.8700),
    ("Ataşehir", 40.9827, 29.1256),
    ("Maslak", 41.1070, 28.9940),
    ("Bostancı", 40.9650, 29.0880),
    ("Kartal", 40.9068, 29.1826),
    ("Şişli", 41.0602, 28.9887),
    ("Fatih", 41.0186, 28.9497),
    ("Beyoğlu", 41.0341, 28.9770),
    
    # Medium range (25-50 km)
    ("Pendik", 40.8780, 29.2360),
    ("Sarıyer", 41.1670, 29.0530),
    ("Tuzla", 40.8225, 29.3004),
    ("Avcılar", 41.0260, 28.7210),
    ("Arnavutköy", 41.1890, 28.7540),
    
    # EXTENDED: Long range (50-100 km)
    ("Gebze", 40.8027, 29.4308),      # ~60km from center
    ("Silivri", 41.0736, 28.2458),    # ~65km from center
    ("Çatalca", 41.1420, 28.4614),    # ~55km from center
    ("Şile", 41.1764, 29.6122),       # ~70km from center
    
    # ADDED: Very long range (80-100km)
    ("Gebze OSB", 40.8200, 29.4800),  # ~65km (industrial)
    ("Çerkezköy", 41.2850, 28.0000),  # ~80km (Tekirdağ border)
    ("Çorlu", 41.1595, 27.8008),      # ~100km (extreme test)
]

def load_traffic_patterns():
    """İBB traffic pattern'lerini yükle"""
    try:
        patterns = pd.read_csv(PATTERNS_FILE)
        return patterns
    except Exception as e:
        print(f"❌ ERROR loading traffic patterns: {e}")
        return None

def get_osrm_route(start_lat, start_lon, end_lat, end_lon):
    """OSRM'den rota bilgisi al"""
    try:
        url = f"{OSRM_URL}/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        
        if data['code'] != 'Ok' or not data['routes']:
            return None
        
        route = data['routes'][0]
        return {
            'distance_m': route['distance'],
            'duration_sec': route['duration']
        }
    except Exception as e:
        return None

def get_traffic_info(hour, day_of_week, patterns_df):
    """Belirli saat/gün için traffic bilgisi al"""
    pattern = patterns_df[
        (patterns_df['hour'] == hour) &
        (patterns_df['day_of_week'] == day_of_week)
    ]
    
    if len(pattern) == 0:
        # Fallback
        return {
            'ibb_avg_speed': 65.0,
            'ibb_traffic_density': 50.0,
            'ibb_speed_factor': 0.93
        }
    
    p = pattern.iloc[0]
    return {
        'ibb_avg_speed': float(p['avg_speed_kmh']),
        'ibb_traffic_density': float(p['traffic_density']),
        'ibb_speed_factor': float(p['speed_factor'])
    }

def generate_training_data():
    """Training data oluştur"""
    
    print("=" * 80)
    print("PHASE 2: GENERATE ML TRAINING DATA - EXTENDED RANGE")
    print("=" * 80)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Load traffic patterns
    print(f"📂 Loading İBB traffic patterns...")
    patterns = load_traffic_patterns()
    
    if patterns is None:
        print("\n❌ ERROR: Could not load traffic patterns!")
        print("   Please run: python scripts/phase1_ibb_aggregation.py")
        return None
    
    print(f"✓ Loaded {len(patterns)} patterns")
    
    # Show POIs
    print(f"\n📍 İstanbul POI'ları: {len(ISTANBUL_POIS)}")
    for i, (name, lat, lon) in enumerate(ISTANBUL_POIS, 1):
        print(f"   {i}. {name} ({lat}, {lon})")
    
    print(f"\n🔄 Generating {N_SAMPLES} training samples...")
    print(f"   OSRM Server: {OSRM_URL}")
    
    # Generate samples
    samples = []
    failed_osrm = 0
    skipped_same = 0
    
    # Random seed for reproducibility
    random.seed(42)
    np.random.seed(42)
    
    # Date range: 2024-01-01 to 2025-01-31
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2025, 1, 31)
    date_range_days = (end_date - start_date).days
    
    for i in tqdm(range(N_SAMPLES), desc="Generating routes"):
        # Random start and end POIs
        start_poi = random.choice(ISTANBUL_POIS)
        end_poi = random.choice(ISTANBUL_POIS)
        
        # Skip if same location
        if start_poi == end_poi:
            skipped_same += 1
            continue
        
        start_name, start_lat, start_lon = start_poi
        end_name, end_lat, end_lon = end_poi
        
        # Random timestamp
        random_days = random.randint(0, date_range_days)
        random_hour = random.randint(0, 23)
        timestamp = start_date + timedelta(days=random_days, hours=random_hour)
        
        hour = timestamp.hour
        day_of_week = timestamp.weekday()  # 0=Monday, 6=Sunday
        is_weekend = 1 if day_of_week >= 5 else 0
        is_rush_hour = 1 if (day_of_week < 5 and hour in [7, 8, 9, 16, 17, 18, 19]) else 0
        
        # Get OSRM route
        osrm_result = get_osrm_route(start_lat, start_lon, end_lat, end_lon)
        
        if osrm_result is None:
            failed_osrm += 1
            continue
        
        distance_km = osrm_result['distance_m'] / 1000.0
        osrm_duration_sec = osrm_result['duration_sec']
        osrm_avg_speed = (distance_km / (osrm_duration_sec / 3600.0)) if osrm_duration_sec > 0 else 0
        
        # Get traffic info
        traffic_info = get_traffic_info(hour, day_of_week, patterns)
        
        # Calculate actual duration with traffic
        # OSRM gives base time, we adjust with traffic factor
        traffic_avg_speed = traffic_info['ibb_avg_speed']
        
        # Weighted average: 60% traffic, 40% OSRM
        effective_speed = 0.6 * traffic_avg_speed + 0.4 * osrm_avg_speed
        actual_duration_sec = int((distance_km / effective_speed) * 3600) if effective_speed > 0 else osrm_duration_sec
        duration_min = actual_duration_sec / 60.0
        
        # Create sample
        sample = {
            'start_location': start_name,
            'end_location': end_name,
            'start_lat': start_lat,
            'start_lon': start_lon,
            'end_lat': end_lat,
            'end_lon': end_lon,
            'distance_km': round(distance_km, 2),
            'osrm_duration_sec': osrm_duration_sec,
            'actual_duration_sec': actual_duration_sec,
            'duration_min': round(duration_min, 2),
            'hour': hour,
            'day_of_week': day_of_week,
            'is_weekend': is_weekend,
            'is_rush_hour': is_rush_hour,
            'ibb_avg_speed': round(traffic_info['ibb_avg_speed'], 1),
            'ibb_traffic_density': round(traffic_info['ibb_traffic_density'], 1),
            'ibb_speed_factor': round(traffic_info['ibb_speed_factor'], 3),
            'osrm_avg_speed': round(osrm_avg_speed, 1),
            'traffic_avg_speed': round(effective_speed, 1),
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        samples.append(sample)
    
    if not samples:
        print("\n❌ ERROR: No samples generated!")
        return None
    
    # Create DataFrame
    df = pd.DataFrame(samples)
    
    # Save to CSV
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)
    
    # Print stats
    print("\n" + "=" * 80)
    print("✓ PHASE 2 COMPLETED!")
    print("=" * 80)
    
    print(f"\n📊 TRAINING DATA STATISTICS:")
    print(f"   • Total samples: {len(df)}")
    print(f"   • Failed OSRM requests: {failed_osrm}")
    print(f"   • Skipped (same location): {skipped_same}")
    
    print(f"\n🚗 DISTANCE STATISTICS:")
    print(f"   • Mean: {df['distance_km'].mean():.2f} km")
    print(f"   • Median: {df['distance_km'].median():.2f} km")
    print(f"   • Min: {df['distance_km'].min():.2f} km")
    print(f"   • Max: {df['distance_km'].max():.2f} km")
    
    print(f"\n⏱️  DURATION STATISTICS (TARGET):")
    print(f"   • Mean: {df['duration_min'].mean():.2f} minutes")
    print(f"   • Median: {df['duration_min'].median():.2f} minutes")
    print(f"   • Min: {df['duration_min'].min():.2f} minutes")
    print(f"   • Max: {df['duration_min'].max():.2f} minutes")
    
    print(f"\n🚦 SPEED STATISTICS:")
    print(f"   • İBB avg speed: {df['ibb_avg_speed'].mean():.1f} km/h")
    print(f"   • OSRM avg speed: {df['osrm_avg_speed'].mean():.1f} km/h")
    print(f"   • Traffic avg speed: {df['traffic_avg_speed'].mean():.1f} km/h")
    
    print(f"\n📈 TEMPORAL DISTRIBUTION:")
    print(f"   • Weekend samples: {df['is_weekend'].sum()} ({df['is_weekend'].mean()*100:.1f}%)")
    print(f"   • Rush hour samples: {df['is_rush_hour'].sum()} ({df['is_rush_hour'].mean()*100:.1f}%)")
    
    # Hour distribution
    print(f"\n🕐 HOUR DISTRIBUTION:")
    hour_dist = df['hour'].value_counts().sort_index()
    for hour in range(24):
        count = hour_dist.get(hour, 0)
        print(f"   {hour:02d}:00 → {count} samples")
    
    print(f"\n💾 Output file: {OUTPUT_FILE}")
    print(f"   Columns: {list(df.columns)}")
    print("=" * 80)
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    return df

if __name__ == "__main__":
    df = generate_training_data()
    
    if df is not None:
        print("\n✅ SUCCESS! Phase 2 tamamlandı.")
        print("\n🔜 NEXT STEP: Phase 3 - Train ML model")
        print("   Komut: python scripts/phase3_train_model.py")