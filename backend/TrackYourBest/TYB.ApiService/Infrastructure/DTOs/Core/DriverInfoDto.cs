namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public record DriverInfoDto(
		Guid? OrganizationId,
		Guid? UserId,
		Guid? VehicleId,
		string? FullName,
		string? Phone,
		string? AvatarUrl
	);
}
