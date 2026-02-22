namespace TYB.ApiService.Infrastructure.Entities.Core
{
	public class Vehicle
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public Guid? DeviceId { get; set; }
		public string VehicleName { get; set; } = string.Empty;
		public string PlateNumber { get; set; } = string.Empty;
		public string? Brand { get; set; }
		public string? Model { get; set; }
		public int? Year { get; set; }
		public string? Vin { get; set; }
		public string? Color { get; set; }
		public string? FuelType { get; set; }
		public int? Capacity { get; set; }
		public decimal? OdometerReading { get; set; }
		public DateTime? InsuranceExpiry { get; set; }
		public DateTime? InspectionExpiry { get; set; }
		public bool? IsActive { get; set; }
		public string? Metadata { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
	}
}
