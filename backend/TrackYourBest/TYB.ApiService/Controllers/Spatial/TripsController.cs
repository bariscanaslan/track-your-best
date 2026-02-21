using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Models.Spatial;
using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Controllers.Spatial
{
	[Route("api/trips")]
	[ApiController]
	public class TripsController : ControllerBase
	{
		private readonly TripsService _tripsService;

		public TripsController(TripsService tripsService)
		{
			_tripsService = tripsService;
		}

		[HttpPost("plan")]
		public async Task<IActionResult> PlanTrip(
			[FromBody] TripPlanRequest request,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.PlanTripAsync(request, cancellationToken);
			return Ok(response);
		}

		[HttpPost("approve")]
		public async Task<IActionResult> ApproveTrip(
			[FromBody] TripPlanRequest request,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.ApproveTripAsync(request, cancellationToken);
			return Ok(response);
		}

		[HttpGet("driver/{driverId:guid}")]
		public async Task<IActionResult> GetDriverTrips(
			[FromRoute] Guid driverId,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.GetTripsForDriverAsync(driverId, cancellationToken);
			return Ok(response);
		}

		[HttpGet("active/vehicle/{vehicleId:guid}")]
		public async Task<IActionResult> GetActiveTripForVehicle(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.GetActiveTripForVehicleAsync(vehicleId, cancellationToken);
			return Ok(response);
		}

		[HttpPost("cancel/vehicle/{vehicleId:guid}")]
		public async Task<IActionResult> CancelActiveTripForVehicle(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.CancelActiveTripForVehicleAsync(vehicleId, cancellationToken);
			return Ok(response);
		}

		[HttpGet("history/vehicle/{vehicleId:guid}")]
		public async Task<IActionResult> GetPastTripsForVehicle(
			[FromRoute] Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.GetPastTripsForVehicleAsync(vehicleId, cancellationToken);
			return Ok(response);
		}
	}
}
