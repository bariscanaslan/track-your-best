namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public record VehicleInfoDto(
		Guid? OrganizationId,
		Guid? DeviceId,
		string? VehicleName,
		string? PlateNumber,
		string? Brand,
		string? Model,
		int? Year,
		string? Color
	);
}
