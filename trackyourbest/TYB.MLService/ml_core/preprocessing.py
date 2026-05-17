"""
TYB MLService - Veri Ön İşleme (v6 Production)
===============================================
Changelog vs v5:
  - GPS outlier filtresi eklendi: fiziksel olarak imkânsız hız atlamalarını
    (> MAX_PHYSICAL_SPEED_MPS) segment bazında eliyor. Bu, 63s/2624m gibi
    bozuk trip'lerin accel_array'e saçma değerler yazmasını önler.
  - accel_array indeks kayması düzeltildi: durations[i] yerine durations[i-1]
    kullanılıyor (accel, i-1→i segmentine ait, i'ye değil).
  - extract_discrete_events'e per-event severity cap eklendi: tek bir GPS
    gürültüsünün tüm severity_sum'u patlatmasını önler.
  - dt <= 0 koruması accel döngüsüne de eklendi.
  - Tüm özellikler sözlükten okunurken güvenli default değerler kullanıyor.
"""

import numpy as np
from typing import List, Optional
from math import radians, cos, sin, asin, sqrt


# ---------------------------------------------------------------------------
# Fiziksel limitler
# ---------------------------------------------------------------------------

# Bu hızın üzerindeki GPS segmentleri bozuk/atlama kabul edilir ve filtrelenir.
# 70 m/s ≈ 252 km/h — kara aracı için makul üst sınır.
MAX_PHYSICAL_SPEED_MPS: float = 70.0

# extract_discrete_events içinde tek bir event'in severity katkısı bu değeri
# geçemez. 2.5 threshold ile 10.0 cap → max "fazla ivme" = 7.5 m/s².
# Gerçek sert frenleme/hızlanma için bu fazlasıyla yeterli.
MAX_SINGLE_EVENT_SEVERITY: float = 10.0


# ---------------------------------------------------------------------------
# Temel yardımcılar
# ---------------------------------------------------------------------------

class GpsPoint:
    def __init__(self, lat: float, lon: float, timestamp):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki GPS koordinatı arasındaki mesafeyi metre cinsinden döndürür."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * asin(sqrt(a)) * 6371000


def calculate_speed(distance_m: float, time_s: float) -> float:
    return 0.0 if time_s <= 0 else distance_m / time_s


def smooth_series(values: List[float], window_size: int = 3) -> List[float]:
    """GPS zıplamalarını engellemek için Hareketli Ortalama uygular."""
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
    """
    Sürekli bir zaman serisinden NET olayları ve SINIRLANDIRILMIŞ şiddet
    toplamlarını çıkartır.

    Değişiklik (v6):
        Her event'in peak severity değeri ``max_severity`` ile kısıtlanır.
        Bu sayede tek bir bozuk GPS noktası tüm severity_sum'u patlatamaz.

    Returns
    -------
    (event_count: int, severity_sum: float)
    """
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
                # Olay bitti — severity'yi cap ile sınırla
                severity_sum += min(current_peak_severity, max_severity)
                in_event = False
                current_peak_severity = 0.0

    if in_event:
        severity_sum += min(current_peak_severity, max_severity)

    return event_count, severity_sum


# ---------------------------------------------------------------------------
# Ana özellik çıkarımı
# ---------------------------------------------------------------------------

def extract_trip_features(
    gps_points: List[GpsPoint],
    harsh_accel_threshold: float = 2.5,
    harsh_brake_threshold: float = 2.5,
    speed_limit_mps: float = 25.5,
) -> dict:
    """
    Tek bir kaynaktan uyumlu olay ve metrik çıkarma (Single Source of Truth).

    Düzeltmeler (v6):
        1. GPS outlier filtresi: segment hızı > MAX_PHYSICAL_SPEED_MPS ise
           o segment hem hız hem ivme hesabına dahil edilmez.
        2. İndeks kayması düzeltmesi: accel döngüsü durations[i-1] kullanıyor
           (segment i-1→i'nin süresi, i değil).
        3. dt <= 0 koruması accel döngüsüne de eklendi.
    """
    if len(gps_points) < 2:
        return {}

    # ------------------------------------------------------------------
    # 1. Ham segment hesapları + GPS outlier filtresi
    # ------------------------------------------------------------------
    # valid_* → scoring ve ivme hesabı için (outlier segmentler dahil değil)
    # raw_*   → trip özeti / metadata için (tüm segmentler)
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

        # Her segment ham toplama giriyor (gerçek trip mesafesi/süresi için)
        raw_distances.append(dist)
        raw_durations.append(dt)

        if speed > MAX_PHYSICAL_SPEED_MPS:
            # Outlier: scoring/ivme dizisine dahil edilmiyor.
            # 0.0 enjeksiyonu kaldırıldı — smoothing'i zehirlemesin.
            outlier_count += 1
            continue

        valid_speeds.append(speed)
        valid_distances.append(dist)
        valid_durations.append(dt)

    if not valid_speeds:
        return {}

    # ------------------------------------------------------------------
    # 2. Smoothing — sadece geçerli hızlar üzerinde
    # ------------------------------------------------------------------
    smoothed_speeds = smooth_series(valid_speeds, window_size=3)

    # ------------------------------------------------------------------
    # 3. İvme dizisi + istatistikler
    #
    # smoothed_speeds[i-1] → smoothed_speeds[i] geçişinin süresi
    # valid_durations[i-1]'dir. valid_* dizileri hizalı olduğu için
    # indeks kayması artık mümkün değil.
    # ------------------------------------------------------------------
    accel_array:      List[float] = []
    accel_durations:  List[float] = []   # dt for each accel sample — used for jerk
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
    # 4. Event extraction (artık capped severity ile)
    # ------------------------------------------------------------------
    brake_count, brake_sev_sum = extract_discrete_events(
        accel_array, threshold_negative=-harsh_brake_threshold
    )
    accel_count, accel_sev_sum = extract_discrete_events(
        accel_array, threshold_positive=harsh_accel_threshold
    )

    # ------------------------------------------------------------------
    # 5. Özet istatistikler
    # ------------------------------------------------------------------
    speeds_arr = np.array(smoothed_speeds) if smoothed_speeds else np.array([0.0])

    # Scoring için: outlier segmentler çıkarılmış mesafe/süre
    valid_distance_m = sum(valid_distances)
    valid_duration_s = sum(valid_durations)

    # Trip özeti/metadata için: tüm segmentler (outlier dahil)
    raw_distance_m   = sum(raw_distances)
    raw_duration_s   = sum(raw_durations)

    return {
        # --- Scoring'de kullanılan (outlier temizlenmiş) değerler --------
        "duration_sec":       valid_duration_s,
        "distance_m":         valid_distance_m,

        # --- Hız istatistikleri (valid segmentlerden smoothed hızlar) ----
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

        # --- Ham (outlier dahil) trip özeti — metadata/UI için -----------
        # total_distance_km DB'ye valid_distance_m / 1000 olarak yazılır.
        # Ham değerler şeffaflık için model_metadata içinde saklanır.
        "raw_distance_m":      raw_distance_m,
        "raw_duration_sec":    raw_duration_s,
        "gps_outlier_count":   outlier_count,
        # Segment sayıları — gps_spike_ratio hesabı için doğrudan kaynak.
        # valid_segment_count = len(valid_speeds)  [accel_array'den 1 fazla]
        # raw_segment_count   = valid + outlier    [gerçek toplam]
        "valid_segment_count": len(valid_speeds),
        "raw_segment_count":   len(raw_distances),

        # --- Debug --------------------------------------------------------
        # accel_durations is aligned 1:1 with accel_array.
        # accel_durations[i] = dt of the segment that produced accel_array[i].
        # Used in features_to_anomaly_input() for true jerk (m/s³) calculation.
        "accel_array":        accel_array,
        "accel_durations":    accel_durations,
    }


# ---------------------------------------------------------------------------
# ML / Anomali dönüşüm yardımcıları  (API değişmedi)
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
    """
    extract_trip_features() çıktısını AnomalyDetector.FEATURE_ORDER ile
    birebir eşleşen bir dict'e dönüştürür.

    FEATURE_ORDER (model eğitim sırası — değiştirme):
        gps_spike_ratio, velocity_oscillation, jerk_magnitude,
        accel_intensity, speed_variation_cv, accel_spike_frequency,
        duration_quality, max_accel, min_accel

    Her alanın nasıl türetildiği aşağıda açıklanmıştır.
    """
    hours       = max(features.get("duration_sec", 1) / 3600.0, 0.25)
    accel_count = features.get("accel_event_count", 0)
    brake_count = features.get("brake_event_count", 0)

    # ------------------------------------------------------------------
    # gps_spike_ratio  [0-100 yüzde]
    # Outlier segment oranı. Eşik: detector > 10.0 → GPS_SPIKE flag.
    # raw_segment_count kullanılıyor (accel_array N-1 olduğu için off-by-one
    # üretir — bkz. preprocessing v7 değişiklik notları).
    # ------------------------------------------------------------------
    outlier_count       = features.get("gps_outlier_count", 0)
    total_segment_count = max(features.get("raw_segment_count", 1), 1)
    gps_spike_ratio     = round((outlier_count / total_segment_count) * 100.0, 4)

    # ------------------------------------------------------------------
    # velocity_oscillation  [0-10+ arası normalize değer]
    # Hız standart sapmasının maksimum hıza oranı × 10.
    # Sabit hızda düşük, dalgalı sürüşte yüksek olur.
    # ------------------------------------------------------------------
    velocity_oscillation = (
        features.get("speed_std", 0.0)
        / max(features.get("max_speed_mps", 1.0), 1.0)
    ) * 10.0

    # ------------------------------------------------------------------
    # jerk_magnitude  [m/s³ — gerçek fiziksel jerk]
    # jerk = Δacceleration / Δtime
    # accel_durations, accel_array ile 1:1 hizalı — aynı segment'in dt'si.
    # Segment i için: jerk[i] = |accel[i] - accel[i-1]| / dt[i]
    #
    # Güvenlik notu:
    #   GPS outlier filtresi ve dt <= 0 koruması zaten büyük bozuk değerleri
    #   eliyor. Yine de çok kısa dt'li segmentler (timestamp hassasiyeti
    #   sınırında) jerk'i aşırı büyütebilir. Bu yüzden dt < MIN_JERK_DT_S
    #   olan sample'lar hesaba katılmıyor — sıfıra bölünmek yerine skip.
    # ------------------------------------------------------------------
    MIN_JERK_DT_S = 0.5   # 0.5s altındaki segmentler jerk için güvenilmez

    accel_arr = features.get("accel_array", [])
    accel_dts = features.get("accel_durations", [])
    if len(accel_arr) >= 2 and len(accel_dts) >= 2:
        jerk_values = [
            abs(accel_arr[i] - accel_arr[i - 1]) / accel_dts[i]
            for i in range(1, len(accel_arr))
            if accel_dts[i] >= MIN_JERK_DT_S      # çok kısa segment → skip
        ]
        jerk_magnitude = float(np.mean(jerk_values)) if jerk_values else 0.0
    else:
        jerk_values    = []
        jerk_magnitude = 0.0

    # ------------------------------------------------------------------
    # accel_intensity  [m/s²]
    # Gözlemlenen maksimum mutlak ivme. Sert fren/hızlanmanın şiddetini
    # temsil eder.
    # ------------------------------------------------------------------
    accel_arr_np   = np.array(accel_arr) if accel_arr else np.array([0.0])
    accel_intensity = float(np.max(np.abs(accel_arr_np)))

    # ------------------------------------------------------------------
    # speed_variation_cv  [0-1+ arası varyasyon katsayısı]
    # std / mean — hız tutarsızlığının normalize ölçüsü.
    # Sabit hızda ≈ 0, erratic sürüşte > 1 olabilir.
    # ------------------------------------------------------------------
    avg_speed = features.get("avg_speed_mps", 0.0)
    speed_std  = features.get("speed_std", 0.0)
    speed_variation_cv = (speed_std / max(avg_speed, 0.1))

    # ------------------------------------------------------------------
    # accel_spike_frequency  [olay/saat]
    # Sert hızlanma + sert frenleme olaylarının saatlik sıklığı.
    # ------------------------------------------------------------------
    accel_spike_frequency = (accel_count + brake_count) / hours

    # ------------------------------------------------------------------
    # duration_quality  [0.0 - 1.0]
    # Trip'in ne kadar "güvenilir" GPS verisi içerdiğini gösterir.
    # valid_segment / raw_segment oranı: outlier yoğunsa düşer.
    # ------------------------------------------------------------------
    valid_seg   = features.get("valid_segment_count", total_segment_count - outlier_count)
    duration_quality = round(valid_seg / total_segment_count, 4)

    # ------------------------------------------------------------------
    # max_accel / min_accel  [m/s²]
    # Accel_array'deki gerçek tepe değerler.
    # Eski kod bunları threshold + event_count/hours formülüyle
    # tahmin ediyordu; artık ham veriden okunuyor.
    # ------------------------------------------------------------------
    max_accel = float(np.max(accel_arr_np))
    min_accel = float(np.min(accel_arr_np))

    return {
        # Sıra FEATURE_ORDER ile birebir eşleşiyor
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
        # Aşağıdaki alanlar FEATURE_ORDER'da yok — model feature vector'una
        # girmez. Detector'ın rule engine'i ve debug için kullanılır.
        # ------------------------------------------------------------------
        # max_jerk / min_jerk: detector rule engine için (IMPOSSIBLE_MOTION, JERK_HIGH).
        # FEATURE_ORDER'da yok — model feature vector'una girmiyor.
        "max_jerk":             round(float(np.max(jerk_values)) if jerk_values else 0.0, 4),
        "min_jerk":             round(float(np.min(jerk_values)) if jerk_values else 0.0, 4),
    }