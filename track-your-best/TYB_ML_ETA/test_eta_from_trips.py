# test_eta_from_trips.py
# Test TYB ETA predictions against Google Maps - LATEST TRIP ONLY

import psycopg2
import requests
import pandas as pd
from datetime import datetime
import uuid

# ===========================
# CONFIGURATION
# ===========================

# PostgreSQL connection
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "tyb_production",
    "user": "postgres",
    "password": "password"  # ← ŞİFRENİ YAZ
}

# TYB MLService endpoint
TYB_ETA_URL = "http://localhost:5200/api/eta/predict"

# ===========================
# DATABASE FUNCTIONS
# ===========================

def get_latest_approved_trip():
    """En son approve edilen trip'i al"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # En son approve edilen trip (start_time DESC)
        query = """
        SELECT 
            t.id as trip_id,
            t.vehicle_id,
            'Trip ' || t.id as trip_name,
            t.start_address,
            t.end_address,
            ST_X(t.start_location) as start_lon,
            ST_Y(t.start_location) as start_lat,
            ST_X(t.end_location) as end_lon,
            ST_Y(t.end_location) as end_lat,
            t.start_time,
            t.status,
            t.total_distance_km
        FROM tyb_spatial.trips t
        WHERE LOWER(t.status::text) = 'driver_approve'
        ORDER BY t.start_time DESC
        LIMIT 1;
        """
        
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        
        if row:
            trip = dict(zip(columns, row))
            cursor.close()
            conn.close()
            print(f"✅ Found latest approved trip from database")
            return trip
        else:
            cursor.close()
            conn.close()
            print(f"❌ No approved trips found!")
            return None
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return None

def save_eta_comparison_to_db(trip_id, tyb_eta, google_eta, difference):
    """ETA karşılaştırmasını database'e kaydet"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create table if not exists
        create_table = """
        CREATE TABLE IF NOT EXISTS tyb_analytics.eta_comparisons (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            trip_id UUID,
            tyb_eta_minutes NUMERIC(10, 2),
            google_maps_eta_minutes NUMERIC(10, 2),
            difference_minutes NUMERIC(10, 2),
            difference_percentage NUMERIC(5, 2),
            accuracy_percentage NUMERIC(5, 2),
            test_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
        cursor.execute(create_table)
        
        # Calculate metrics
        diff_pct = (difference / google_eta * 100) if google_eta > 0 else 0
        accuracy = 100 - abs(diff_pct)
        
        # Insert comparison
        insert_query = """
        INSERT INTO tyb_analytics.eta_comparisons 
        (trip_id, tyb_eta_minutes, google_maps_eta_minutes, difference_minutes, 
         difference_percentage, accuracy_percentage)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        cursor.execute(insert_query, (trip_id, tyb_eta, google_eta, difference, diff_pct, accuracy))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  Could not save to DB: {e}")
        return False

# ===========================
# TYB ETA FUNCTION
# ===========================

def get_tyb_eta_prediction(trip):
    """TYB ML Model'den ETA tahmini al"""
    try:
        # Use vehicle_id as deviceId (since device_id doesn't exist)
        payload = {
            "tripId": str(trip["trip_id"]),
            "deviceId": str(trip.get("vehicle_id", "00000000-0000-0000-0000-000000000000")),
            "startLat": float(trip["start_lat"]),
            "startLon": float(trip["start_lon"]),
            "endLat": float(trip["end_lat"]),
            "endLon": float(trip["end_lon"])
        }
        
        response = requests.post(TYB_ETA_URL, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract traffic_info from response
            traffic_info = data.get("traffic_info", {})
            
            return {
                "success": True,
                "eta_minutes": data.get("eta_minutes", 0),
                "eta_seconds": data.get("eta_seconds", 0),
                "distance_km": data.get("distance_km", 0),
                "confidence": data.get("confidence", 0),
                "traffic_info": {
                    "is_rush_hour": traffic_info.get("is_rush_hour", False),
                    "avg_speed_kmh": traffic_info.get("avg_speed_kmh", 0),
                    "traffic_density": traffic_info.get("traffic_density", 0),
                    "hour": traffic_info.get("hour", 0),
                    "day_of_week": traffic_info.get("day_of_week", 0),
                    "is_weekend": traffic_info.get("is_weekend", False)
                },
                "prediction_id": data.get("prediction_id", "")
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}",
                "eta_minutes": None
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "eta_minutes": None
        }

# ===========================
# TEST RUNNER
# ===========================

def run_single_test():
    """En son approve edilen trip'i test et"""
    
    print("=" * 80)
    print("TYB ETA VALIDATION TEST - LATEST APPROVED TRIP")
    print("=" * 80)
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # 1. En son approved trip'i al
    trip = get_latest_approved_trip()
    
    if not trip:
        print("\n❌ No approved trips found in database!")
        print("   Please approve a route in React first.\n")
        return None
    
    print(f"\n📍 Testing Trip: {trip['trip_name'][:40]}...")
    print(f"  Trip ID:     {trip['trip_id']}")
    print(f"  Vehicle ID:  {trip.get('vehicle_id', 'N/A')}")
    print(f"  Approved at: {trip['start_time']}")
    
    # Addresses (can be NULL)
    start_addr = trip.get('start_address', 'Unknown')
    end_addr = trip.get('end_address', 'Unknown')
    if start_addr and end_addr:
        print(f"  Route:       {start_addr} → {end_addr}")
    
    print(f"  Coords:      ({trip['start_lat']:.4f}, {trip['start_lon']:.4f}) → ({trip['end_lat']:.4f}, {trip['end_lon']:.4f})")
    
    # 2. TYB Model prediction
    print(f"\n  🤖 Getting TYB prediction...")
    tyb_result = get_tyb_eta_prediction(trip)
    
    if not tyb_result["success"]:
        print(f"  ❌ TYB ERROR: {tyb_result['error']}")
        print(f"\n  💡 Make sure TYB.MLService is running on http://localhost:5200\n")
        return None
    
    tyb_eta = tyb_result["eta_minutes"]
    traffic = tyb_result.get("traffic_info", {})
    
    # CRITICAL FIX: Use total minutes, not display minutes!
    # eta_minutes = total (e.g., 72.12 min)
    # eta_minutes_display = just the minute part (e.g., 12 min from 1h 12min)
    
    print(f"  ✅ TYB ETA:       {tyb_eta:.1f} min")
    
    # Debug: Show hours if > 60 min
    if tyb_eta >= 60:
        hours = int(tyb_eta // 60)
        mins = int(tyb_eta % 60)
        print(f"     (= {hours}h {mins}min)")
    
    print(f"  💯 Confidence:    {tyb_result['confidence']*100:.2f}%")
    print(f"  📏 Distance:      {tyb_result['distance_km']:.2f} km")
    print(f"  🚦 Traffic:       Rush={traffic.get('is_rush_hour', False)}, Speed={traffic.get('avg_speed_kmh', 0):.1f} km/h")
    
    # Show time info with day name
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_of_week = traffic.get('day_of_week', 0)
    day_name = day_names[day_of_week] if 0 <= day_of_week <= 6 else f"Day{day_of_week}"
    print(f"  🕐 Time Info:     Hour={traffic.get('hour', 'N/A')}, Day={day_name}, Weekend={traffic.get('is_weekend', False)}")
    
    # 3. Google Maps link
    google_link = f"https://www.google.com/maps/dir/{trip['start_lat']},{trip['start_lon']}/{trip['end_lat']},{trip['end_lon']}"
    
    print(f"\n  🗺️  Google Maps Link:")
    print(f"  {google_link}")
    
    # 4. Manual Google ETA entry
    print(f"\n  ⏸️  MANUAL STEP: Open link, check Google Maps ETA, then enter below:")
    
    while True:
        user_input = input(f"  Enter Google Maps ETA (minutes) [or 's' to skip]: ").strip().lower()
        
        if user_input == 's':
            print(f"  ⏭️  Skipped.\n")
            return None
        
        try:
            google_eta = float(user_input)
            if google_eta <= 0:
                print(f"  ❌ Please enter a positive number!")
                continue
            break
        except ValueError:
            print(f"  ❌ Invalid input! Please enter a number (e.g., 25)")
            continue
    
    # 5. Compare
    diff_minutes = tyb_eta - google_eta
    diff_percentage = (diff_minutes / google_eta) * 100 if google_eta > 0 else 0
    accuracy = 100 - abs(diff_percentage)
    
    print(f"\n  📊 COMPARISON:")
    print(f"     TYB:        {tyb_eta:.1f} min")
    print(f"     Google:     {google_eta:.1f} min")
    print(f"     Difference: {diff_minutes:+.1f} min ({diff_percentage:+.1f}%)")
    print(f"     Accuracy:   {accuracy:.1f}%")
    
    # Status emoji
    if abs(diff_minutes) <= 3:
        status_emoji = "🎯 Excellent!"
    elif abs(diff_minutes) <= 5:
        status_emoji = "✅ Good"
    elif abs(diff_minutes) <= 10:
        status_emoji = "⚠️  Acceptable"
    else:
        status_emoji = "❌ Needs improvement"
    
    print(f"     Status:     {status_emoji}")
    
    # 6. Save to database
    saved = save_eta_comparison_to_db(trip['trip_id'], tyb_eta, google_eta, diff_minutes)
    
    if saved:
        print(f"  💾 Comparison saved to database (tyb_analytics.eta_comparisons)")
    
    # 7. Return result for Excel
    result = {
        "trip_id": str(trip["trip_id"]),
        "vehicle_id": str(trip.get("vehicle_id", "N/A")),
        "trip_name": trip["trip_name"],
        "start_address": start_addr,
        "end_address": end_addr,
        "approved_at": trip["start_time"].strftime('%Y-%m-%d %H:%M:%S') if trip["start_time"] else "N/A",
        "test_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "tyb_distance_km": tyb_result.get("distance_km", 0),
        "tyb_eta_min": tyb_eta,
        "google_eta_min": google_eta,
        "difference_min": diff_minutes,
        "difference_pct": diff_percentage,
        "accuracy_pct": accuracy,
        "tyb_confidence": tyb_result["confidence"],
        "is_rush_hour": traffic.get("is_rush_hour", False),
        "avg_speed_kmh": traffic.get("avg_speed_kmh", 0),
        "traffic_density": traffic.get("traffic_density", 0),
        "status": status_emoji
    }
    
    print(f"\n" + "=" * 80)
    print(f"✅ Test completed successfully!")
    print(f"=" * 80)
    
    return result

def save_to_excel(result):
    """Sonucu SINGLE Excel dosyasına ekle (append mode)"""
    if not result:
        print("❌ No result to save")
        return None
    
    filename = "TYB_ETA_Validation_Results.xlsx"  # TEK DOSYA!
    
    # Yeni result'ı DataFrame'e çevir
    new_df = pd.DataFrame([result])
    
    try:
        # Eğer dosya varsa, mevcut data'yı oku ve yenisini ekle
        existing_df = pd.read_excel(filename)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        combined_df.to_excel(filename, index=False)
        print(f"\n📊 Result APPENDED to: {filename}")
        print(f"   Total tests in file: {len(combined_df)}")
    except FileNotFoundError:
        # Dosya yoksa yeni oluştur
        new_df.to_excel(filename, index=False)
        print(f"\n📊 New file created: {filename}")
        print(f"   Total tests in file: 1")
    
    return filename

def view_historical_tests(trip_id=None):
    """Database'deki geçmiş testleri görüntüle"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        if trip_id:
            query = """
            SELECT 
                test_time,
                tyb_eta_minutes,
                google_maps_eta_minutes,
                difference_minutes,
                accuracy_percentage
            FROM tyb_analytics.eta_comparisons
            WHERE trip_id = %s
            ORDER BY test_time DESC;
            """
            cursor.execute(query, (trip_id,))
        else:
            query = """
            SELECT 
                trip_id,
                test_time,
                tyb_eta_minutes,
                google_maps_eta_minutes,
                difference_minutes,
                accuracy_percentage
            FROM tyb_analytics.eta_comparisons
            ORDER BY test_time DESC
            LIMIT 20;
            """
            cursor.execute(query)
        
        rows = cursor.fetchall()
        
        if rows:
            print("\n" + "=" * 80)
            print("HISTORICAL TEST RESULTS")
            print("=" * 80)
            for row in rows:
                if trip_id:
                    test_time, tyb, google, diff, acc = row
                    print(f"{test_time} | TYB: {tyb:.1f}min | Google: {google:.1f}min | Diff: {diff:+.1f}min | Acc: {acc:.1f}%")
                else:
                    tid, test_time, tyb, google, diff, acc = row
                    print(f"{test_time} | Trip: {str(tid)[:8]}... | TYB: {tyb:.1f}min | Google: {google:.1f}min | Acc: {acc:.1f}%")
            print("=" * 80 + "\n")
        else:
            print("\n❌ No historical tests found.\n")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error viewing history: {e}")

# ===========================
# MAIN
# ===========================

if __name__ == "__main__":
    print("\n🚀 TYB ETA VALIDATION - SINGLE TRIP TEST\n")
    
    # Check DB password
    if DB_CONFIG["password"] == "your_password_here":
        print("❌ Please update DB_CONFIG password in the script!\n")
        exit(1)
    
    # Run test
    result = run_single_test()
    
    if result:
        # Save to Excel
        save_to_excel(result)
        
        # Ask if user wants to see history
        print("\n💡 Tip: You can run this script multiple times at different hours!")
        print("   All tests are saved to: tyb_analytics.eta_comparisons\n")
        
        view_hist = input("View historical tests for this trip? (y/n): ").strip().lower()
        if view_hist == 'y':
            view_historical_tests(result['trip_id'])
    
    print("✅ Done!\n")