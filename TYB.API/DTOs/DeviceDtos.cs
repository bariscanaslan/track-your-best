namespace TYB.API.DTOs;

/// <summary>
/// Device list DTO - Basic device information
/// </summary>
public record DeviceDto(
    Guid Id,
    string DeviceName,
    string DeviceIdentifier,
    string Status,
    int? BatteryLevel,
    int? SignalStrength,
    DateTime CreatedAt,
    DateTime? LastSeen
);

/// <summary>
/// Device detail DTO - Complete device information
/// </summary>
public record DeviceDetailDto(
    Guid Id,
    string DeviceName,
    string DeviceIdentifier,
    string MqttUsername,
    string Status,
    int? BatteryLevel,
    int? SignalStrength,
    string? FirmwareVersion,
    string? DeviceModel,
    DateTime CreatedAt,
    string OrganizationName
);

/// <summary>
/// Device create/update request DTO
/// </summary>
public record DeviceRequestDto(
    string DeviceName,
    string DeviceIdentifier,
    string? DeviceModel,
    string MqttUsername,
    string? FirmwareVersion
);

/// <summary>
/// API Response wrapper
/// </summary>
public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data,
    int? Count = null
);
