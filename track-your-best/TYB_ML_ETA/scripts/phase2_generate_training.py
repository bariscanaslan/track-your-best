"""
PHASE 2: GENERATE ML TRAINING DATA
===================================
İstanbul POI'ları arasında OSRM route'lar oluşturur ve İBB traffic patterns ile birleştirir.

Input:  data/processed/ibb_traffic_patterns_2024_2025.csv
Output: data/processed/istanbul_eta_training.csv
"""

import pandas as pd
import numpy as np
import requests
import time
from datetime import datetime, timedelta
from tqdm import tqdm
import os

def generate_training_data(
    patterns_csv='data/processed/ibb_traffic_patterns_2024_2025.csv',
    num_samples=2000,
    output_csv='data/processed/istanbul_eta_training.csv'
):
    print("=" * 80)
    print("PHASE 2: GENERATE ML TRAINING DATA")
    print("=" * 80)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Create output directory if it doesn't exist
    os.makedirs('data/processed', exist_ok=True)
    
    # Load İBB patterns
    print(f"\n📂 Loading İBB traffic patterns...")
    try:
        patterns = pd.read_csv(patterns_csv)
        print(f"✓ Loaded {len(patterns)} patterns")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print(f"   Lütfen önce 'python scripts/phase1_ibb_aggregation.py' çalıştırın!")
        return None
    
    # İstanbul POI locations
    locations = [
        ("Kadıköy", 40.9900, 29.0250),
        ("Beşiktaş", 41.0420, 29.0080),
        ("Taksim", 41.0370, 28.9850),
        ("Üsküdar", 41.0230, 29.0150),
        ("Levent", 41.0810, 28.9940),
        ("Sarıyer", 41.1670, 29.0530),
        ("Bakırköy", 40.9800, 28.8700),
        ("Ataşehir", 40.9827, 29.1256),
        ("Maslak", 41.1070, 28.9940),
        ("Bostancı", 40.9650, 29.0880),
        ("Pendik", 40.8780, 29.2360),
        ("Kartal", 40.9068, 29.1826),
        ("Şişli", 41.0602, 28.9887),
        ("Fatih", 41.0186, 28.9497),
        ("Beyoğlu", 41.0341, 28.9770),
    ]
    
    print(f"\n📍 İstanbul POI'ları: {len(locations)}")
    for i, (name, lat, lon) in enumerate(locations, 1):
        print(f"   {i}. {name} ({lat}, {lon})")
    
    # Generate training samples
    print(f"\n🔄 Generating {num_samples} training samples...")
    print(f"   OSRM Server: http://localhost:5000")
    
    training_data = []
    failed_requests = 0
    skipped_same_location = 0
    
    # Progress bar
    pbar = tqdm(total=num_samples, desc="Generating routes", unit="sample")
    
    while len(training_data) < num_samples:
        # Random route
        start_idx = np.random.randint(0, len(locations))
        end_idx = np.random.randint(0, len(locations))
        
        # Skip same location
        if start_idx == end_idx:
            skipped_same_location += 1
            continue
        
        start = locations[start_idx]
        end = locations[end_idx]
        
        # Random datetime in 2024
        random_date = datetime(2024, 1, 1) + timedelta(
            days=np.random.randint(0, 365),
            hours=np.random.randint(0, 24)
        )
        hour = random_date.hour
        day_of_week = random_date.weekday()
        
        # OSRM route request
        try:
            url = f"http://localhost:5000/route/v1/driving/{start[2]},{start[1]};{end[2]},{end[1]}"
            params = {
                'overview': 'false',
                'steps': 'false'
            }
            
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code != 200:
                failed_requests += 1
                continue
            
            route_data = response.json()
            
            if 'routes' not in route_data or len(route_data['routes']) == 0:
                failed_requests += 1
                continue
            
            route = route_data['routes'][0]
            distance_km = route['distance'] / 1000  # meters to km
            osrm_duration_sec = route['duration']  # seconds
            
        except Exception as e:
            failed_requests += 1
            continue
        
        # Get İBB traffic pattern
        pattern_match = patterns[
            (patterns['hour'] == hour) &
            (patterns['day_of_week'] == day_of_week)
        ]
        
        if len(pattern_match) == 0:
            # Fallback to average
            avg_speed = 65
            traffic_density = 50
            speed_factor = 0.93
        else:
            pattern = pattern_match.iloc[0]
            avg_speed = pattern['avg_speed_mean']
            traffic_density = pattern['traffic_density']
            speed_factor = pattern['speed_factor']
        
        # Calculate traffic-adjusted duration
        # Base: OSRM gives ideal duration
        # Adjust: Apply İBB speed_factor
        actual_duration_sec = osrm_duration_sec / speed_factor
        
        # Calculate average speeds
        base_avg_speed = (distance_km / (osrm_duration_sec / 3600)) if osrm_duration_sec > 0 else 0
        traffic_avg_speed = (distance_km / (actual_duration_sec / 3600)) if actual_duration_sec > 0 else 0
        
        # Features
        is_weekend = 1 if day_of_week >= 5 else 0
        is_rush_hour = 1 if hour in [7, 8, 9, 16, 17, 18, 19] else 0
        
        # Append
        training_data.append({
            'start_location': start[0],
            'end_location': end[0],
            'start_lat': start[1],
            'start_lon': start[2],
            'end_lat': end[1],
            'end_lon': end[2],
            'distance_km': round(distance_km, 2),
            'osrm_duration_sec': int(osrm_duration_sec),
            'actual_duration_sec': int(actual_duration_sec),
            'duration_min': round(actual_duration_sec / 60, 2),  # TARGET
            'hour': hour,
            'day_of_week': day_of_week,
            'is_weekend': is_weekend,
            'is_rush_hour': is_rush_hour,
            'ibb_avg_speed': round(avg_speed, 1),
            'ibb_traffic_density': round(traffic_density, 1),
            'ibb_speed_factor': round(speed_factor, 3),
            'osrm_avg_speed': round(base_avg_speed, 1),
            'traffic_avg_speed': round(traffic_avg_speed, 1),
            'timestamp': random_date.strftime('%Y-%m-%d %H:%M:%S')
        })
        
        pbar.update(1)
        
        # Rate limiting
        time.sleep(0.01)
    
    pbar.close()
    
    # Create DataFrame
    df = pd.DataFrame(training_data)
    
    # Save
    df.to_csv(output_csv, index=False)
    
    # Statistics
    print("\n" + "=" * 80)
    print("✓ PHASE 2 COMPLETED!")
    print("=" * 80)
    print(f"\n📊 TRAINING DATA STATISTICS:")
    print(f"   • Total samples: {len(df)}")
    print(f"   • Failed OSRM requests: {failed_requests}")
    print(f"   • Skipped (same location): {skipped_same_location}")
    
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
    print(f"   • Weekend samples: {df['is_weekend'].sum()} ({100*df['is_weekend'].mean():.1f}%)")
    print(f"   • Rush hour samples: {df['is_rush_hour'].sum()} ({100*df['is_rush_hour'].mean():.1f}%)")
    
    # Hour distribution
    print(f"\n🕐 HOUR DISTRIBUTION:")
    hour_dist = df['hour'].value_counts().sort_index()
    for hour, count in hour_dist.items():
        print(f"   {hour:02d}:00 → {count} samples")
    
    print(f"\n💾 Output file: {output_csv}")
    print(f"   Columns: {list(df.columns)}")
    print("=" * 80)
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    return df

if __name__ == "__main__":
    df = generate_training_data(
        patterns_csv='data/processed/ibb_traffic_patterns_2024_2025.csv',
        num_samples=2000,
        output_csv='data/processed/istanbul_eta_training.csv'
    )
    
    if df is not None:
        print("\n✅ SUCCESS! Phase 2 tamamlandı.")
        print("\n🔜 NEXT STEP: Phase 3 - Train ML model")
        print("   Komut: python scripts/phase3_train_model.py")
    else:
        print("\n❌ FAILED! Lütfen hataları kontrol edin.")