using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DriversController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<DriversController> _logger;

    public DriversController(TybDbContext db, ILogger<DriversController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all drivers
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<DriverDto>>), 200)]
    public async Task<IActionResult> GetDrivers()
    {
        try
        {
            var drivers = await _db.Database.SqlQuery<DriverDto>($@"
                SELECT 
                    dr.id,
                    u.full_name,
                    u.email,
                    dr.license_number,
                    dr.license_type,
                    dr.hire_date,
                    dr.is_active,
                    COUNT(DISTINCT t.id) as total_trips,
                    COALESCE(AVG(ds.overall_score), 0) as avg_score
                FROM tyb_core.drivers dr
                JOIN tyb_core.users u ON dr.user_id = u.id
                LEFT JOIN tyb_spatial.trips t ON dr.id = t.driver_id
                LEFT JOIN tyb_analytics.driver_scores ds ON dr.id = ds.driver_id
                WHERE dr.is_active = true
                GROUP BY dr.id, u.full_name, u.email, dr.license_number, 
                         dr.license_type, dr.hire_date, dr.is_active
                ORDER BY u.full_name
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<DriverDto>>(
                Success: true,
                Message: "Drivers retrieved successfully",
                Data: drivers,
                Count: drivers.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving drivers");
            return StatusCode(500, new ApiResponse<IEnumerable<DriverDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get driver performance scores
    /// </summary>
    [HttpGet("{id:guid}/scores")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<DriverScoreDto>>), 200)]
    public async Task<IActionResult> GetDriverScores(Guid id, [FromQuery] int limit = 30)
    {
        try
        {
            var scores = await _db.Database.SqlQuery<DriverScoreDto>($@"
                SELECT 
                    analysis_date,
                    overall_score,
                    speed_score,
                    acceleration_score,
                    braking_score,
                    cornering_score,
                    total_trips,
                    total_distance_km,
                    speeding_events,
                    harsh_acceleration_events,
                    harsh_braking_events
                FROM tyb_analytics.driver_scores
                WHERE driver_id = {id}
                ORDER BY analysis_date DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<DriverScoreDto>>(
                Success: true,
                Message: "Driver scores retrieved",
                Data: scores,
                Count: scores.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving driver scores {DriverId}", id);
            return StatusCode(500, new ApiResponse<IEnumerable<DriverScoreDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}
