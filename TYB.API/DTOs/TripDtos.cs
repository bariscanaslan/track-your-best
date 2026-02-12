namespace TYB.API.DTOs;

/// <summary>
/// Trip list DTO
/// </summary>
public record TripDto(
    Guid Id,
    string? TripName,
    string Status,
    DateTime StartTime,
    DateTime? EndTime,
    int? DurationSeconds,
    decimal? TotalDistanceKm,
    decimal? MaxSpeed,
    decimal? AvgSpeed,
    int StopCount,
    int HarshAccelerationCount,
    int HarshBrakingCount,
    string DeviceName,
    string? DriverName
);

/// <summary>
/// Trip detail DTO
/// </summary>
public record TripDetailDto(
    Guid Id,
    string? TripName,
    string Status,
    string? StartAddress,
    string? EndAddress,
    DateTime StartTime,
    DateTime? EndTime,
    int? DurationSeconds,
    decimal? TotalDistanceKm,
    decimal? MaxSpeed,
    decimal? AvgSpeed,
    int StopCount,
    int HarshAccelerationCount,
    int HarshBrakingCount,
    string DeviceName,
    string? VehicleName,
    string? PlateNumber,
    string? DriverName
);
