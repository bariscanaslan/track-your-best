using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Authorization;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.DTOs.Analytics;

namespace TYB.ApiService.Controllers.Analytics
{
	[Route("api/[controller]")]
	[ApiController]
	[AnyRole]
	public class AnomalyController : ControllerBase
	{
		private readonly TybDbContext _dbContext;

		public AnomalyController(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		/// <summary>
		/// Returns anomalies whose device belongs to the given organization,
		/// ordered by most recent first.
		/// </summary>
		[HttpGet]
		public async Task<IActionResult> GetAnomalies(
			[FromQuery] Guid organizationId,
			CancellationToken ct
		)
		{
			var raw = await _dbContext.Anomalies
				.AsNoTracking()
				.Join(
					_dbContext.Devices.AsNoTracking(),
					a => a.DeviceId,
					d => d.Id,
					(a, d) => new { Anomaly = a, Device = d }
				)
				.Where(x => x.Device.OrganizationId == organizationId)
				.GroupJoin(
					_dbContext.Trips.AsNoTracking(),
					x => x.Anomaly.TripId,
					t => t.Id,
					(x, trips) => new { x.Anomaly, x.Device, Trips = trips }
				)
				.SelectMany(
					x => x.Trips.DefaultIfEmpty(),
					(x, trip) => new { x.Anomaly, x.Device, Trip = trip }
				)
				.OrderByDescending(x => x.Anomaly.DetectedAt)
				.ToListAsync(ct);

			var dtos = raw.Select(x =>
			{
				var a = x.Anomaly;

				var dto = new AnomalySummaryDto
				{
					Id = a.Id,
					TripId = a.TripId,
					TripName = x.Trip?.TripName,
					DeviceId = a.DeviceId,
					AnomalyType = a.AnomalyType,
					Severity = a.Severity,
					Description = a.Description,
					ConfidenceScore = a.ConfidenceScore,
					AlgorithmUsed = a.AlgorithmUsed,
					DetectedAt = a.DetectedAt,
					Latitude = a.Location?.Y,
					Longitude = a.Location?.X,
				};

				if (!string.IsNullOrWhiteSpace(a.Metadata))
				{
					try
					{
						using var doc = JsonDocument.Parse(a.Metadata);
						var root = doc.RootElement;

						if (root.TryGetProperty("flags", out var flagsEl) && flagsEl.ValueKind == JsonValueKind.Array)
						{
							dto.Flags = flagsEl.EnumerateArray()
								.Where(f => f.ValueKind == JsonValueKind.String)
								.Select(f => f.GetString()!)
								.ToList();
						}

						if (root.TryGetProperty("anomaly_score", out var scoreEl) && scoreEl.ValueKind == JsonValueKind.Number)
						{
							dto.AnomalyScore = scoreEl.GetDouble();
						}
					}
					catch
					{
						// Non-fatal — return record without flags
					}
				}

				return dto;
			}).ToList();

			return Ok(dtos);
		}
	}
}
