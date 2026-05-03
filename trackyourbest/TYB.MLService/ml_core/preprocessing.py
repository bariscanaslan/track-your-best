"""
TYB MLService - Veri Ön İşleme (v5 Production)
=============================================
GPS verilerinden smoothed (yumuşatılmış) ve olay bazlı özellik çıkarımı.
"""

import numpy as np
from typing import List
from math import radians, cos, sin, asin, sqrt


class GpsPoint:
    def __init__(self, lat: float, lon: float, timestamp):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return c * 6371000


def calculate_speed(distance_m: float, time_s: float) -> float:
    return 0.0 if time_s <= 0 else distance_m / time_s


def smooth_series(values: List[float], window_size: int = 3) -> List[float]:
    """GPS zıplamalarını engellemek için Hareketli Ortalama (Moving Average) uygular"""
    if len(values) < window_size:
        return values
    return np.convolve(values, np.ones(window_size) / window_size, mode='same').tolist()


def extract_discrete_events(values_array, threshold_positive=None, threshold_negative=None):
    """Sürekli bir zaman serisinden NET olayları ve ŞİDDET toplamlarını (Severity Sum) çıkartır."""
    event_count = 0
    severity_sum = 0.0
    in_event = False
    current_peak_severity = 0.0

    for val in values_array:
        is_trigger = False
        severity = 0.0

        if threshold_positive is not None and val >= threshold_positive:
            is_trigger = True
            severity = val - threshold_positive
        elif threshold_negative is not None and val <= threshold_negative:
            is_trigger = True
            severity = abs(val) - abs(threshold_negative)

        if is_trigger:
            if not in_event:
                in_event = True  # Olay başladı
                event_count += 1
                current_peak_severity = severity
            else:
                # Olay devam ediyor, en yüksek şiddeti tut
                current_peak_severity = max(current_peak_severity, severity)
        else:
            if in_event:
                # Olay bitti, zirve şiddetini faturaya ekle
                severity_sum += current_peak_severity
                in_event = False
                current_peak_severity = 0.0

    if in_event:
        severity_sum += current_peak_severity

    return event_count, severity_sum


def extract_trip_features(gps_points: List[GpsPoint],
                          harsh_accel_threshold: float = 2.5,
                          harsh_brake_threshold: float = 2.5,
                          speed_limit_mps: float = 25.5) -> dict:
    """Tek bir kaynaktan, uyumlu olay ve metrik çıkarma (Single Source of Truth)"""
    if len(gps_points) < 2:
        return {}

    raw_speeds = []
    distances = []
    durations = []

    for i in range(1, len(gps_points)):
        dt = (gps_points[i].timestamp - gps_points[i - 1].timestamp).total_seconds()
        if dt <= 0: continue
        dist = haversine(gps_points[i - 1].lat, gps_points[i - 1].lon, gps_points[i].lat, gps_points[i].lon)

        raw_speeds.append(calculate_speed(dist, dt))
        distances.append(dist)
        durations.append(dt)

    # 1. Gürültü Filtreleme (Smoothing)
    smoothed_speeds = smooth_series(raw_speeds, window_size=3)

    accel_array = []
    moving_seconds = 0
    speeding_seconds = 0
    stop_count = 0
    in_stop = False

    for i in range(1, len(smoothed_speeds)):
        dt = durations[i]
        curr_speed = smoothed_speeds[i]
        prev_speed = smoothed_speeds[i - 1]

        # İvme hesapla
        accel = (curr_speed - prev_speed) / dt
        accel_array.append(accel)

        if curr_speed > 1.0:
            moving_seconds += dt
            in_stop = False
            if curr_speed > speed_limit_mps:
                speeding_seconds += dt
        else:
            if not in_stop:
                stop_count += 1
                in_stop = True

    # 2. Event Extraction (Gerçek Olaylar)
    brake_count, brake_sev_sum = extract_discrete_events(accel_array, threshold_negative=-harsh_brake_threshold)
    accel_count, accel_sev_sum = extract_discrete_events(accel_array, threshold_positive=harsh_accel_threshold)

    # İstatistikler
    speeds_arr = np.array(smoothed_speeds) if smoothed_speeds else np.array([0])

    return {
        'duration_sec': sum(durations),
        'moving_seconds': moving_seconds,
        'distance_m': sum(distances),
        'avg_speed_mps': np.mean(speeds_arr),
        'p95_speed_mps': np.percentile(speeds_arr, 95),
        'max_speed_mps': np.max(speeds_arr),
        'speed_std': np.std(speeds_arr),
        'stop_count': stop_count,
        'speeding_seconds': speeding_seconds,
        'speeding_ratio_pct': (speeding_seconds / max(moving_seconds, 1)) * 100.0,
        'brake_event_count': brake_count,
        'brake_severity_sum': brake_sev_sum,
        'accel_event_count': accel_count,
        'accel_severity_sum': accel_sev_sum,
        'accel_array': accel_array
    }


# ML ve Anomali fonksiyonları aynen kalabilir, uyumluluğu bozmamak için:
def features_to_ml_input(features: dict) -> dict:
    hours = max(features.get('duration_sec', 1) / 3600.0, 0.25)
    return {
        'p95_speed_mps': features.get('p95_speed_mps', 0),
        'harsh_accel_per_hour': features.get('accel_event_count', 0) / hours,
        'harsh_brake_per_hour': features.get('brake_event_count', 0) / hours,
        'stop_count_per_hour': features.get('stop_count', 0) / hours
    }


def features_to_anomaly_input(features: dict) -> dict:
    hours = max(features.get('duration_sec', 1) / 3600.0, 0.25)
    accel_count = features.get('accel_event_count', 0)
    brake_count = features.get('brake_event_count', 0)
    accel_oscillation = (accel_count + brake_count) / hours

    return {
        'gps_spike_ratio': 0.0,
        'velocity_oscillation': (features.get('speed_std', 0) / max(features.get('max_speed_mps', 1), 1)) * 10.0,
        'acceleration_oscillation': accel_oscillation,
        'stop_count_outlier': features.get('stop_count', 0) / hours,
        'idle_ratio': 0.0,
        'max_jerk': accel_oscillation * 0.5,
        'min_jerk': -accel_oscillation * 0.5,
        'max_accel': 2.5 + (accel_count / hours) * 0.1,
        'min_accel': -(2.5 + (brake_count / hours) * 0.1),
        'duration_hours': hours
    }