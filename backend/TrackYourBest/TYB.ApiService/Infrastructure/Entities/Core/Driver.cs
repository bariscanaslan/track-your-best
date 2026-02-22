namespace TYB.ApiService.Infrastructure.Entities.Core
{
	public class Driver
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public Guid? UserId { get; set; }
		public Guid? VehicleId { get; set; }
		public string LicenseNumber { get; set; } = string.Empty;
		public string? LicenseType { get; set; }
		public DateTime? LicenseExpiry { get; set; }
		public DateTime? DateOfBirth { get; set; }
		public DateTime? HireDate { get; set; }
		public string? EmergencyContactName { get; set; }
		public string? EmergencyContactPhone { get; set; }
		public bool? IsActive { get; set; }
		public string? Metadata { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
	}
}
