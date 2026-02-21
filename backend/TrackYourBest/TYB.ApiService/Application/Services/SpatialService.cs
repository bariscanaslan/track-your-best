using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Application.Models.Spatial;
using TYB.ApiService.Infrastructure.Data;

namespace TYB.ApiService.Application.Services
{
	public class SpatialService
	{
		private readonly TybDbContext _dbContext;

		public SpatialService(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		public async Task<IReadOnlyList<GpsLastLocationDto>> GetLatestLocationsAsync(
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT DISTINCT ON (g.device_id)
					g.device_id,
					v.id AS vehicle_id,
					g.latitude,
					g.longitude,
					g.gps_timestamp,
					g.received_timestamp,
					v.vehicle_name AS vehicle_name,
					d.device_identifier AS device_identifier
				FROM tyb_spatial.gps_data g
				INNER JOIN tyb_core.vehicles v ON v.device_id = g.device_id
				LEFT JOIN tyb_core.devices d ON d.id = g.device_id
				WHERE g.latitude IS NOT NULL
					AND g.longitude IS NOT NULL
					AND g.latitude BETWEEN -90 AND 90
					AND g.longitude BETWEEN -180 AND 180
					AND NOT (g.latitude = 0 AND g.longitude = 0)
				ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST;
				""";

			var rows = await _dbContext.GpsLastLocations
				.FromSqlRaw(sql)
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			return rows
				.Select(row => new GpsLastLocationDto(
					row.DeviceId,
					row.VehicleId,
					row.VehicleName ?? row.DeviceIdentifier,
					row.Latitude,
					row.Longitude,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}
	}
}
