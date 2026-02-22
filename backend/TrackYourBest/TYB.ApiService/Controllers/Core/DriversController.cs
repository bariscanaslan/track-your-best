using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	public class DriversController : ControllerBase
	{
		private readonly CoreService _coreService;

		public DriversController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet("vehicle/{vehicleId:guid}")]
		public async Task<IActionResult> GetDriverByVehicle(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDriverInformationByVehicleAsync(
				vehicleId,
				cancellationToken
			);
			return Ok(data);
		}
	}
}
