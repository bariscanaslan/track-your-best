"""
PHASE 1: İBB TRAFFIC DATA AGGREGATION (2024-2025)
==================================================
13 aylık İBB trafik verisini birleştirir ve temporal patterns çıkarır.

Input:  data/ibb_raw/*.csv (13 CSV dosyası)
Output: data/processed/ibb_traffic_patterns_2024_2025.csv
"""

import pandas as pd
import numpy as np
import glob
from datetime import datetime
import os

def aggregate_ibb_traffic():
    print("=" * 80)
    print("PHASE 1: İBB TRAFFIC DATA AGGREGATION (2024-2025)")
    print("=" * 80)
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Create output directories if they don't exist
    os.makedirs('data/processed', exist_ok=True)
    
    # Find all CSV files in data/ibb_raw/
    csv_files = sorted(glob.glob("data/ibb_raw/*.csv"))
    
    if len(csv_files) == 0:
        print("\n❌ ERROR: CSV dosyası bulunamadı!")
        print("   Lütfen CSV dosyalarını 'data/ibb_raw/' klasörüne koyun.")
        print("\n📁 Beklenen yapı:")
        print("   data/ibb_raw/traffic_density_202401.csv")
        print("   data/ibb_raw/traffic_density_202402.csv")
        print("   ...")
        return None
    
    print(f"\n📂 Bulunan CSV dosyaları: {len(csv_files)}")
    for i, file in enumerate(csv_files, 1):
        file_size = os.path.getsize(file) / (1024**3)  # GB
        print(f"   {i}. {os.path.basename(file)} ({file_size:.2f} GB)")
    
    # Load and concatenate all CSVs
    print(f"\n🔄 CSV dosyaları yükleniyor...")
    all_data = []
    
    for i, file in enumerate(csv_files, 1):
        print(f"   [{i}/{len(csv_files)}] Loading {os.path.basename(file)}...", end=" ")
        try:
            df = pd.read_csv(file)
            all_data.append(df)
            print(f"✓ {len(df):,} rows")
        except Exception as e:
            print(f"❌ ERROR: {e}")
            continue
    
    if len(all_data) == 0:
        print("\n❌ ERROR: Hiçbir dosya yüklenemedi!")
        return None
    
    # Concatenate
    print(f"\n🔗 Birleştiriliyor...")
    traffic_df = pd.concat(all_data, ignore_index=True)
    print(f"✓ Toplam kayıt: {len(traffic_df):,} rows")
    
    # Data info
    print(f"\n📊 Veri Seti Bilgileri:")
    print(f"   Columns: {traffic_df.columns.tolist()}")
    print(f"   Memory usage: {traffic_df.memory_usage(deep=True).sum() / (1024**3):.2f} GB")
    
    # Parse datetime
    print(f"\n⏰ Temporal features oluşturuluyor...")
    traffic_df['datetime'] = pd.to_datetime(traffic_df['DATE_TIME'])
    traffic_df['year'] = traffic_df['datetime'].dt.year
    traffic_df['month'] = traffic_df['datetime'].dt.month
    traffic_df['hour'] = traffic_df['datetime'].dt.hour
    traffic_df['day_of_week'] = traffic_df['datetime'].dt.dayofweek
    traffic_df['is_weekend'] = (traffic_df['day_of_week'] >= 5).astype(int)
    traffic_df['is_rush_hour'] = traffic_df['hour'].isin([7, 8, 9, 16, 17, 18, 19]).astype(int)
    
    # Date range
    print(f"   Tarih aralığı: {traffic_df['datetime'].min()} → {traffic_df['datetime'].max()}")
    print(f"   Yıllar: {sorted(traffic_df['year'].unique())}")
    print(f"   Aylar: {sorted(traffic_df['month'].unique())}")
    
    # Aggregate by hour × day_of_week
    print(f"\n📈 Temporal patterns aggregate ediliyor (hour × day_of_week)...")
    
    hourly_patterns = traffic_df.groupby(['hour', 'day_of_week']).agg({
        'AVERAGE_SPEED': ['mean', 'std', 'min', 'max'],
        'MINIMUM_SPEED': 'mean',
        'MAXIMUM_SPEED': 'mean',
        'NUMBER_OF_VEHICLES': ['mean', 'sum', 'std']
    }).reset_index()
    
    # Flatten column names
    hourly_patterns.columns = [
        'hour', 'day_of_week',
        'avg_speed_mean', 'avg_speed_std', 'avg_speed_min', 'avg_speed_max',
        'min_speed_mean', 'max_speed_mean',
        'vehicle_count_mean', 'vehicle_count_total', 'vehicle_count_std'
    ]
    
    # Calculate derived features
    print(f"\n🔧 Derived features hesaplanıyor...")
    
    # Traffic density score (0-100)
    hourly_patterns['traffic_density'] = 100 * (
        1 - hourly_patterns['avg_speed_mean'] / hourly_patterns['max_speed_mean'].replace(0, 1)
    )
    
    # Speed factor (vs ideal 70 km/h)
    hourly_patterns['speed_factor'] = hourly_patterns['avg_speed_mean'] / 70
    
    # Congestion level
    def categorize_traffic(density):
        if density < 25:
            return 'low'
        elif density < 50:
            return 'medium'
        elif density < 75:
            return 'high'
        else:
            return 'severe'
    
    hourly_patterns['traffic_level'] = hourly_patterns['traffic_density'].apply(categorize_traffic)
    
    # Day names for readability
    day_names = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 
                 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    hourly_patterns['day_name'] = hourly_patterns['day_of_week'].map(day_names)
    
    # Save
    output_file = 'data/processed/ibb_traffic_patterns_2024_2025.csv'
    hourly_patterns.to_csv(output_file, index=False)
    
    # Statistics
    print("\n" + "=" * 80)
    print("✓ PHASE 1 COMPLETED!")
    print("=" * 80)
    print(f"\n📊 SONUÇLAR:")
    print(f"   • Toplam kayıt işlendi: {len(traffic_df):,} rows")
    print(f"   • Pattern sayısı: {len(hourly_patterns)} (24 hours × 7 days)")
    print(f"   • Tarih aralığı: {traffic_df['datetime'].min().date()} → {traffic_df['datetime'].max().date()}")
    
    print(f"\n🚗 TRAFİK İSTATİSTİKLERİ:")
    print(f"   • Ortalama hız: {hourly_patterns['avg_speed_mean'].mean():.1f} km/h")
    print(f"   • Min hız: {hourly_patterns['avg_speed_mean'].min():.1f} km/h")
    print(f"   • Max hız: {hourly_patterns['avg_speed_mean'].max():.1f} km/h")
    print(f"   • Ortalama araç sayısı: {hourly_patterns['vehicle_count_mean'].mean():.0f}")
    
    # Rush hour stats
    rush_hours = [7, 8, 9, 16, 17, 18, 19]
    rush_data = hourly_patterns[hourly_patterns['hour'].isin(rush_hours)]
    print(f"\n⚠️  RUSH HOUR İSTATİSTİKLERİ (07-09, 16-19):")
    print(f"   • Ortalama hız: {rush_data['avg_speed_mean'].mean():.1f} km/h")
    print(f"   • Ortalama traffic density: {rush_data['traffic_density'].mean():.1f}%")
    
    # Traffic level distribution
    print(f"\n📊 TRAFİK SEVİYESİ DAĞILIMI:")
    for level in ['low', 'medium', 'high', 'severe']:
        count = len(hourly_patterns[hourly_patterns['traffic_level'] == level])
        pct = 100 * count / len(hourly_patterns)
        print(f"   • {level.capitalize()}: {count} hours ({pct:.1f}%)")
    
    # Top 5 worst traffic hours
    print(f"\n🔴 EN YOĞUN 5 SAAT:")
    worst = hourly_patterns.nsmallest(5, 'avg_speed_mean')[['day_name', 'hour', 'avg_speed_mean', 'traffic_density']]
    for idx, row in worst.iterrows():
        hour_int = int(row['hour']) if not pd.isna(row['hour']) else 0
        print(f"   • {row['day_name']} {hour_int:02d}:00 → {row['avg_speed_mean']:.1f} km/h (density: {row['traffic_density']:.1f}%)")
    
    # Top 5 best traffic hours
    print(f"\n🟢 EN RAHAT 5 SAAT:")
    best = hourly_patterns.nlargest(5, 'avg_speed_mean')[['day_name', 'hour', 'avg_speed_mean', 'traffic_density']]
    for idx, row in best.iterrows():
        hour_int = int(row['hour']) if not pd.isna(row['hour']) else 0
        print(f"   • {row['day_name']} {hour_int:02d}:00 → {row['avg_speed_mean']:.1f} km/h (density: {row['traffic_density']:.1f}%)")
    
    print(f"\n💾 Output dosyası: {output_file}")
    print(f"   File size: {os.path.getsize(output_file) / 1024:.1f} KB")
    print("=" * 80)
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    return hourly_patterns

if __name__ == "__main__":
    patterns = aggregate_ibb_traffic()
    
    if patterns is not None:
        print("\n✅ SUCCESS! Phase 1 tamamlandı.")
        print("\n🔜 NEXT STEP: Phase 2 - Generate training data")
        print("   Komut: python scripts/phase2_generate_training.py")
    else:
        print("\n❌ FAILED! Lütfen hataları kontrol edin.")