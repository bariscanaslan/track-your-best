namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class VehicleInformationRow
	{
		public Guid? OrganizationId { get; set; }
		public Guid? DeviceId { get; set; }
		public string? VehicleName { get; set; }
		public string? PlateNumber { get; set; }
		public string? Brand { get; set; }
		public string? Model { get; set; }
		public int? Year { get; set; }
		public string? Color { get; set; }
	}
}
