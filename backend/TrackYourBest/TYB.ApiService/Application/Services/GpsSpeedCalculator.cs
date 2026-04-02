namespace TYB.ApiService.Application.Services
{
    /// <summary>
    /// Pure computation service that derives a stable, smoothed current speed from a
    /// short chronological sequence of raw GPS points. Contains no I/O or state.
    ///
    /// Strategy:
    ///   1. Walk consecutive point pairs and compute Haversine distance + time delta.
    ///   2. Reject invalid segments (null timestamps, zero/negative/large time gaps,
    ///      GPS-jitter micro-moves, physically impossible speeds).
    ///   3. Accumulate valid segment distances and durations into a single window.
    ///   4. Derive speed as total_distance / total_time — this is more stable than
    ///      averaging individual segment speeds because it weights by duration.
    ///   5. Apply a jitter-suppression floor: tiny total displacement → return 0 (stopped).
    ///   6. Clamp at MaxPlausibleSpeedKmh and round to one decimal place.
    ///
    /// Trade-offs imposed by the absence of accuracy / hdop / satellite_count columns:
    ///   - Cannot down-weight GPS fixes with poor satellite geometry.
    ///   - Compensate with conservative MinSegmentDistanceMeters and MinWindowDistanceMeters
    ///     thresholds, and a tighter MaxSegmentGapSeconds than typical.
    ///   - A device that emits timestamps with a large jitter or clock drift will still
    ///     occasionally produce a suspicious segment, but the outlier cap handles it.
    /// </summary>
    public sealed class GpsSpeedCalculator
    {
        // Physical upper bound for a road vehicle (km/h).
        // Segments implying a higher speed are treated as GPS noise and discarded.
        private const double MaxPlausibleSpeedKmh = 180.0;

        // Any consecutive pair separated by more than this many seconds (e.g., device
        // reconnect after a tunnel) is not usable for instantaneous speed — skip it.
        private const double MaxSegmentGapSeconds = 30.0;

        // Displacement below this threshold (meters) between two consecutive fixes is
        // indistinguishable from GPS jitter while stationary — skip the segment.
        private const double MinSegmentDistanceMeters = 1.5;

        // If the total displacement across all valid segments in the window is below this
        // (meters), the vehicle is effectively stationary — return 0 rather than a
        // noise-driven near-zero value.
        private const double MinWindowDistanceMeters = 3.0;

        private const double EarthRadiusMeters = 6_371_000.0;

        /// <summary>
        /// A single raw GPS observation used as input to the calculator.
        /// </summary>
        /// <param name="Latitude">WGS-84 latitude in decimal degrees.</param>
        /// <param name="Longitude">WGS-84 longitude in decimal degrees.</param>
        /// <param name="PrimaryTimestamp">gps_timestamp from the device — preferred event time.</param>
        /// <param name="FallbackTimestamp">received_timestamp from the server — used only when the device timestamp is absent.</param>
        public record GpsPoint(
            double Latitude,
            double Longitude,
            DateTime? PrimaryTimestamp,
            DateTime? FallbackTimestamp
        )
        {
            /// <summary>
            /// Effective timestamp: device clock preferred, server receipt time as fallback.
            /// </summary>
            public DateTime? EffectiveTimestamp => PrimaryTimestamp ?? FallbackTimestamp;
        }

        /// <summary>
        /// Computes a smoothed current speed in km/h.
        /// </summary>
        /// <param name="points">
        /// GPS points in strictly chronological order (oldest index 0, newest last).
        /// Must contain at least 2 entries for a result to be possible.
        /// </param>
        /// <returns>
        /// Smoothed speed in km/h rounded to one decimal place, or <c>null</c> if there
        /// are insufficient valid segments to produce a reliable reading.
        /// </returns>
        public double? Compute(IReadOnlyList<GpsPoint> points)
        {
            if (points.Count < 2)
                return null;

            double totalDistanceMeters = 0.0;
            double totalTimeSeconds = 0.0;
            int validSegments = 0;

            for (int i = 1; i < points.Count; i++)
            {
                var prev = points[i - 1];
                var curr = points[i];

                var prevTime = prev.EffectiveTimestamp;
                var currTime = curr.EffectiveTimestamp;

                // Reject: missing timestamp on either end.
                if (prevTime is null || currTime is null)
                    continue;

                double deltaSec = (currTime.Value - prevTime.Value).TotalSeconds;

                // Reject: non-positive delta (clock skew, duplicate message, out-of-order delivery).
                // Reject: gap too large (device reconnect, long tunnel, device off).
                if (deltaSec <= 0.0 || deltaSec > MaxSegmentGapSeconds)
                    continue;

                double distMeters = HaversineMeters(
                    prev.Latitude, prev.Longitude,
                    curr.Latitude, curr.Longitude
                );

                // Reject: sub-threshold displacement — indistinguishable from GPS drift at rest.
                if (distMeters < MinSegmentDistanceMeters)
                    continue;

                double segmentSpeedKmh = (distMeters / deltaSec) * 3.6;

                // Reject: physically implausible segment (GPS multipath / timestamp error).
                if (segmentSpeedKmh > MaxPlausibleSpeedKmh)
                    continue;

                totalDistanceMeters += distMeters;
                totalTimeSeconds += deltaSec;
                validSegments++;
            }

            if (validSegments == 0 || totalTimeSeconds <= 0.0)
                return null;

            // Jitter-suppression floor: negligible total window displacement → report stopped.
            if (totalDistanceMeters < MinWindowDistanceMeters)
                return 0.0;

            // Aggregate speed over the valid window (distance-weighted, more stable than
            // an arithmetic mean of per-segment speeds).
            double speedKmh = (totalDistanceMeters / totalTimeSeconds) * 3.6;

            return Math.Round(Math.Min(speedKmh, MaxPlausibleSpeedKmh), 1);
        }

        // ── Haversine ────────────────────────────────────────────────────────────────

        private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
        {
            double dLat = ToRadians(lat2 - lat1);
            double dLon = ToRadians(lon2 - lon1);

            double a =
                Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2.0) * Math.Sin(dLon / 2.0);

            double c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));

            return EarthRadiusMeters * c;
        }

        private static double ToRadians(double degrees) => degrees * (Math.PI / 180.0);
    }
}
