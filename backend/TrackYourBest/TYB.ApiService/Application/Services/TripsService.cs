using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Spatial;

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

			var lineString = _geometryFactory.CreateLineString(
				route.Coordinates
					.Select(coord => new Coordinate(coord[1], coord[0]))
					.ToArray()
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
				RouteGeometry = lineString,
				Purpose = request.Purpose,
				Notes = request.Notes,
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
					t.Status != TripStatus.Cancelled &&
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
					t.Status != TripStatus.Cancelled &&
					t.Status != TripStatus.Completed
				)
				.OrderByDescending(t => t.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);

			if (trip is null)
			{
				return null;
			}

			trip.Status = TripStatus.Cancelled;
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
				Notes = trip.Notes,
				CreatedAt = trip.CreatedAt,
				Geometry = trip.RouteGeometry is null
					? null
					: trip.RouteGeometry.Coordinates.Select(coord => new[] { coord.Y, coord.X }).ToList()
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
					(t.Status == TripStatus.Completed || t.Status == TripStatus.Cancelled)
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
					&& t.Status != TripStatus.Cancelled
					&& t.Status != TripStatus.Completed,
					cancellationToken
				);
		}
	}
}
