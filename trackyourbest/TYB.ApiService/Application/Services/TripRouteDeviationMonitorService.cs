using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;

namespace TYB.ApiService.Application.Services
{
	public class TripRouteDeviationMonitorService
	{
		private const double RouteToleranceMeters = 150d;
		private const int RequiredConsecutiveOffRouteChecks = 2;
		private static readonly TimeSpan GpsFreshnessWindow = TimeSpan.FromMinutes(2);
		private static readonly TimeSpan RouteRefreshInterval = TimeSpan.FromSeconds(20);
		private const double MinimumMovementForRefreshMeters = 20d;
		private static readonly TimeSpan StateCacheTtl = TimeSpan.FromHours(12);
		private const string CacheKeyPrefix = "trip-route-monitor:";

		private readonly TybDbContext _dbContext;
		private readonly TripsService _tripsService;
		private readonly IMemoryCache _memoryCache;
		private readonly ILogger<TripRouteDeviationMonitorService> _logger;

		public TripRouteDeviationMonitorService(
			TybDbContext dbContext,
			TripsService tripsService,
			IMemoryCache memoryCache,
			ILogger<TripRouteDeviationMonitorService> logger)
		{
			_dbContext = dbContext;
			_tripsService = tripsService;
			_memoryCache = memoryCache;
			_logger = logger;
		}

		public async Task EvaluateActiveTripsAsync(CancellationToken cancellationToken)
		{
			var candidates = await LoadActiveTripCandidatesAsync(cancellationToken);

			foreach (var candidate in candidates)
			{
				cancellationToken.ThrowIfCancellationRequested();
				try
				{
					await EvaluateCandidateAsync(candidate, cancellationToken);
				}
				catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
				{
					throw;
				}
				catch (Exception ex)
				{
					_logger.LogError(ex, "Failed to evaluate deviation for trip {TripId}.", candidate.TripId);
				}
			}
		}

		private async Task<List<TripDeviationCandidateRow>> LoadActiveTripCandidatesAsync(
			CancellationToken cancellationToken)
		{
			var gpsCutoff = DateTime.UtcNow.Subtract(GpsFreshnessWindow);

			return await _dbContext.TripDeviationCandidates
				.FromSql($"""
					SELECT
						t.id AS trip_id,
						t.vehicle_id,
						v.device_id,
						t.end_location,
						t.route_geometry,
						latest.latitude,
						latest.longitude,
						latest.position_timestamp,
						latest.distance_to_route_meters
					FROM tyb_spatial.trips t
					INNER JOIN tyb_core.vehicles v ON v.id = t.vehicle_id
					INNER JOIN LATERAL (
						SELECT
							g.latitude,
							g.longitude,
							COALESCE(g.gps_timestamp, g.received_timestamp) AS position_timestamp,
							ST_Distance(g.location, t.route_geometry::geography) AS distance_to_route_meters
						FROM tyb_spatial.gps_data g
						WHERE g.device_id = v.device_id
							AND (
								g.gps_timestamp >= {gpsCutoff}
								OR (g.gps_timestamp IS NULL AND g.received_timestamp >= {gpsCutoff})
							)
							AND g.latitude BETWEEN -90 AND 90
							AND g.longitude BETWEEN -180 AND 180
							AND NOT (g.latitude = 0 AND g.longitude = 0)
						ORDER BY g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
						LIMIT 1
					) latest ON TRUE
					WHERE t.status IN ('ongoing'::trip_status, 'paused'::trip_status)
						AND t.vehicle_id IS NOT NULL
						AND v.device_id IS NOT NULL
						AND t.end_location IS NOT NULL
						AND t.route_geometry IS NOT NULL
					""")
				.AsNoTracking()
				.ToListAsync(cancellationToken);
		}

		private async Task EvaluateCandidateAsync(
			TripDeviationCandidateRow candidate,
			CancellationToken cancellationToken)
		{
			if (candidate.EndLocation is null)
			{
				_logger.LogDebug("Skipping trip {TripId}: destination is missing.", candidate.TripId);
				ResetState(candidate.TripId);
				return;
			}

			if (candidate.RouteGeometry is null || candidate.RouteGeometry.IsEmpty)
			{
				_logger.LogDebug("Skipping trip {TripId}: route geometry is missing.", candidate.TripId);
				ResetState(candidate.TripId);
				return;
			}

			if (!IsValidCoordinate(candidate.Latitude, candidate.Longitude))
			{
				_logger.LogWarning(
					"Skipping trip {TripId}: invalid GPS coordinate ({Latitude}, {Longitude}).",
					candidate.TripId,
					candidate.Latitude,
					candidate.Longitude);
				ResetState(candidate.TripId);
				return;
			}

			var state = GetState(candidate.TripId);
			var positionTimestamp = NormalizeUtc(candidate.PositionTimestamp);

			if (state.LastProcessedPositionTimestamp.HasValue
				&& positionTimestamp <= state.LastProcessedPositionTimestamp.Value)
			{
				_logger.LogDebug(
					"Skipping trip {TripId}: no fresh GPS point since {PositionTimestamp:o}.",
					candidate.TripId,
					state.LastProcessedPositionTimestamp.Value);
				return;
			}

			state.LastProcessedPositionTimestamp = positionTimestamp;

			if (candidate.DistanceToRouteMeters <= RouteToleranceMeters)
			{
				if (state.OffRouteConsecutiveCount > 0)
				{
					_logger.LogDebug(
						"Trip {TripId} returned inside route corridor at {DistanceMeters:F1} m. Resetting deviation confidence.",
						candidate.TripId,
						candidate.DistanceToRouteMeters);
				}

				state.ResetDeviation();
				if (!state.ShouldRefreshRoute(now: DateTime.UtcNow, candidate.Latitude, candidate.Longitude))
				{
					StoreState(candidate.TripId, state);
					return;
				}

				var onRouteRefreshResult = await _tripsService.RefreshRouteFromCurrentPositionAsync(
					candidate.TripId,
					candidate.Latitude,
					candidate.Longitude,
					cancellationToken);

				if (onRouteRefreshResult is null)
				{
					ResetState(candidate.TripId);
					return;
				}

				state.MarkRouteRefreshed(DateTime.UtcNow, candidate.Latitude, candidate.Longitude);
				StoreState(candidate.TripId, state);

				_logger.LogInformation(
					"Refreshed active route for trip {TripId} while vehicle is progressing on-route. Distance={DistanceKm:F2} km, Duration={DurationSeconds}s.",
					candidate.TripId,
					onRouteRefreshResult.DistanceKm,
					onRouteRefreshResult.DurationSeconds);
				return;
			}

			var now = DateTime.UtcNow;
			state.RegisterOffRoute(now, candidate.DistanceToRouteMeters);

			_logger.LogInformation(
				"Trip {TripId} off-route evaluation {Attempt}/{Required}. Distance to planned route: {DistanceMeters:F1} m.",
				candidate.TripId,
				state.OffRouteConsecutiveCount,
				RequiredConsecutiveOffRouteChecks,
				candidate.DistanceToRouteMeters);

			if (state.OffRouteConsecutiveCount < RequiredConsecutiveOffRouteChecks
				|| !state.ShouldRefreshRoute(now, candidate.Latitude, candidate.Longitude))
			{
				StoreState(candidate.TripId, state);
				return;
			}

			var rerouteResult = await _tripsService.RefreshRouteFromCurrentPositionAsync(
				candidate.TripId,
				candidate.Latitude,
				candidate.Longitude,
				cancellationToken);

			if (rerouteResult is null)
			{
				_logger.LogWarning(
					"Skipping reroute for trip {TripId}: trip is no longer active or destination is unavailable.",
					candidate.TripId);
				ResetState(candidate.TripId);
				return;
			}

			var offRouteDuration = now - (state.FirstOffRouteDetectedAt ?? now);
			state.MarkRouteRefreshed(now, candidate.Latitude, candidate.Longitude);
			StoreState(candidate.TripId, state);

			_logger.LogInformation(
				"Rerouted trip {TripId} from current position. Distance={DistanceKm:F2} km, Duration={DurationSeconds}s, Sustained off-route for {OffRouteDuration}.",
				candidate.TripId,
				rerouteResult.DistanceKm,
				rerouteResult.DurationSeconds,
				offRouteDuration);
		}

		private static bool IsValidCoordinate(double latitude, double longitude)
		{
			return latitude is >= -90 and <= 90
				&& longitude is >= -180 and <= 180
				&& !(latitude == 0 && longitude == 0);
		}

		private static DateTime NormalizeUtc(DateTime timestamp)
		{
			return timestamp.Kind switch
			{
				DateTimeKind.Utc => timestamp,
				DateTimeKind.Local => timestamp.ToUniversalTime(),
				_ => DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)
			};
		}

		private TripRouteDeviationState GetState(Guid tripId)
		{
			if (_memoryCache.TryGetValue(BuildCacheKey(tripId), out TripRouteDeviationState? existing)
				&& existing is not null)
			{
				return existing;
			}

			return new TripRouteDeviationState();
		}

		private void StoreState(Guid tripId, TripRouteDeviationState state)
		{
			_memoryCache.Set(BuildCacheKey(tripId), state, StateCacheTtl);
		}

		private void ResetState(Guid tripId)
		{
			_memoryCache.Remove(BuildCacheKey(tripId));
		}

		private static string BuildCacheKey(Guid tripId) => $"{CacheKeyPrefix}{tripId:D}";

		private sealed class TripRouteDeviationState
		{
			public int OffRouteConsecutiveCount { get; private set; }
			public DateTime? FirstOffRouteDetectedAt { get; private set; }
			public DateTime? LastRouteRefreshAt { get; private set; }
			public DateTime? LastProcessedPositionTimestamp { get; set; }
			public double? LastOffRouteDistanceMeters { get; private set; }
			public double? LastRouteRefreshLatitude { get; private set; }
			public double? LastRouteRefreshLongitude { get; private set; }

			public void RegisterOffRoute(DateTime detectedAtUtc, double distanceToRouteMeters)
			{
				OffRouteConsecutiveCount++;
				FirstOffRouteDetectedAt ??= detectedAtUtc;
				LastOffRouteDistanceMeters = distanceToRouteMeters;
			}

			public bool ShouldRefreshRoute(DateTime now, double latitude, double longitude)
			{
				if (!LastRouteRefreshAt.HasValue)
				{
					return true;
				}

				if (now - LastRouteRefreshAt.Value < RouteRefreshInterval)
				{
					return false;
				}

				if (!LastRouteRefreshLatitude.HasValue || !LastRouteRefreshLongitude.HasValue)
				{
					return true;
				}

				return HaversineDistanceMeters(
					LastRouteRefreshLatitude.Value,
					LastRouteRefreshLongitude.Value,
					latitude,
					longitude) >= MinimumMovementForRefreshMeters;
			}

			public void MarkRouteRefreshed(DateTime refreshedAtUtc, double latitude, double longitude)
			{
				LastRouteRefreshAt = refreshedAtUtc;
				LastRouteRefreshLatitude = latitude;
				LastRouteRefreshLongitude = longitude;
				ResetDeviation();
			}

			public void ResetDeviation()
			{
				OffRouteConsecutiveCount = 0;
				FirstOffRouteDetectedAt = null;
				LastOffRouteDistanceMeters = null;
			}

			private static double HaversineDistanceMeters(
				double startLatitude,
				double startLongitude,
				double endLatitude,
				double endLongitude)
			{
				const double earthRadiusMeters = 6371000d;
				var latDelta = DegreesToRadians(endLatitude - startLatitude);
				var lonDelta = DegreesToRadians(endLongitude - startLongitude);
				var startLatRad = DegreesToRadians(startLatitude);
				var endLatRad = DegreesToRadians(endLatitude);

				var a =
					Math.Sin(latDelta / 2) * Math.Sin(latDelta / 2) +
					Math.Cos(startLatRad) * Math.Cos(endLatRad) *
					Math.Sin(lonDelta / 2) * Math.Sin(lonDelta / 2);

				var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
				return earthRadiusMeters * c;
			}

			private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;
		}
	}
}
