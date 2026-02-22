using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Spatial
{
	[Route("api/gps")]
	[ApiController]
	public class GpsController : ControllerBase
	{
		private readonly CoreService _coreService;

		public GpsController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet("last-location/device-id")]
		public async Task<IActionResult> GetLastLocationsByDeviceId(
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetLatestDeviceLocationsAsync(cancellationToken);
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
			var data = await _coreService.GetGpsRouteByVehicleAsync(
				vehicleId,
				start,
				end,
				cancellationToken
			);
			return Ok(data);
		}
	}
}
