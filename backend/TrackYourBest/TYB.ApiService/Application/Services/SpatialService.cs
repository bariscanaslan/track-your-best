using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using TYB.ApiService.Infrastructure.DTOs.Core;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Core;
using BCrypt.Net;

namespace TYB.ApiService.Application.Services
{
	public class SpatialService
	{
		private readonly TybDbContext _dbContext;

		public SpatialService(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		/// <summary>
		/// Retrieves the latest valid GPS location for each active device in an organization using a safe, parameterized interpolated SQL query. 
		/// It utilizes PostgreSQL's DISTINCT ON feature for efficiency and converts spatial geometry data into WKT strings.
		/// </summary>
		public async Task<IReadOnlyList<DeviceLastLocationDto>> GetLatestDeviceLocationsAsync(
			Guid organizationId,
			CancellationToken cancellationToken
		)
		{
			var rows = await _dbContext.DeviceLastLocations
				.FromSql($"""
					SELECT DISTINCT ON (g.device_id)
						g.device_id,
						v.id AS vehicle_id,
						d.device_name,
						g.trip_id,
						g.location,
						g.latitude,
						g.longitude,
						g.gps_timestamp,
						g.received_timestamp
					FROM tyb_spatial.gps_data g
					INNER JOIN tyb_core.devices d ON d.id = g.device_id
					LEFT JOIN tyb_core.vehicles v ON v.device_id = g.device_id
					WHERE d.organization_id = {organizationId}
						AND d.is_active = TRUE
						AND g.latitude IS NOT NULL
						AND g.longitude IS NOT NULL
						AND g.latitude BETWEEN -90 AND 90
						AND g.longitude BETWEEN -180 AND 180
						AND NOT (g.latitude = 0 AND g.longitude = 0)
					ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
					""")
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			var wktWriter = new WKTWriter();

			return rows
				.Select(row => new DeviceLastLocationDto(
					row.DeviceId,
					row.VehicleId,
					row.DeviceName,
					row.TripId,
					row.Location is null ? null : wktWriter.Write(row.Location),
					row.Latitude,
					row.Longitude,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}

		/// <summary>
		/// Safely executes a parameterized raw SQL query to fetch the latest valid GPS location for a specific driver's device.
		/// It uses EF Core's string interpolation to prevent SQL injection and converts the spatial geometry data into WKT format.
		/// </summary>
		public async Task<IReadOnlyList<DeviceLastLocationDto>> GetLatestDeviceLocationsByDriverAsync(
			Guid driverId,
			Guid organizationId,
			CancellationToken cancellationToken
		)
		{
			var rows = await _dbContext.DeviceLastLocations
				.FromSql($"""
			SELECT DISTINCT ON (g.device_id)
				g.device_id,
				v.id AS vehicle_id,
				dev.device_name,
				g.trip_id,
				g.location,
				g.latitude,
				g.longitude,
				g.gps_timestamp,
				g.received_timestamp
			FROM tyb_core.drivers dr
			INNER JOIN tyb_core.vehicles v ON v.id = dr.vehicle_id
			INNER JOIN tyb_core.devices dev ON dev.id = v.device_id
			INNER JOIN tyb_spatial.gps_data g ON g.device_id = dev.id
			WHERE dr.id = {driverId}
				AND dr.organization_id = {organizationId}
				AND COALESCE(dr.is_active, TRUE) = TRUE
				AND dev.is_active = TRUE
				AND g.latitude IS NOT NULL
				AND g.longitude IS NOT NULL
				AND g.latitude BETWEEN -90 AND 90
				AND g.longitude BETWEEN -180 AND 180
				AND NOT (g.latitude = 0 AND g.longitude = 0)
			ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
			""")
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			var wktWriter = new WKTWriter();

			return rows
				.Select(row => new DeviceLastLocationDto(
					row.DeviceId,
					row.VehicleId,
					row.DeviceName,
					row.TripId,
					row.Location is null ? null : wktWriter.Write(row.Location),
					row.Latitude,
					row.Longitude,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}

		/// <summary>
		/// Safely executes a parameterized raw SQL query to fetch the latest valid GPS location for a specific user's associated device.
		/// It uses EF Core's string interpolation to prevent SQL injection and converts the spatial geometry data into WKT format.
		/// </summary>
		public async Task<IReadOnlyList<DeviceLastLocationDto>> GetLatestDeviceLocationsByUserAsync(
			Guid userId,
			CancellationToken cancellationToken
		)
		{
			var rows = await _dbContext.DeviceLastLocations
				.FromSql($"""
			SELECT DISTINCT ON (g.device_id)
				g.device_id,
				v.id AS vehicle_id,
				dev.device_name,
				g.trip_id,
				g.location,
				g.latitude,
				g.longitude,
				g.gps_timestamp,
				g.received_timestamp
			FROM tyb_core.drivers dr
			INNER JOIN tyb_core.vehicles v ON v.id = dr.vehicle_id
			INNER JOIN tyb_core.devices dev ON dev.id = v.device_id
			INNER JOIN tyb_spatial.gps_data g ON g.device_id = dev.id
			WHERE dr.user_id = {userId}
				AND COALESCE(dr.is_active, TRUE) = TRUE
				AND dev.is_active = TRUE
				AND g.latitude IS NOT NULL
				AND g.longitude IS NOT NULL
				AND g.latitude BETWEEN -90 AND 90
				AND g.longitude BETWEEN -180 AND 180
				AND NOT (g.latitude = 0 AND g.longitude = 0)
			ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
			""")
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			var wktWriter = new WKTWriter();

			return rows
				.Select(row => new DeviceLastLocationDto(
					row.DeviceId,
					row.VehicleId,
					row.DeviceName,
					row.TripId,
					row.Location is null ? null : wktWriter.Write(row.Location),
					row.Latitude,
					row.Longitude,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}

		/// <summary>
		/// Safely executes a parameterized raw SQL query to retrieve the chronologically ordered GPS route points for a specific vehicle within a given time frame.
		/// It uses EF Core's string interpolation to prevent SQL injection and maps the results to DTOs.
		/// </summary>
		public async Task<IReadOnlyList<GpsRoutePointDto>> GetGpsRouteByVehicleAsync(
			Guid vehicleId,
			DateTime start,
			DateTime end,
			CancellationToken cancellationToken
		)
		{
			var rows = await _dbContext.GpsRoutePoints
				.FromSql($"""
			SELECT
				g.latitude,
				g.longitude,
				g.gps_timestamp
			FROM tyb_spatial.gps_data g
			INNER JOIN tyb_core.vehicles v ON v.device_id = g.device_id
			WHERE v.id = {vehicleId}
				AND g.gps_timestamp >= {start}
				AND g.gps_timestamp <= {end}
			ORDER BY g.gps_timestamp ASC
			""")
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			return rows.Select(row => new GpsRoutePointDto(
				row.Latitude,
				row.Longitude,
				row.GpsTimestamp
			)).ToList();
		}
	}
}
