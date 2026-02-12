using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TYB.API.Data;
using TYB.API.DTOs;

namespace TYB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class VehiclesController : ControllerBase
{
    private readonly TybDbContext _db;
    private readonly ILogger<VehiclesController> _logger;

    public VehiclesController(TybDbContext db, ILogger<VehiclesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get all vehicles
    /// </summary>
    [HttpGet]
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
                Message: "Vehicles retrieved successfully",
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
    /// Get vehicle by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<VehicleDetailDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetVehicle(Guid id)
    {
        try
        {
            var vehicle = await _db.Database.SqlQuery<VehicleDetailDto>($@"
                SELECT 
                    v.id,
                    v.vehicle_name,
                    v.plate_number,
                    v.brand,
                    v.model,
                    v.year,
                    v.vin,
                    v.color,
                    v.fuel_type,
                    v.capacity,
                    v.odometer_reading,
                    v.insurance_expiry,
                    v.inspection_expiry,
                    v.is_active,
                    d.device_name,
                    d.id as device_id,
                    o.name as organization_name
                FROM tyb_core.vehicles v
                LEFT JOIN tyb_core.devices d ON v.device_id = d.id
                LEFT JOIN tyb_core.organizations o ON v.organization_id = o.id
                WHERE v.id = {id}
            ").FirstOrDefaultAsync();

            if (vehicle == null)
            {
                return NotFound(new ApiResponse<VehicleDetailDto>(
                    Success: false,
                    Message: "Vehicle not found",
                    Data: null
                ));
            }

            return Ok(new ApiResponse<VehicleDetailDto>(
                Success: true,
                Message: "Vehicle retrieved successfully",
                Data: vehicle
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving vehicle {VehicleId}", id);
            return StatusCode(500, new ApiResponse<VehicleDetailDto>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }

    /// <summary>
    /// Get vehicle trips
    /// </summary>
    [HttpGet("{id:guid}/trips")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<TripDto>>), 200)]
    public async Task<IActionResult> GetVehicleTrips(Guid id, [FromQuery] int limit = 50)
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
                WHERE t.vehicle_id = {id}
                ORDER BY t.start_time DESC
                LIMIT {limit}
            ").ToListAsync();

            return Ok(new ApiResponse<IEnumerable<TripDto>>(
                Success: true,
                Message: "Vehicle trips retrieved",
                Data: trips,
                Count: trips.Count
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving trips for vehicle {VehicleId}", id);
            return StatusCode(500, new ApiResponse<IEnumerable<TripDto>>(
                Success: false,
                Message: $"Error: {ex.Message}",
                Data: null
            ));
        }
    }
}

/// <summary>
/// Vehicle detail DTO (extended)
/// </summary>
public record VehicleDetailDto(
    Guid Id,
    string VehicleName,
    string PlateNumber,
    string? Brand,
    string? Model,
    int? Year,
    string? Vin,
    string? Color,
    string? FuelType,
    int? Capacity,
    decimal? OdometerReading,
    DateTime? InsuranceExpiry,
    DateTime? InspectionExpiry,
    bool IsActive,
    string? DeviceName,
    Guid? DeviceId,
    string OrganizationName
);
