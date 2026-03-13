using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Spatial
{
	[Route("api/gps")]
	[ApiController]
	public class GpsController : ControllerBase
	{
		private readonly SpatialService _spatialService;

		public GpsController(SpatialService spatialService)
		{
			_spatialService = spatialService;
		}

		[HttpGet("last-location/device-id")]
		public async Task<IActionResult> GetLastLocationsByDeviceId(
			[FromQuery] Guid organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _spatialService.GetLatestDeviceLocationsAsync(organizationId, cancellationToken);
			return Ok(data);
		}

		[HttpGet("last-location/driver/{driverId:guid}")]
		public async Task<IActionResult> GetLastLocationsByDriverId(
			[FromRoute] Guid driverId,
			[FromQuery] Guid organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _spatialService.GetLatestDeviceLocationsByDriverAsync(
				driverId,
				organizationId,
				cancellationToken
			);
			return Ok(data);
		}

		[HttpGet("last-location/user/{userId:guid}")]
		public async Task<IActionResult> GetLastLocationsByUserId(
			[FromRoute] Guid userId,
			CancellationToken cancellationToken
		)
		{
			var data = await _spatialService.GetLatestDeviceLocationsByUserAsync(
				userId,
				cancellationToken
			);
			return Ok(data);
		}

		[HttpGet("route/vehicle/{vehicleId:guid}")]
		public async Task<IActionResult> GetRouteByVehicle(
			[FromRoute] Guid vehicleId,
			[FromQuery] DateTime start,
			[FromQuery] DateTime end,
			CancellationToken cancellationToken
		)
		{
			var data = await _spatialService.GetGpsRouteByVehicleAsync(
				vehicleId,
				start,
				end,
				cancellationToken
			);
			return Ok(data);
		}
	}
}
