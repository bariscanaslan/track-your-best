using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class GpsController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<GpsController> _logger;

    public GpsController(TybDbContext db, ILogger<GpsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get recent GPS data (all devices)
    /// </summary>
    [HttpGet("recent")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<GpsWithDeviceDto>>), 200)]
    public async Task<IActionResult> GetRecentGps([FromQuery] int limit = 100)
    {
        try
        {
            var gpsData = await _db.Database.SqlQuery<GpsWithDeviceDto>($@"
                SELECT 
                    g.id,
                    g.latitude,
                    g.longitude,
                    g.speed,
                    g.heading,
                    g.gps_timestamp,
                    d.device_name,
                    d.id as device_id
                FROM tyb_spatial.gps_data g
                JOIN tyb_core.devices d ON g.device_id = d.id
                ORDER BY g.gps_timestamp DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<GpsWithDeviceDto>>(
                Success: true,
                Message: "Recent GPS data retrieved",
                Data: gpsData,
                Count: gpsData.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving recent GPS data");
            return StatusCode(500, new ApiResponse<IEnumerable<GpsWithDeviceDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}
