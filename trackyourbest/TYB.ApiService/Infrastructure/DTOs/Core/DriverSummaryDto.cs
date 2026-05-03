namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class DriverSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public string? VehicleName { get; set; }
		public Guid? UserId { get; set; }
		public string? FullName { get; set; }
		public string? Email { get; set; }
		public string? Phone { get; set; }
		public string? AvatarUrl { get; set; }
		public DateTime? UserCreatedAt { get; set; }
		public DateTime? LastLogin { get; set; }
		public string LicenseNumber { get; set; } = string.Empty;
		public string? LicenseType { get; set; }
		public DateTime? LicenseExpiry { get; set; }
		public DateTime? DateOfBirth { get; set; }
		public DateTime? HireDate { get; set; }
		public string? EmergencyContactName { get; set; }
		public string? EmergencyContactPhone { get; set; }
		public bool? IsActive { get; set; }
	}
}
