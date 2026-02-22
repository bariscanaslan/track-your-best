using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using TYB.ApiService.Infrastructure.DTOs.Core;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;

namespace TYB.ApiService.Application.Services
{
	public class CoreService
	{
		private readonly TybDbContext _dbContext;

		public CoreService(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		public async Task<IReadOnlyList<DeviceLastLocationDto>> GetLatestDeviceLocationsAsync(
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT DISTINCT ON (g.device_id)
					g.device_id,
					v.id AS vehicle_id,
					d.device_name,
					g.trip_id,
					g.location,
					g.latitude,
					g.longitude,
					g.accuracy,
					g.speed,
					g.is_moving,
					g.is_stopped,
					g.gps_timestamp,
					g.received_timestamp
				FROM tyb_spatial.gps_data g
				INNER JOIN tyb_core.devices d ON d.id = g.device_id
				LEFT JOIN tyb_core.vehicles v ON v.device_id = g.device_id
				WHERE g.latitude IS NOT NULL
					AND g.longitude IS NOT NULL
					AND g.latitude BETWEEN -90 AND 90
					AND g.longitude BETWEEN -180 AND 180
					AND NOT (g.latitude = 0 AND g.longitude = 0)
				ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
				""";

			var rows = await _dbContext.DeviceLastLocations
				.FromSqlRaw(sql)
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
					row.Accuracy,
					row.Speed,
					row.IsMoving,
					row.IsStopped,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}

		public async Task<DeviceInfoDto?> GetDeviceInformationAsync(
			Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			var device = await _dbContext.Devices
				.AsNoTracking()
				.FirstOrDefaultAsync(d => d.Id == deviceId, cancellationToken);

			if (device is null)
			{
				return null;
			}

			return new DeviceInfoDto(
				device.OrganizationId,
				device.DeviceName,
				device.DeviceIdentifier,
				device.SignalStrength,
				device.Imei,
				device.IpAddress,
				device.LastSeenAt
			);
		}

		public async Task<VehicleInfoDto?> GetVehicleInformationAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					v.organization_id,
					v.device_id,
					v.vehicle_name,
					v.plate_number,
					v.brand,
					v.model,
					v.year,
					v.color
				FROM tyb_core.vehicles v
				WHERE v.id = {0}
				LIMIT 1
				""";

			var row = await _dbContext.VehicleInformations
				.FromSqlRaw(sql, vehicleId)
				.AsNoTracking()
				.FirstOrDefaultAsync(cancellationToken);

			if (row is null)
			{
				return null;
			}

			return new VehicleInfoDto(
				row.OrganizationId,
				row.DeviceId,
				row.VehicleName,
				row.PlateNumber,
				row.Brand,
				row.Model,
				row.Year,
				row.Color
			);
		}

		public async Task<DriverInfoDto?> GetDriverInformationByVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					d.organization_id,
					d.user_id,
					d.vehicle_id,
					u.full_name,
					u.phone,
					u.avatar_url
				FROM tyb_core.drivers d
				LEFT JOIN tyb_core.users u ON u.id = d.user_id
				WHERE d.vehicle_id = {0}
				ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
				LIMIT 1
				""";

			var row = await _dbContext.DriverInformations
				.FromSqlRaw(sql, vehicleId)
				.AsNoTracking()
				.FirstOrDefaultAsync(cancellationToken);

			if (row is null)
			{
				return null;
			}

			return new DriverInfoDto(
				row.OrganizationId,
				row.UserId,
				row.VehicleId,
				row.FullName,
				row.Phone,
				row.AvatarUrl
			);
		}

		public async Task<IReadOnlyList<GpsRoutePointDto>> GetGpsRouteByVehicleAsync(
			Guid vehicleId,
			DateTime start,
			DateTime end,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					g.latitude,
					g.longitude,
					g.gps_timestamp
				FROM tyb_spatial.gps_data g
				INNER JOIN tyb_core.vehicles v ON v.device_id = g.device_id
				WHERE v.id = {0}
					AND g.gps_timestamp >= {1}
					AND g.gps_timestamp <= {2}
				ORDER BY g.gps_timestamp ASC
				""";

			var rows = await _dbContext.GpsRoutePoints
				.FromSqlRaw(sql, vehicleId, start, end)
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
