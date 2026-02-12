namespace TYB.API.DTOs;

/// <summary>
/// GPS data point DTO
/// </summary>
public record GpsDataDto(
    long Id,
    decimal Latitude,
    decimal Longitude,
    decimal? Speed,
    decimal? Heading,
    decimal? Altitude,
    DateTime GpsTimestamp,
    int? BatteryLevel,
    int? SignalQuality
);

/// <summary>
/// GPS data with device information
/// </summary>
public record GpsWithDeviceDto(
    long Id,
    decimal Latitude,
    decimal Longitude,
    decimal? Speed,
    decimal? Heading,
    DateTime GpsTimestamp,
    string DeviceName,
    Guid DeviceId
);

/// <summary>
/// GPS insert request DTO
/// </summary>
public record GpsInsertDto(
    Guid DeviceId,
    decimal Latitude,
    decimal Longitude,
    decimal? Speed,
    decimal? Heading,
    decimal? Altitude,
    int? BatteryLevel,
    DateTime? GpsTimestamp
);
