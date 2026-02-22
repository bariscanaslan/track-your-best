namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class DriverInformationRow
	{
		public Guid? OrganizationId { get; set; }
		public Guid? UserId { get; set; }
		public Guid? VehicleId { get; set; }
		public string? FullName { get; set; }
		public string? Phone { get; set; }
		public string? AvatarUrl { get; set; }
	}
}
