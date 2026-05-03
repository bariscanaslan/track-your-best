namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public record DeviceInfoDto(
		Guid? OrganizationId,
		string? DeviceName,
		string? DeviceIdentifier,
		int? SignalStrength,
		string? Imei,
		string? IpAddress,
		DateTime? LastSeenAt
	);
}
