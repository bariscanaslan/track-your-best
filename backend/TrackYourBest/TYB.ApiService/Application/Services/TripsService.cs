using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Spatial;
using TYB.ApiService.Infrastructure.Entities.Core;
using TYB.ApiService.Application.Services.Routing;

namespace TYB.ApiService.Application.Services
{
	public class TripsService
	{
		private readonly TybDbContext _dbContext;
		private readonly OsrmService _osrmService;
		private readonly NominatimService _nominatimService;
		private readonly GeometryFactory _geometryFactory;

		public TripsService(
			TybDbContext dbContext,
			OsrmService osrmService,
			NominatimService nominatimService
		)
		{
			_dbContext = dbContext;
			_osrmService = osrmService;
			_nominatimService = nominatimService;
			_geometryFactory = NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
		}

		public async Task<TripPlanResponse> PlanTripAsync(
			TripPlanRequest request,
			CancellationToken cancellationToken
		)
		{
			var route = await _osrmService.GetRouteAsync(
				request.StartLat,
				request.StartLng,
				request.EndLat,
				request.EndLng,
				cancellationToken
			);

			return new TripPlanResponse
			{
				TripId = Guid.Empty,
				DistanceKm = route.DistanceMeters / 1000.0,
				DurationSeconds = (int)Math.Round(route.DurationSeconds),
				Geometry = route.Coordinates
			};
		}

		public async Task<TripPlanResponse> ApproveTripAsync(
			TripPlanRequest request,
			CancellationToken cancellationToken
		)
		{
			if (await HasActiveTripForVehicleAsync(request.VehicleId, cancellationToken))
			{
				throw new InvalidOperationException("Vehicle already has an active trip.");
			}

			var route = await _osrmService.GetRouteAsync(
				request.StartLat,
				request.StartLng,
				request.EndLat,
				request.EndLng,
				cancellationToken
			);

			var startAddress = await ResolveAddressAsync(
				request.StartLat,
				request.StartLng,
				request.StartAddress,
				cancellationToken
			);
			var endAddress = await ResolveAddressAsync(
				request.EndLat,
				request.EndLng,
				request.EndAddress,
				cancellationToken
			);

			var plannedEndTime = request.PlannedEndTime
				?? DateTime.UtcNow.AddSeconds(route.DurationSeconds);

			var trip = new Trip
			{
				VehicleId = request.VehicleId,
				DriverId = request.DriverId,
				TripName = request.TripName,
				Status = TripStatus.DriverApprove,
				StartLocation = _geometryFactory.CreatePoint(new Coordinate(request.StartLng, request.StartLat)),
				EndLocation = _geometryFactory.CreatePoint(new Coordinate(request.EndLng, request.EndLat)),
				StartAddress = startAddress,
				EndAddress = endAddress,
				StartTime = DateTime.UtcNow,
				PlannedEndTime = plannedEndTime,
				DurationSeconds = (int)Math.Round(route.DurationSeconds),
				TotalDistanceKm = (decimal)(route.DistanceMeters / 1000.0),
				RouteGeometry = BuildLineString(route.Coordinates),
                Notes = request.Notes,
                PauseCount = 0,
				CreatedAt = DateTime.UtcNow,
				UpdatedAt = DateTime.UtcNow
			};

			_dbContext.Trips.Add(trip);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new TripPlanResponse
			{
				TripId = trip.Id,
				DistanceKm = route.DistanceMeters / 1000.0,
				DurationSeconds = (int)Math.Round(route.DurationSeconds),
				Geometry = route.Coordinates
			};
		}

		public async Task<IReadOnlyList<TripSummaryDto>> GetTripsForDriverAsync(
			Guid driverId,
			CancellationToken cancellationToken
		)
		{
			var wktWriter = new WKTWriter();
			var trips = await _dbContext.Trips
				.AsNoTracking()
				.Where(trip => trip.DriverId == driverId)
				.OrderByDescending(trip => trip.CreatedAt)
				.ToListAsync(cancellationToken);

			return trips.Select(trip => new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			}).ToList();
		}

		public async Task<TripSummaryDto?> GetActiveTripForVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var wktWriter = new WKTWriter();
			var trip = await _dbContext.Trips
				.AsNoTracking()
				.Where(t =>
					t.VehicleId == vehicleId &&
					t.Status != TripStatus.CancelledFm &&
					t.Status != TripStatus.CancelledDriver &&
					t.Status != TripStatus.Completed
				)
				.OrderByDescending(t => t.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);

			if (trip is null)
			{
				return null;
			}

			return new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			};
		}

		public async Task<TripSummaryDto?> CancelActiveTripForVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var wktWriter = new WKTWriter();
			var trip = await _dbContext.Trips
				.Where(t =>
					t.VehicleId == vehicleId &&
					t.Status != TripStatus.CancelledFm &&
					t.Status != TripStatus.CancelledDriver &&
					t.Status != TripStatus.Completed
				)
				.OrderByDescending(t => t.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);

			if (trip is null)
			{
				return null;
			}

			trip.Status = TripStatus.CancelledFm;
			trip.EndTime = DateTime.UtcNow;
			trip.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			};
		}

		public async Task<TripSummaryDto?> DecideTripByDriverAsync(
			Guid tripId,
			DriverTripDecisionRequest request,
			CancellationToken cancellationToken
		)
		{
			var decision = (request.Decision ?? string.Empty).Trim().ToLowerInvariant();
			var isAccepted = decision == "accepted";
			var isRejected = decision == "rejected";

			if (!isAccepted && !isRejected)
			{
				throw new InvalidOperationException("Decision must be 'accepted' or 'rejected'.");
			}

			if (isRejected && string.IsNullOrWhiteSpace(request.Notes))
			{
				throw new InvalidOperationException("Rejection note is required.");
			}

			var trip = await _dbContext.Trips
				.FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);

			if (trip is null)
			{
				return null;
			}

			if (trip.Status != TripStatus.DriverApprove)
			{
				throw new InvalidOperationException("Only driver_approve trips can be decided by driver.");
			}

			trip.Status = isAccepted ? TripStatus.Ongoing : TripStatus.CancelledDriver;
			trip.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
			trip.UpdatedAt = DateTime.UtcNow;
			if (isRejected)
			{
				trip.EndTime = DateTime.UtcNow;
			}

			await _dbContext.SaveChangesAsync(cancellationToken);

			var wktWriter = new WKTWriter();
			return new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			};
		}

		public async Task<TripSummaryDto?> ApplyDriverTripActionAsync(
			Guid tripId,
			DriverTripActionRequest request,
			CancellationToken cancellationToken
		)
		{
			var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();

			var trip = await _dbContext.Trips
				.FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);

			if (trip is null)
			{
				return null;
			}

			switch (action)
			{
				case "pause":
					if (trip.Status != TripStatus.Ongoing)
					{
						throw new InvalidOperationException("Only ongoing trips can be paused.");
					}
					trip.Status = TripStatus.Paused;
					trip.PauseCount = (trip.PauseCount ?? 0) + 1;
					break;
				case "continue":
					if (trip.Status != TripStatus.Paused)
					{
						throw new InvalidOperationException("Only paused trips can continue.");
					}
					trip.Status = TripStatus.Ongoing;
					break;
				case "finish":
					if (trip.Status != TripStatus.Ongoing && trip.Status != TripStatus.Paused)
					{
						throw new InvalidOperationException("Only ongoing or paused trips can be finished.");
					}
					trip.Status = TripStatus.Completed;
					trip.EndTime = DateTime.UtcNow;
					break;
				case "cancel":
					if (trip.Status != TripStatus.Ongoing && trip.Status != TripStatus.Paused)
					{
						throw new InvalidOperationException("Only ongoing or paused trips can be cancelled by driver.");
					}
					if (string.IsNullOrWhiteSpace(request.Notes))
					{
						throw new InvalidOperationException("Cancellation note is required.");
					}
					trip.Status = TripStatus.CancelledDriver;
					trip.Notes = request.Notes.Trim();
					trip.EndTime = DateTime.UtcNow;
					break;
				default:
					throw new InvalidOperationException("Action must be pause, continue, finish, or cancel.");
			}

			trip.UpdatedAt = DateTime.UtcNow;
			await _dbContext.SaveChangesAsync(cancellationToken);

			var wktWriter = new WKTWriter();
			return new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			};
		}

		public async Task<DriverTripFinishCheckResponse?> CheckDriverFinishDistanceAsync(
			Guid tripId,
			double currentLat,
			double currentLng,
			CancellationToken cancellationToken
		)
		{
			var trip = await _dbContext.Trips
				.AsNoTracking()
				.FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);

			if (trip is null || trip.EndLocation is null)
			{
				return null;
			}

			var endLat = trip.EndLocation.Y;
			var endLng = trip.EndLocation.X;

			var route = await _osrmService.GetRouteAsync(
				currentLat,
				currentLng,
				endLat,
				endLng,
				cancellationToken
			);

			var distanceKm = route.DistanceMeters / 1000.0;
			return new DriverTripFinishCheckResponse
			{
				DistanceKm = distanceKm,
				ShouldWarn = distanceKm > 3.0
			};
		}

		public async Task<IReadOnlyList<TripSummaryDto>> GetPastTripsForVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var wktWriter = new WKTWriter();
			var trips = await _dbContext.Trips
				.AsNoTracking()
				.Where(t =>
					t.VehicleId == vehicleId &&
					(
						t.Status == TripStatus.Completed ||
						t.Status == TripStatus.CancelledFm ||
						t.Status == TripStatus.CancelledDriver
					)
				)
				.OrderByDescending(t => t.UpdatedAt ?? t.CreatedAt)
				.Take(20)
				.ToListAsync(cancellationToken);

			return trips.Select(trip => new TripSummaryDto
			{
				Id = trip.Id,
				VehicleId = trip.VehicleId,
				TripName = trip.TripName,
				Status = trip.Status?.ToString(),
				StartLocation = trip.StartLocation is null ? null : wktWriter.Write(trip.StartLocation),
				EndLocation = trip.EndLocation is null ? null : wktWriter.Write(trip.EndLocation),
				StartAddress = trip.StartAddress,
				EndAddress = trip.EndAddress,
				StartTime = trip.StartTime,
				EndTime = trip.EndTime,
				PlannedEndTime = trip.PlannedEndTime,
				DurationSeconds = trip.DurationSeconds,
				TotalDistanceKm = (double?)trip.TotalDistanceKm,
				MaxSpeed = (double?)trip.MaxSpeed,
				AvgSpeed = (double?)trip.AvgSpeed,
				StopCount = trip.StopCount,
                PauseCount = trip.PauseCount,
                Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
			}).ToList();
		}

		private async Task<string?> ResolveAddressAsync(
			double latitude,
			double longitude,
			string? providedAddress,
			CancellationToken cancellationToken
		)
		{
			if (!string.IsNullOrWhiteSpace(providedAddress))
			{
				return providedAddress.Trim();
			}

			try
			{
				return await _nominatimService.ReverseGeocodeAsync(latitude, longitude, cancellationToken);
			}
			catch
			{
				return null;
			}
		}

		public async Task<bool> HasActiveTripForVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			return await _dbContext.Trips
				.AsNoTracking()
				.AnyAsync(t =>
					t.VehicleId == vehicleId
					&& t.Status != TripStatus.CancelledFm
					&& t.Status != TripStatus.CancelledDriver
					&& t.Status != TripStatus.Completed,
					cancellationToken
				);
		}

		public async Task<TripRouteRefreshResult?> RefreshRouteFromCurrentPositionAsync(
			Guid tripId,
			double currentLat,
			double currentLng,
			CancellationToken cancellationToken)
		{
			var trip = await _dbContext.Trips
				.FirstOrDefaultAsync(t => t.Id == tripId, cancellationToken);

			if (trip is null
				|| trip.EndLocation is null
				|| (trip.Status != TripStatus.Ongoing && trip.Status != TripStatus.Paused))
			{
				return null;
			}

			var route = await _osrmService.GetRouteAsync(
				currentLat,
				currentLng,
				trip.EndLocation.Y,
				trip.EndLocation.X,
				cancellationToken);

			trip.RouteGeometry = BuildLineString(route.Coordinates);
			trip.TotalDistanceKm = (decimal)(route.DistanceMeters / 1000.0);
			trip.DurationSeconds = (int)Math.Round(route.DurationSeconds);
			trip.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new TripRouteRefreshResult(
				trip.Id,
				decimal.ToDouble(trip.TotalDistanceKm ?? 0m),
				trip.DurationSeconds ?? 0);
		}

		private static string TripStatusToString(TripStatus status) => status switch
		{
			TripStatus.DriverApprove => "driver_approve",
			TripStatus.Ongoing => "ongoing",
			TripStatus.Paused => "paused",
			TripStatus.Completed => "completed",
			TripStatus.CancelledFm => "cancelled_fm",
			TripStatus.CancelledDriver => "cancelled_driver",
			_ => status.ToString().ToLower()
		};

		public async Task<IReadOnlyList<TripAdminSummaryDto>> GetAllTripsAsync(
			CancellationToken cancellationToken
		)
		{
			var trips = await (
				from trip in _dbContext.Trips.AsNoTracking()
				join vehicle in _dbContext.Vehicles.AsNoTracking() on trip.VehicleId equals vehicle.Id into vehicleJoin
				from vehicle in vehicleJoin.DefaultIfEmpty()
				join driver in _dbContext.Drivers.AsNoTracking() on trip.DriverId equals driver.Id into driverJoin
				from driver in driverJoin.DefaultIfEmpty()
				join user in _dbContext.Users.AsNoTracking() on driver.UserId equals user.Id into userJoin
				from user in userJoin.DefaultIfEmpty()
				join org in _dbContext.Organizations.AsNoTracking() on vehicle.OrganizationId equals org.Id into orgJoin
				from org in orgJoin.DefaultIfEmpty()
				orderby trip.CreatedAt descending
				select new
				{
					trip.Id,
					trip.VehicleId,
					VehicleName = vehicle != null ? vehicle.VehicleName : null,
					trip.DriverId,
					DriverName = user != null ? user.FullName : null,
					OrganizationId = vehicle != null ? vehicle.OrganizationId : null,
					OrganizationName = org != null ? org.Name : null,
					trip.TripName,
					trip.Status,
					OriginAddress = trip.StartAddress,
					DestinationAddress = trip.EndAddress,
					StartedAt = trip.StartTime,
					EndedAt = trip.EndTime,
					DistanceKm = trip.TotalDistanceKm.HasValue ? (double?)decimal.ToDouble(trip.TotalDistanceKm.Value) : null,
					trip.CreatedAt,
				}
			).ToListAsync(cancellationToken);

			return trips.Select(t => new TripAdminSummaryDto
			{
				Id = t.Id,
				VehicleId = t.VehicleId,
				VehicleName = t.VehicleName,
				DriverId = t.DriverId,
				DriverName = t.DriverName,
				OrganizationId = t.OrganizationId,
				OrganizationName = t.OrganizationName,
				TripName = t.TripName,
				Status = t.Status.HasValue ? TripStatusToString(t.Status.Value) : null,
				OriginAddress = t.OriginAddress,
				DestinationAddress = t.DestinationAddress,
				StartedAt = t.StartedAt,
				EndedAt = t.EndedAt,
				DistanceKm = t.DistanceKm,
				CreatedAt = t.CreatedAt,
			}).ToList();
		}

		private LineString BuildLineString(IReadOnlyList<double[]> coordinates)
		{
			return _geometryFactory.CreateLineString(
				coordinates
					.Select(coord => new Coordinate(coord[1], coord[0]))
					.ToArray());
		}
	}

	public record TripRouteRefreshResult(
		Guid TripId,
		double DistanceKm,
		int DurationSeconds);
}





