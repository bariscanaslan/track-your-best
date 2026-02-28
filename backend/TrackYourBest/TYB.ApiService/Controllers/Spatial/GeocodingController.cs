using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Spatial;

namespace TYB.ApiService.Controllers.Spatial
{
	[Route("api/geocoding")]
	[ApiController]
	public class GeocodingController : ControllerBase
	{
		private readonly NominatimService _nominatimService;

		public GeocodingController(NominatimService nominatimService)
		{
			_nominatimService = nominatimService;
		}

		[HttpGet("forward")]
		public async Task<IActionResult> Forward(
			[FromQuery] string query,
			CancellationToken cancellationToken
		)
		{
			if (string.IsNullOrWhiteSpace(query))
			{
				return BadRequest("Query is required.");
			}

			var result = await _nominatimService.ForwardGeocodeAsync(query, cancellationToken);
			if (result is null)
			{
				return NotFound();
			}

			return Ok(new GeocodeResultDto
			{
				DisplayName = result.DisplayName,
				OpenAddress = result.DisplayName,
				Latitude = result.Latitude,
				Longitude = result.Longitude
			});
		}

		[HttpGet("reverse")]
		public async Task<IActionResult> Reverse(
			[FromQuery] double lat,
			[FromQuery] double lon,
			CancellationToken cancellationToken
		)
		{
			var address = await _nominatimService.ReverseGeocodeAsync(lat, lon, cancellationToken);
			if (string.IsNullOrWhiteSpace(address))
			{
				return NotFound();
			}

			return Ok(new GeocodeResultDto
			{
				DisplayName = address,
				OpenAddress = address,
				Latitude = lat,
				Longitude = lon
			});
		}
	}
}
