using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.DTOs.Analytics;

namespace TYB.ApiService.Controllers.Analytics
{
	[Route("api/[controller]")]
	[ApiController]
	public class EtaController : ControllerBase
	{
		private readonly TybDbContext _dbContext;

		public EtaController(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		/// <summary>
		/// Returns the latest ETA prediction produced by the ML service for a given trip.
		/// </summary>
		[HttpGet("trip/{tripId:guid}")]
		public async Task<IActionResult> GetLatestForTrip(
			[FromRoute] Guid tripId,
			CancellationToken ct
		)
		{
			var prediction = await _dbContext.EtaPredictions
				.AsNoTracking()
				.Where(e => e.TripId == tripId)
				.OrderByDescending(e => e.PredictionTime)
				.FirstOrDefaultAsync(ct);

			if (prediction is null)
				return NotFound();

			var dto = new EtaPredictionDto
			{
				Id = prediction.Id,
				TripId = prediction.TripId,
				PredictionTime = prediction.PredictionTime,
				PredictedArrivalTime = prediction.PredictedArrivalTime,
				RemainingDistanceKm = prediction.RemainingDistanceKm,
				ConfidenceScore = prediction.ConfidenceScore,
				TrafficFactor = prediction.TrafficFactor,
				ModelVersion = prediction.ModelVersion,
			};

			if (!string.IsNullOrWhiteSpace(prediction.Metadata))
			{
				try
				{
					using var doc = JsonDocument.Parse(prediction.Metadata);
					var root = doc.RootElement;

					if (root.TryGetProperty("eta_minutes", out var etaEl) && etaEl.ValueKind == JsonValueKind.Number)
						dto.EtaMinutes = etaEl.GetDouble();

					if (root.TryGetProperty("is_rush_hour", out var rushEl) && (rushEl.ValueKind == JsonValueKind.True || rushEl.ValueKind == JsonValueKind.False))
						dto.IsRushHour = rushEl.GetBoolean();

					if (root.TryGetProperty("avg_speed_kmh", out var speedEl) && speedEl.ValueKind == JsonValueKind.Number)
						dto.AvgSpeedKmh = speedEl.GetDouble();

					if (root.TryGetProperty("traffic_density", out var densEl) && densEl.ValueKind == JsonValueKind.Number)
						dto.TrafficDensity = densEl.GetDouble();

					if (root.TryGetProperty("day_of_week", out var dayEl) && dayEl.ValueKind == JsonValueKind.String)
						dto.DayOfWeek = dayEl.GetString();

					if (root.TryGetProperty("is_weekend", out var weekendEl))
						dto.IsWeekend = weekendEl.GetBoolean();
				}
				catch
				{
					// Metadata parse failures are non-fatal; return what we have
				}
			}

			return Ok(dto);
		}
	}
}
