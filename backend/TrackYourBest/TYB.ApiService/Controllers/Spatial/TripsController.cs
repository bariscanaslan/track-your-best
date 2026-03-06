using Microsoft.AspNetCore.Mvc;
using Sprache;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Spatial;

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
			if (await _tripsService.HasActiveTripForVehicleAsync(request.VehicleId, cancellationToken))
			{
				return Conflict("Vehicle already has an active trip.");
			}

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

			if (response is null)
				return NotFound();

			return Ok(response);
		}

		[HttpPost("driver-decision/{tripId:guid}")]
		public async Task<IActionResult> DriverDecision(
			[FromRoute] Guid tripId,
			[FromBody] DriverTripDecisionRequest request,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var response = await _tripsService.DecideTripByDriverAsync(tripId, request, cancellationToken);
				if (response is null)
				{
					return NotFound();
				}
				return Ok(response);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}

		[HttpPost("driver-action/{tripId:guid}")]
		public async Task<IActionResult> DriverAction(
			[FromRoute] Guid tripId,
			[FromBody] DriverTripActionRequest request,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var response = await _tripsService.ApplyDriverTripActionAsync(tripId, request, cancellationToken);
				if (response is null)
				{
					return NotFound();
				}
				return Ok(response);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}

		[HttpGet("driver-finish-check/{tripId:guid}")]
		public async Task<IActionResult> DriverFinishCheck(
			[FromRoute] Guid tripId,
			[FromQuery] double currentLat,
			[FromQuery] double currentLng,
			CancellationToken cancellationToken
		)
		{
			var response = await _tripsService.CheckDriverFinishDistanceAsync(
				tripId,
				currentLat,
				currentLng,
				cancellationToken
			);

			if (response is null)
			{
				return NotFound();
			}

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
