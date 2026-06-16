using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Authorization;
using TYB.ApiService.Infrastructure.DTOs.Core;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	[AnyRole]
	public class DevicesController : ControllerBase
	{
		private readonly CoreService _coreService;

		public DevicesController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet]
		public async Task<IActionResult> GetDevices(
			[FromQuery] Guid? organizationId,
			[FromQuery] bool? onlyActive,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDevicesAsync(organizationId, onlyActive, cancellationToken);
			return Ok(data);
		}

		[HttpPost]
		public async Task<IActionResult> CreateDevice(
			[FromBody] DeviceUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var created = await _coreService.CreateDeviceAsync(request, cancellationToken);
			return CreatedAtAction(nameof(GetDeviceInformation), new { deviceId = created?.Id }, created);
		}

		[HttpPut("{deviceId:guid}")]
		public async Task<IActionResult> UpdateDevice(
			[FromRoute] Guid deviceId,
			[FromBody] DeviceUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var updated = await _coreService.UpdateDeviceAsync(deviceId, request, cancellationToken);
			return updated is null ? NotFound() : Ok(updated);
		}

		[HttpDelete("{deviceId:guid}")]
		public async Task<IActionResult> DeleteDevice(
			[FromRoute] Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			var removed = await _coreService.DeleteDeviceAsync(deviceId, cancellationToken);
			return removed ? NoContent() : NotFound();
		}

		[HttpGet("{deviceId:guid}")]
		public async Task<IActionResult> GetDevice(
			[FromRoute] Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDeviceByIdAsync(deviceId, cancellationToken);
			return data is null ? NotFound() : Ok(data);
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
