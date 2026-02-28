using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Core;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	public class VehiclesController : ControllerBase
	{
		private readonly CoreService _coreService;

		public VehiclesController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet]
		public async Task<IActionResult> GetVehicles(
			[FromQuery] Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetVehiclesAsync(organizationId, cancellationToken);
			return Ok(data);
		}

		[HttpGet("{vehicleId:guid}")]
		public async Task<IActionResult> GetVehicleById(
			[FromRoute] Guid vehicleId,
			[FromQuery] Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetVehicleByIdAsync(vehicleId, organizationId, cancellationToken);
			return data is null ? NotFound() : Ok(data);
		}

		[HttpPost]
		public async Task<IActionResult> CreateVehicle(
			[FromBody] VehicleUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var created = await _coreService.CreateVehicleAsync(request, cancellationToken);
			return CreatedAtAction(
				nameof(GetVehicleById),
				new { vehicleId = created?.Id, organizationId = request.OrganizationId },
				created
			);
		}

		[HttpPut("{vehicleId:guid}")]
		public async Task<IActionResult> UpdateVehicle(
			[FromRoute] Guid vehicleId,
			[FromBody] VehicleUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var updated = await _coreService.UpdateVehicleAsync(vehicleId, request, cancellationToken);
				return updated is null ? NotFound() : Ok(updated);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}

		[HttpDelete("{vehicleId:guid}")]
		public async Task<IActionResult> DeleteVehicle(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var removed = await _coreService.DeleteVehicleAsync(vehicleId, cancellationToken);
			return removed ? NoContent() : NotFound();
		}

		[HttpGet("{vehicleId:guid}/information")]
		public async Task<IActionResult> GetVehicleInformation(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetVehicleInformationAsync(vehicleId, cancellationToken);
			return Ok(data);
		}
	}
}
