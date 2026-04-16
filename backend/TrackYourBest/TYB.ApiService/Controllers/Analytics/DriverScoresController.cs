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

        public DriverScoresController(TybDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Returns average driver grading scores for the given organization.
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetDriverScoreSummary(
            [FromQuery] Guid organizationId,
            CancellationToken ct)
        {
            var rawScores = await _dbContext.DriverScores
                .AsNoTracking()
                .Join(
                    _dbContext.Drivers.AsNoTracking(),
                    ds => ds.DriverId,
                    d => d.Id,
                    (ds, d) => new { Score = ds, Driver = d }
                )
                .Where(x => x.Driver.OrganizationId == organizationId)
                .GroupBy(x => x.Driver.Id)
                .Select(g => new
                {
                    DriverId = g.Key,
                    AverageOverallScore = g.Average(x => x.Score.OverallScore),
                    TripCount = g.Count(),
                    LastCalculatedAt = g.Max(x => x.Score.CalculatedAt)
                })
                .ToListAsync(ct);

            var scores = rawScores
                .Select(x => new DriverGradeSummaryDto
                {
                    DriverId = x.DriverId,
                    AverageOverallScore = Math.Round(x.AverageOverallScore, 2),
                    TripCount = x.TripCount,
                    LastCalculatedAt = x.LastCalculatedAt
                })
                .OrderByDescending(x => x.AverageOverallScore)
                .ToList();

            return Ok(scores);
        }
    }
}