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
        /// Returns average driver grading scores for the given organization.
        /// Only formula-based v6 scores are included.
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetDriverScoreSummary(
            [FromQuery] Guid organizationId,
            CancellationToken ct)
        {
            try
            {
                _logger.LogInformation("Driver score summary requested for organizationId: {OrganizationId}", organizationId);

                // 1) Önce DB'den organization'a ait score kayıtlarını çek
                // Metadata filter'ını SQL tarafında değil memory tarafında yapıyoruz
                var rawRows = await _dbContext.DriverScores
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
                        Metadata = x.Score.Metadata
                    })
                    .ToListAsync(ct);

                _logger.LogInformation("Raw driver score rows fetched: {Count}", rawRows.Count);

                // 2) Formula-only v6 kayıtlarını memory tarafında filtrele
                var filteredRows = rawRows
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(x.Metadata) &&
                        x.Metadata.Contains("v6_formula_only", StringComparison.OrdinalIgnoreCase))
                    .ToList();

                _logger.LogInformation("Filtered v6_formula_only rows: {Count}", filteredRows.Count);

                // 3) Driver bazında aggregate et
                var scores = filteredRows
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
                    message = "Driver score summary alınırken hata oluştu.",
                    detail = ex.Message
                });
            }
        }
    }
}