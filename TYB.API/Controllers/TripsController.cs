using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TripsController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<TripsController> _logger;

    public TripsController(TybDbContext db, ILogger<TripsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all trips
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<TripDto>>), 200)]
    public async Task<IActionResult> GetTrips([FromQuery] int limit = 50)
    {
        try
        {
            var trips = await _db.Database.SqlQuery<TripDto>($@"
                SELECT 
                    t.id,
                    t.trip_name,
                    t.status::text,
                    t.start_time,
                    t.end_time,
                    t.duration_seconds,
                    t.total_distance_km,
                    t.max_speed,
                    t.avg_speed,
                    t.stop_count,
                    t.harsh_acceleration_count,
                    t.harsh_braking_count,
                    d.device_name,
                    u.full_name as driver_name
                FROM tyb_spatial.trips t
                JOIN tyb_core.devices d ON t.device_id = d.id
                LEFT JOIN tyb_core.drivers dr ON t.driver_id = dr.id
                LEFT JOIN tyb_core.users u ON dr.user_id = u.id
                ORDER BY t.start_time DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<TripDto>>(
                Success: true,
                Message: "Trips retrieved successfully",
                Data: trips,
                Count: trips.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving trips");
            return StatusCode(500, new ApiResponse<IEnumerable<TripDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get trip by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TripDetailDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetTrip(Guid id)
    {
        try
        {
            var trip = await _db.Database.SqlQuery<TripDetailDto>($@"
                SELECT 
                    t.id,
                    t.trip_name,
                    t.status::text,
                    t.start_address,
                    t.end_address,
                    t.start_time,
                    t.end_time,
                    t.duration_seconds,
                    t.total_distance_km,
                    t.max_speed,
                    t.avg_speed,
                    t.stop_count,
                    t.harsh_acceleration_count,
                    t.harsh_braking_count,
                    d.device_name,
                    v.vehicle_name,
                    v.plate_number,
                    u.full_name as driver_name
                FROM tyb_spatial.trips t
                JOIN tyb_core.devices d ON t.device_id = d.id
                LEFT JOIN tyb_core.vehicles v ON t.vehicle_id = v.id
                LEFT JOIN tyb_core.drivers dr ON t.driver_id = dr.id
                LEFT JOIN tyb_core.users u ON dr.user_id = u.id
                WHERE t.id = {id}
            ").FirstOrDefaultAsync();

            if (trip == null)
            {
                return NotFound(new ApiResponse<TripDetailDto>(
                    Success: false,
                    Message: "Trip not found",
                    Data: null
                ));
            }

            return Ok(new ApiResponse<TripDetailDto>(
                Success: true,
                Message: "Trip retrieved successfully",
                Data: trip
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving trip {TripId}", id);
            return StatusCode(500, new ApiResponse<TripDetailDto>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get trip route (GPS points)
    /// </summary>
    [HttpGet("{id:guid}/route")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<GpsDataDto>>), 200)]
    public async Task<IActionResult> GetTripRoute(Guid id)
    {
        try
        {
            var route = await _db.Database.SqlQuery<GpsDataDto>($@"
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
                WHERE trip_id = {id}
                ORDER BY gps_timestamp ASC
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<GpsDataDto>>(
                Success: true,
                Message: "Trip route retrieved",
                Data: route,
                Count: route.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving trip route {TripId}", id);
            return StatusCode(500, new ApiResponse<IEnumerable<GpsDataDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}
