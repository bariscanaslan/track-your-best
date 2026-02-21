using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Spatial
{
	[Route("api/gps-data")]
	[ApiController]
	public class GpsDataController : ControllerBase
	{
		private readonly SpatialService _spatialService;

		public GpsDataController(SpatialService spatialService)
		{
			_spatialService = spatialService;
		}

		[HttpGet("last")]
		public async Task<IActionResult> GetLastLocations(CancellationToken cancellationToken)
		{
			var data = await _spatialService.GetLatestLocationsAsync(cancellationToken);
			return Ok(data);
		}
	}
}
