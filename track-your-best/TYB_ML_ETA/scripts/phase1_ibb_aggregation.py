"""
PHASE 1: İBB TRAFFIC AGGREGATION - MANUAL TARGET SPEEDS
=========================================================
Target specific speeds for each hour by finding closest percentile!

APPROACH:
- Define target speed for each hour (e.g., 21:00 → 45 km/h)
- Find which percentile in IBB data is closest to target
- Use that percentile!
- NO calculation, just smart selection!
"""

import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

# Constants
DATA_DIR = Path('data/raw')
OUTPUT_DIR = Path('data/processed')
IDEAL_SPEED_KMH = 70.0

# MANUAL TARGET SPEEDS (your desired speeds!)
TARGET_SPEEDS = {
    0: 60,   # 00:00
    1: 60,   # 01:00
    2: 61,   # 02:00
    3: 62,   # 03:00
    4: 62,   # 04:00
    5: 58,   # 05:00
    6: 50,   # 06:00
    7: 32,   # 07:00 🔴
    8: 24,   # 08:00 🔴
    9: 27,   # 09:00 🔴
    10: 40,  # 10:00
    11: 42,  # 11:00
    12: 41,  # 12:00
    13: 40,  # 13:00
    14: 39,  # 14:00
    15: 32,  # 15:00
    16: 28,  # 16:00 🔴
    17: 23,  # 17:00 🔴
    18: 18,  # 18:00 🔴🔴 (peak)
    19: 25,  # 19:00 🔴
    20: 38,  # 20:00
    21: 42,  # 21:00
    22: 45,  # 22:00
    23: 45,  # 23:00
}

def find_closest_percentile(speeds, target):
    """
    Find which percentile is closest to target speed
    Returns the percentile value (not the percentile number!)
    """
    # Try percentiles from 1 to 99
    best_percentile = None
    best_diff = float('inf')
    best_value = None
    
    for p in range(1, 100):
        value = np.percentile(speeds, p)
        diff = abs(value - target)
        
        if diff < best_diff:
            best_diff = diff
            best_percentile = p
            best_value = value
    
    return best_value, best_percentile

def aggregate_ibb_traffic():
    """İBB CSV'lerini aggregate et - MANUAL TARGET SPEEDS!"""
    
    print("=" * 80)
    print("PHASE 1: İBB AGGREGATION - MANUAL TARGET SPEEDS")
    print("=" * 80)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Find all CSV files
    csv_files = sorted(DATA_DIR.glob('traffic_density_*.csv'))
    
    if not csv_files:
        print(f"❌ ERROR: No CSV files found in {DATA_DIR}")
        return None
    
    print(f"📂 Found CSV Files: {len(csv_files)}")
    
    # Load all CSVs
    all_data = []
    for i, csv_file in enumerate(csv_files, 1):
        try:
            df = pd.read_csv(csv_file)
            print(f"   [{i}/{len(csv_files)}] Loading {csv_file.name}... ✓ {len(df):,} rows")
            all_data.append(df)
        except Exception as e:
            print(f"   [{i}/{len(csv_files)}] ERROR: {e}")
            continue
    
    if not all_data:
        print("\n❌ ERROR: No data loaded!")
        return None
    
    traffic_df = pd.concat(all_data, ignore_index=True)
    print(f"\n✓ Toplam: {len(traffic_df):,} rows")
    
    # Parse datetime
    traffic_df['DATE_TIME'] = pd.to_datetime(traffic_df['DATE_TIME'])
    traffic_df['hour'] = traffic_df['DATE_TIME'].dt.hour
    traffic_df['day_of_week'] = traffic_df['DATE_TIME'].dt.dayofweek
    traffic_df['month'] = traffic_df['DATE_TIME'].dt.month
    
    print(f"\n🎯 FINDING CLOSEST PERCENTILES FOR TARGET SPEEDS...")
    print(f"   This ensures we match your exact speed targets!")
    print()
    
    # Group by hour and day_of_week
    grouped = traffic_df.groupby(['hour', 'day_of_week'])
    
    # Build patterns with target matching
    hourly_patterns_list = []
    
    for (hour, day_of_week), group in grouped:
        speeds = group['AVERAGE_SPEED'].values
        target = TARGET_SPEEDS.get(hour, 50)  # Default 50 if not specified
        
        # Find closest percentile to target
        selected_speed, percentile_used = find_closest_percentile(speeds, target)
        
        # Store
        hourly_patterns_list.append({
            'hour': hour,
            'day_of_week': day_of_week,
            'avg_speed_kmh': selected_speed,
            'target_speed': target,
            'percentile_used': percentile_used,
            'min_speed_mean': group['MINIMUM_SPEED'].mean(),
            'max_speed_mean': group['MAXIMUM_SPEED'].mean(),
            'total_vehicles': group['NUMBER_OF_VEHICLES'].sum()
        })
    
    hourly_patterns = pd.DataFrame(hourly_patterns_list)
    
    # Calculate traffic metrics
    hourly_patterns['traffic_density'] = 100 * (1 - hourly_patterns['avg_speed_kmh'] / IDEAL_SPEED_KMH)
    hourly_patterns['traffic_density'] = hourly_patterns['traffic_density'].clip(0, 100)
    hourly_patterns['speed_factor'] = hourly_patterns['avg_speed_kmh'] / IDEAL_SPEED_KMH
    hourly_patterns['speed_factor'] = hourly_patterns['speed_factor'].clip(0, 1)
    
    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / 'ibb_traffic_patterns_2024_2025.csv'
    hourly_patterns.to_csv(output_file, index=False)
    
    # Stats
    print("\n" + "=" * 80)
    print("✓ PHASE 1 COMPLETED - MANUAL TARGET SPEEDS MATCHED!")
    print("=" * 80)
    
    # Show results (weekday only)
    print(f"\n📊 MATCHED SPEEDS (WEEKDAY):")
    print(f"   🎯 TARGET = Your desired speed")
    print(f"   ✅ ACTUAL = Closest İBB percentile")
    print()
    
    weekday_data = hourly_patterns[hourly_patterns['day_of_week'] < 5].groupby('hour').agg({
        'avg_speed_kmh': 'mean',
        'target_speed': 'first',
        'percentile_used': 'mean',
        'traffic_density': 'mean'
    }).round(1)
    
    for hour in range(24):
        if hour in weekday_data.index:
            data = weekday_data.loc[hour]
            target = data['target_speed']
            actual = data['avg_speed_kmh']
            percentile = data['percentile_used']
            diff = actual - target
            
            # Icon
            if hour in [7, 8, 9, 16, 17, 18, 19]:
                icon = "🔴"
            elif hour in [20, 21]:
                icon = "🌆"
            else:
                icon = "✅"
            
            print(f"   {hour:02d}:00 → Target: {target:4.0f} km/h | Actual: {actual:5.1f} km/h | P{percentile:2.0f} | Diff: {diff:+5.1f} | {icon}")
    
    # Weekend
    weekend_avg = hourly_patterns[hourly_patterns['day_of_week'] >= 5].agg({
        'avg_speed_kmh': 'mean',
        'traffic_density': 'mean'
    })
    
    print(f"\n📅 WEEKEND AVERAGE:")
    print(f"   Speed: {weekend_avg['avg_speed_kmh']:.1f} km/h")
    print(f"   Density: {weekend_avg['traffic_density']:.1f}%")
    
    # Compare rush vs normal
    rush_hours = [7, 8, 9, 16, 17, 18, 19, 20, 21]
    rush_data = weekday_data.loc[weekday_data.index.isin(rush_hours)]
    normal_data = weekday_data.loc[~weekday_data.index.isin(rush_hours)]
    
    rush_avg = rush_data['avg_speed_kmh'].mean()
    normal_avg = normal_data['avg_speed_kmh'].mean()
    
    print(f"\n🔍 İBB DATA ANALYSIS:")
    print(f"   Rush+Evening avg: {rush_avg:.1f} km/h")
    print(f"   Normal hour avg: {normal_avg:.1f} km/h")
    print(f"   Difference: {normal_avg - rush_avg:.1f} km/h")
    
    # Check accuracy
    total_diff = abs((weekday_data['avg_speed_kmh'] - weekday_data['target_speed'])).mean()
    print(f"\n✅ ACCURACY:")
    print(f"   Average difference from target: {total_diff:.1f} km/h")
    
    if total_diff < 3:
        print(f"   🎯 EXCELLENT! Very close to targets!")
    elif total_diff < 5:
        print(f"   ✅ GOOD! Reasonably close to targets!")
    else:
        print(f"   ⚠️  Some hours differ more than expected")
    
    print(f"\n💾 Output: {output_file}")
    print(f"   • Manual target speeds applied!")
    print(f"   • İBB data matched via percentile selection")
    print(f"   • NO calculation, pure data selection!")
    print("=" * 80)
    
    return hourly_patterns

if __name__ == "__main__":
    patterns = aggregate_ibb_traffic()
    
    if patterns is not None:
        print("\n✅ SUCCESS! MANUAL TARGET SPEEDS MATCHED!")
        print("   • Each hour matched to your target speed")
        print("   • Using closest İBB percentile")
        print("   • Pure data selection, no calculation!")
        print("\n🔜 NEXT: python scripts/phase2_generate_training.py")