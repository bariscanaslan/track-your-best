namespace TYB.API.DTOs;

/// <summary>
/// Dashboard statistics DTO
/// </summary>
public record DashboardStatsDto(
    int TotalDevices,
    int TotalTrips,
    decimal TotalDistanceKm,
    int TotalDrivers,
    int GpsLast24h,
    int TotalOrganizations
);

/// <summary>
/// Anomaly detection DTO
/// </summary>
public record AnomalyDto(
    Guid Id,
    string AnomalyType,
    string Severity,
    string Description,
    DateTime DetectedAt,
    bool IsResolved,
    decimal? ConfidenceScore,
    string DeviceName
);

/// <summary>
/// Vehicle DTO
/// </summary>
public record VehicleDto(
    Guid Id,
    string VehicleName,
    string PlateNumber,
    string? Brand,
    string? Model,
    int? Year,
    string? FuelType,
    bool IsActive,
    string? DeviceName
);

/// <summary>
/// Geofence DTO
/// </summary>
public record GeofenceDto(
    Guid Id,
    string Name,
    string? Description,
    string? FenceType,
    bool AlertOnEntry,
    bool AlertOnExit,
    bool IsActive
);
