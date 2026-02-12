using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DevicesController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<DevicesController> _logger;

    public DevicesController(TybDbContext db, ILogger<DevicesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all devices
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<DeviceDto>>), 200)]
    public async Task<IActionResult> GetDevices()
    {
        try
        {
            var devices = await _db.Database.SqlQuery<DeviceDto>($@"
                SELECT 
                    d.id,
                    d.device_name,
                    d.device_identifier,
                    d.status::text,
                    d.battery_level,
                    d.signal_strength,
                    d.created_at,
                    (SELECT gps_timestamp 
                     FROM tyb_spatial.gps_data 
                     WHERE device_id = d.id 
                     ORDER BY gps_timestamp DESC 
                     LIMIT 1) as last_seen
                FROM tyb_core.devices d
                WHERE d.is_active = true
                ORDER BY d.device_name
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<DeviceDto>>(
                Success: true,
                Message: "Devices retrieved successfully",
                Data: devices,
                Count: devices.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving devices");
            return StatusCode(500, new ApiResponse<IEnumerable<DeviceDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get device by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<DeviceDetailDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDevice(Guid id)
    {
        try
        {
            var device = await _db.Database.SqlQuery<DeviceDetailDto>($@"
                SELECT 
                    d.id,
                    d.device_name,
                    d.device_identifier,
                    d.mqtt_username,
                    d.status::text,
                    d.battery_level,
                    d.signal_strength,
                    d.firmware_version,
                    d.device_model,
                    d.created_at,
                    o.name as organization_name
                FROM tyb_core.devices d
                LEFT JOIN tyb_core.organizations o ON d.organization_id = o.id
                WHERE d.id = {id}
            ").FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound(new ApiResponse<DeviceDetailDto>(
                    Success: false,
                    Message: "Device not found",
                    Data: null
                ));
            }

            return Ok(new ApiResponse<DeviceDetailDto>(
                Success: true,
                Message: "Device retrieved successfully",
                Data: device
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving device {DeviceId}", id);
            return StatusCode(500, new ApiResponse<DeviceDetailDto>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get device GPS history
    /// </summary>
    [HttpGet("{id:guid}/gps")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<GpsDataDto>>), 200)]
    public async Task<IActionResult> GetDeviceGps(Guid id, [FromQuery] int limit = 100)
    {
        try
        {
            var gpsData = await _db.Database.SqlQuery<GpsDataDto>($@"
                SELECT 
                    id,
                    latitude,
                    longitude,
                    speed,
                    heading,
                    altitude,
                    gps_timestamp,
                    battery_level,
                    signal_quality
                FROM tyb_spatial.gps_data
                WHERE device_id = {id}
                ORDER BY gps_timestamp DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<GpsDataDto>>(
                Success: true,
                Message: "GPS data retrieved successfully",
                Data: gpsData,
                Count: gpsData.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving GPS data for device {DeviceId}", id);
            return StatusCode(500, new ApiResponse<IEnumerable<GpsDataDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get latest GPS position
    /// </summary>
    [HttpGet("{id:guid}/latest-gps")]
    [ProducesResponseType(typeof(ApiResponse<GpsDataDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetLatestGps(Guid id)
    {
        try
        {
            var gps = await _db.Database.SqlQuery<GpsDataDto>($@"
                SELECT 
                    id,
                    latitude,
                    longitude,
                    speed,
                    heading,
                    altitude,
                    gps_timestamp,
                    battery_level,
                    signal_quality
                FROM tyb_spatial.gps_data
                WHERE device_id = {id}
                ORDER BY gps_timestamp DESC
                LIMIT 1
            ").FirstOrDefaultAsync();

            if (gps == null)
            {
                return NotFound(new ApiResponse<GpsDataDto>(
                    Success: false,
                    Message: "No GPS data found",
                    Data: null
                ));
            }

            return Ok(new ApiResponse<GpsDataDto>(
                Success: true,
                Message: "Latest GPS position retrieved",
                Data: gps
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving latest GPS for device {DeviceId}", id);
            return StatusCode(500, new ApiResponse<GpsDataDto>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}
