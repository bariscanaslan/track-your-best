namespace TYB.API.DTOs;

/// <summary>
/// Driver list DTO
/// </summary>
public record DriverDto(
    Guid Id,
    string FullName,
    string Email,
    string LicenseNumber,
    string LicenseType,
    DateTime? HireDate,
    bool IsActive,
    int TotalTrips,
    decimal AvgScore
);

/// <summary>
/// Driver performance score DTO
/// </summary>
public record DriverScoreDto(
    DateTime AnalysisDate,
    decimal? OverallScore,
    decimal? SpeedScore,
    decimal? AccelerationScore,
    decimal? BrakingScore,
    decimal? CorneringScore,
    int? TotalTrips,
    decimal? TotalDistanceKm,
    int SpeedingEvents,
    int HarshAccelerationEvents,
    int HarshBrakingEvents
);
