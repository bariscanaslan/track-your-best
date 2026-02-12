using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AnalyticsController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<AnalyticsController> _logger;

    public AnalyticsController(TybDbContext db, ILogger<AnalyticsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get dashboard statistics
    /// </summary>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<DashboardStatsDto>), 200)]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            var stats = await _db.Database.SqlQuery<DashboardStatsDto>($@"
                SELECT 
                    (SELECT COUNT(*) FROM tyb_core.devices WHERE is_active = true) as total_devices,
                    (SELECT COUNT(*) FROM tyb_spatial.trips) as total_trips,
                    (SELECT COALESCE(SUM(total_distance_km), 0) FROM tyb_spatial.trips) as total_distance_km,
                    (SELECT COUNT(*) FROM tyb_core.drivers WHERE is_active = true) as total_drivers,
                    (SELECT COUNT(*) FROM tyb_spatial.gps_data 
                     WHERE gps_timestamp > NOW() - INTERVAL '24 hours') as gps_last_24h,
                    (SELECT COUNT(*) FROM tyb_core.organizations WHERE is_active = true) as total_organizations
            ").FirstOrDefaultAsync();

            return Ok(new ApiResponse<DashboardStatsDto>(
                Success: true,
                Message: "Dashboard statistics retrieved",
                Data: stats
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving dashboard stats");
            return StatusCode(500, new ApiResponse<DashboardStatsDto>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get anomalies
    /// </summary>
    [HttpGet("anomalies")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<AnomalyDto>>), 200)]
    public async Task<IActionResult> GetAnomalies([FromQuery] int limit = 20)
    {
        try
        {
            var anomalies = await _db.Database.SqlQuery<AnomalyDto>($@"
                SELECT 
                    a.id,
                    a.anomaly_type,
                    a.severity,
                    a.description,
                    a.detected_at,
                    a.is_resolved,
                    a.confidence_score,
                    d.device_name
                FROM tyb_analytics.anomalies a
                JOIN tyb_core.devices d ON a.device_id = d.id
                ORDER BY a.detected_at DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<AnomalyDto>>(
                Success: true,
                Message: "Anomalies retrieved",
                Data: anomalies,
                Count: anomalies.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving anomalies");
            return StatusCode(500, new ApiResponse<IEnumerable<AnomalyDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get vehicles
    /// </summary>
    [HttpGet("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<VehicleDto>>), 200)]
    public async Task<IActionResult> GetVehicles()
    {
        try
        {
            var vehicles = await _db.Database.SqlQuery<VehicleDto>($@"
                SELECT 
                    v.id,
                    v.vehicle_name,
                    v.plate_number,
                    v.brand,
                    v.model,
                    v.year,
                    v.fuel_type,
                    v.is_active,
                    d.device_name
                FROM tyb_core.vehicles v
                LEFT JOIN tyb_core.devices d ON v.device_id = d.id
                WHERE v.is_active = true
                ORDER BY v.vehicle_name
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<VehicleDto>>(
                Success: true,
                Message: "Vehicles retrieved",
                Data: vehicles,
                Count: vehicles.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vehicles");
            return StatusCode(500, new ApiResponse<IEnumerable<VehicleDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get geofences
    /// </summary>
    [HttpGet("geofences")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<GeofenceDto>>), 200)]
    public async Task<IActionResult> GetGeofences()
    {
        try
        {
            var geofences = await _db.Database.SqlQuery<GeofenceDto>($@"
                SELECT 
                    id,
                    name,
                    description,
                    fence_type,
                    alert_on_entry,
                    alert_on_exit,
                    is_active
                FROM tyb_spatial.geofences
                WHERE is_active = true
                ORDER BY name
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<GeofenceDto>>(
                Success: true,
                Message: "Geofences retrieved",
                Data: geofences,
                Count: geofences.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving geofences");
            return StatusCode(500, new ApiResponse<IEnumerable<GeofenceDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}
