namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class VehicleSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? DeviceId { get; set; }
		public string? DeviceName { get; set; }
		public string VehicleName { get; set; } = string.Empty;
		public string PlateNumber { get; set; } = string.Empty;
		public string? Brand { get; set; }
		public string? Model { get; set; }
		public int? Year { get; set; }
		public string? Color { get; set; }
		public string? FuelType { get; set; }
		public int? Capacity { get; set; }
		public DateTime? InsuranceExpiry { get; set; }
		public bool? IsActive { get; set; }
		public DateTime? CreatedAt { get; set; }
	}
}
