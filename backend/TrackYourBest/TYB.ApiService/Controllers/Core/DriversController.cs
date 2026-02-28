using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Core;

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

		[HttpGet]
		public async Task<IActionResult> GetDrivers(
			[FromQuery] Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDriversAsync(organizationId, cancellationToken);
			return Ok(data);
		}

		[HttpGet("{driverId:guid}")]
		public async Task<IActionResult> GetDriverById(
			[FromRoute] Guid driverId,
			[FromQuery] Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetDriverByIdAsync(driverId, organizationId, cancellationToken);
			return data is null ? NotFound() : Ok(data);
		}

		[HttpPost]
		public async Task<IActionResult> CreateDriver(
			[FromBody] DriverUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			if (request.UserId is null)
			{
				if (string.IsNullOrWhiteSpace(request.Username)
					|| string.IsNullOrWhiteSpace(request.Email)
					|| string.IsNullOrWhiteSpace(request.FullName)
					|| request.OrganizationId is null)
				{
					return BadRequest("Username, Email, FullName, and OrganizationId are required to create a user.");
				}
			}

			var created = await _coreService.CreateDriverAsync(request, cancellationToken);
			return CreatedAtAction(nameof(GetDrivers), new { driverId = created?.Id }, created);
		}

		[HttpPut("{driverId:guid}")]
		public async Task<IActionResult> UpdateDriver(
			[FromRoute] Guid driverId,
			[FromBody] DriverUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var updated = await _coreService.UpdateDriverAsync(driverId, request, cancellationToken);
			return updated is null ? NotFound() : Ok(updated);
		}

		[HttpDelete("{driverId:guid}")]
		public async Task<IActionResult> DeleteDriver(
			[FromRoute] Guid driverId,
			CancellationToken cancellationToken
		)
		{
			var removed = await _coreService.DeleteDriverAsync(driverId, cancellationToken);
			return removed ? NoContent() : NotFound();
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
