using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.DTOs.Analytics;

namespace TYB.ApiService.Controllers.Analytics
{
    [Route("api/[controller]")]
    [ApiController]
    public class DriverScoresController : ControllerBase
    {
        private readonly TybDbContext _dbContext;
        private readonly ILogger<DriverScoresController> _logger;

        public DriverScoresController(
            TybDbContext dbContext,
            ILogger<DriverScoresController> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        /// <summary>
        /// Returns the average score for a single driver.
        /// </summary>
        [HttpGet("driver/{driverId:guid}")]
        public async Task<IActionResult> GetDriverScore(
            [FromRoute] Guid driverId,
            CancellationToken ct)
        {
            try
            {
                var rows = await _dbContext.DriverScores
                    .AsNoTracking()
                    .Where(ds => ds.DriverId == driverId)
                    .Select(ds => new { ds.OverallScore, ds.CalculatedAt })
                    .ToListAsync(ct);

                if (rows.Count == 0)
                    return NotFound(new { message = "No score data found for this driver." });

                var result = new DriverGradeSummaryDto
                {
                    DriverId = driverId,
                    AverageOverallScore = Math.Round(rows.Average(x => x.OverallScore), 2),
                    TripCount = rows.Count,
                    LastCalculatedAt = rows.Max(x => x.CalculatedAt)
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching score for driverId: {DriverId}", driverId);
                return StatusCode(500, new { message = "Error fetching driver score.", detail = ex.Message });
            }
        }

        /// <summary>
        /// Returns average driver grading scores for the given organization.
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetDriverScoreSummary(
            [FromQuery] Guid organizationId,
            CancellationToken ct)
        {
            try
            {
                _logger.LogInformation("Driver score summary requested for organizationId: {OrganizationId}", organizationId);

                var rows = await _dbContext.DriverScores
                    .AsNoTracking()
                    .Join(
                        _dbContext.Drivers.AsNoTracking(),
                        ds => ds.DriverId,
                        d => d.Id,
                        (ds, d) => new { Score = ds, Driver = d }
                    )
                    .Where(x => x.Driver.OrganizationId == organizationId)
                    .Select(x => new
                    {
                        DriverId = x.Driver.Id,
                        OverallScore = x.Score.OverallScore,
                        CalculatedAt = x.Score.CalculatedAt,
                    })
                    .ToListAsync(ct);

                _logger.LogInformation("Driver score rows fetched: {Count}", rows.Count);

                var scores = rows
                    .GroupBy(x => x.DriverId)
                    .Select(g => new DriverGradeSummaryDto
                    {
                        DriverId = g.Key,
                        AverageOverallScore = Math.Round(g.Average(x => x.OverallScore), 2),
                        TripCount = g.Count(),
                        LastCalculatedAt = g.Max(x => x.CalculatedAt)
                    })
                    .OrderByDescending(x => x.AverageOverallScore)
                    .ToList();

                _logger.LogInformation("Driver summary result count: {Count}", scores.Count);

                return Ok(scores);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error while fetching driver score summary for organizationId: {OrganizationId}",
                    organizationId);

                return StatusCode(500, new
                {
                    message = "An error occurred while fetching driver score summary.",
                    detail = ex.Message
                });
            }
        }
    }
}
