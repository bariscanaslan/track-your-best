"""GPS preprocessing and feature extraction for analytics jobs."""

import numpy as np
from typing import List, Optional
from math import radians, cos, sin, asin, sqrt


# ---------------------------------------------------------------------------
# Physical limits
# ---------------------------------------------------------------------------

MAX_PHYSICAL_SPEED_MPS: float = 70.0

MAX_SINGLE_EVENT_SEVERITY: float = 10.0


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------

class GpsPoint:
    def __init__(self, lat: float, lon: float, timestamp):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the distance between two GPS coordinates in meters."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * asin(sqrt(a)) * 6371000


def calculate_speed(distance_m: float, time_s: float) -> float:
    return 0.0 if time_s <= 0 else distance_m / time_s


def smooth_series(values: List[float], window_size: int = 3) -> List[float]:
    """Apply a moving average to reduce GPS jumps."""
    if len(values) < window_size:
        return values
    return np.convolve(values, np.ones(window_size) / window_size, mode="same").tolist()


# ---------------------------------------------------------------------------
# Event extraction
# ---------------------------------------------------------------------------

def extract_discrete_events(
    values_array: List[float],
    threshold_positive: Optional[float] = None,
    threshold_negative: Optional[float] = None,
    max_severity: float = MAX_SINGLE_EVENT_SEVERITY,
) -> tuple:
    """Extract discrete threshold events and capped severity totals."""
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
                in_event = True
                event_count += 1
                current_peak_severity = severity
            else:
                current_peak_severity = max(current_peak_severity, severity)
        else:
            if in_event:
                severity_sum += min(current_peak_severity, max_severity)
                in_event = False
                current_peak_severity = 0.0

    if in_event:
        severity_sum += min(current_peak_severity, max_severity)

    return event_count, severity_sum


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------

def extract_trip_features(
    gps_points: List[GpsPoint],
    harsh_accel_threshold: float = 2.5,
    harsh_brake_threshold: float = 2.5,
    speed_limit_mps: float = 25.5,
) -> dict:
    """Extract trip features from one GPS source of truth."""
    if len(gps_points) < 2:
        return {}

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    valid_speeds:    List[float] = []
    valid_distances: List[float] = []
    valid_durations: List[float] = []

    raw_distances: List[float] = []
    raw_durations: List[float] = []

    outlier_count: int = 0

    for i in range(1, len(gps_points)):
        dt = (gps_points[i].timestamp - gps_points[i - 1].timestamp).total_seconds()
        if dt <= 0:
            continue

        dist = haversine(
            gps_points[i - 1].lat, gps_points[i - 1].lon,
            gps_points[i].lat,     gps_points[i].lon,
        )
        speed = calculate_speed(dist, dt)

        raw_distances.append(dist)
        raw_durations.append(dt)

        if speed > MAX_PHYSICAL_SPEED_MPS:
            outlier_count += 1
            continue

        valid_speeds.append(speed)
        valid_distances.append(dist)
        valid_durations.append(dt)

    if not valid_speeds:
        return {}

    smoothed_speeds = smooth_series(valid_speeds, window_size=3)

    accel_array:      List[float] = []
    accel_durations:  List[float] = []
    moving_seconds:   float = 0.0
    speeding_seconds: float = 0.0
    stop_count:       int = 0
    in_stop:          bool = False

    for i in range(1, len(smoothed_speeds)):
        dt = valid_durations[i - 1]
        if dt <= 0:
            continue

        curr_speed = smoothed_speeds[i]
        prev_speed = smoothed_speeds[i - 1]

        accel = (curr_speed - prev_speed) / dt
        accel_array.append(accel)
        accel_durations.append(dt)

        if curr_speed > 1.0:
            moving_seconds += dt
            in_stop = False
            if curr_speed > speed_limit_mps:
                speeding_seconds += dt
        else:
            if not in_stop:
                stop_count += 1
                in_stop = True

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    brake_count, brake_sev_sum = extract_discrete_events(
        accel_array, threshold_negative=-harsh_brake_threshold
    )
    accel_count, accel_sev_sum = extract_discrete_events(
        accel_array, threshold_positive=harsh_accel_threshold
    )

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    speeds_arr = np.array(smoothed_speeds) if smoothed_speeds else np.array([0.0])

    valid_distance_m = sum(valid_distances)
    valid_duration_s = sum(valid_durations)

    raw_distance_m   = sum(raw_distances)
    raw_duration_s   = sum(raw_durations)

    return {
        "duration_sec":       valid_duration_s,
        "distance_m":         valid_distance_m,

        "moving_seconds":     moving_seconds,
        "avg_speed_mps":      float(np.mean(speeds_arr)),
        "p95_speed_mps":      float(np.percentile(speeds_arr, 95)),
        "max_speed_mps":      float(np.max(speeds_arr)),
        "speed_std":          float(np.std(speeds_arr)),

        # --- Olaylar ------------------------------------------------------
        "stop_count":         stop_count,
        "speeding_seconds":   speeding_seconds,
        "speeding_ratio_pct": (speeding_seconds / max(moving_seconds, 1)) * 100.0,
        "brake_event_count":  brake_count,
        "brake_severity_sum": round(brake_sev_sum, 4),
        "accel_event_count":  accel_count,
        "accel_severity_sum": round(accel_sev_sum, 4),

        "raw_distance_m":      raw_distance_m,
        "raw_duration_sec":    raw_duration_s,
        "gps_outlier_count":   outlier_count,
        # valid_segment_count = len(valid_speeds)  [accel_array'den 1 fazla]
        "valid_segment_count": len(valid_speeds),
        "raw_segment_count":   len(raw_distances),

        # --- Debug --------------------------------------------------------
        # accel_durations is aligned 1:1 with accel_array.
        # accel_durations[i] = dt of the segment that produced accel_array[i].
        "accel_array":        accel_array,
        "accel_durations":    accel_durations,
    }


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------

def features_to_ml_input(features: dict) -> dict:
    hours = max(features.get("duration_sec", 1) / 3600.0, 0.25)
    return {
        "p95_speed_mps":        features.get("p95_speed_mps", 0.0),
        "harsh_accel_per_hour": features.get("accel_event_count", 0) / hours,
        "harsh_brake_per_hour": features.get("brake_event_count", 0) / hours,
        "stop_count_per_hour":  features.get("stop_count", 0) / hours,
    }


def features_to_anomaly_input(features: dict) -> dict:
    """Convert trip features into the AnomalyDetector feature order."""
    hours       = max(features.get("duration_sec", 1) / 3600.0, 0.25)
    accel_count = features.get("accel_event_count", 0)
    brake_count = features.get("brake_event_count", 0)

    outlier_count       = features.get("gps_outlier_count", 0)
    total_segment_count = max(features.get("raw_segment_count", 1), 1)
    gps_spike_ratio     = round((outlier_count / total_segment_count) * 100.0, 4)

    velocity_oscillation = (
        features.get("speed_std", 0.0)
        / max(features.get("max_speed_mps", 1.0), 1.0)
    ) * 10.0

    MIN_JERK_DT_S = 0.5
    accel_arr = features.get("accel_array", [])
    accel_dts = features.get("accel_durations", [])
    if len(accel_arr) >= 2 and len(accel_dts) >= 2:
        jerk_values = [
            abs(accel_arr[i] - accel_arr[i - 1]) / accel_dts[i]
            for i in range(1, len(accel_arr))
            if accel_dts[i] >= MIN_JERK_DT_S
        ]
        jerk_magnitude = float(np.mean(jerk_values)) if jerk_values else 0.0
    else:
        jerk_values    = []
        jerk_magnitude = 0.0

    accel_arr_np   = np.array(accel_arr) if accel_arr else np.array([0.0])
    accel_intensity = float(np.max(np.abs(accel_arr_np)))

    avg_speed = features.get("avg_speed_mps", 0.0)
    speed_std  = features.get("speed_std", 0.0)
    speed_variation_cv = (speed_std / max(avg_speed, 0.1))

    # ------------------------------------------------------------------
    # accel_spike_frequency  [olay/saat]
    # ------------------------------------------------------------------
    accel_spike_frequency = (accel_count + brake_count) / hours

    # ------------------------------------------------------------------
    # duration_quality  [0.0 - 1.0]
    # ------------------------------------------------------------------
    valid_seg   = features.get("valid_segment_count", total_segment_count - outlier_count)
    duration_quality = round(valid_seg / total_segment_count, 4)

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    max_accel = float(np.max(accel_arr_np))
    min_accel = float(np.min(accel_arr_np))

    return {
        "gps_spike_ratio":      gps_spike_ratio,
        "velocity_oscillation": round(velocity_oscillation, 4),
        "jerk_magnitude":       round(jerk_magnitude, 4),
        "accel_intensity":      round(accel_intensity, 4),
        "speed_variation_cv":   round(speed_variation_cv, 4),
        "accel_spike_frequency": round(accel_spike_frequency, 4),
        "duration_quality":     duration_quality,
        "max_accel":            round(max_accel, 4),
        "min_accel":            round(min_accel, 4),
        # ------------------------------------------------------------------
        # ------------------------------------------------------------------
        "max_jerk":             round(float(np.max(jerk_values)) if jerk_values else 0.0, 4),
        "min_jerk":             round(float(np.min(jerk_values)) if jerk_values else 0.0, 4),
    }
