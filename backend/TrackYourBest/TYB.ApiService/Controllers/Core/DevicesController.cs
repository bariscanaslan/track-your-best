using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	public class DevicesController : ControllerBase
	{
		private readonly CoreService _coreService;

		public DevicesController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet("{deviceId:guid}/information")]
		public async Task<IActionResult> GetDeviceInformation(
			[FromRoute] Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDeviceInformationAsync(deviceId, cancellationToken);
			return Ok(data);
		}
	}
}
