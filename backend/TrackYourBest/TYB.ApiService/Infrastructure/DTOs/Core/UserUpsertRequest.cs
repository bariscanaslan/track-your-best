namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class UserUpsertRequest
	{
		public Guid? OrganizationId { get; set; }
		public string? Username { get; set; }
		public string? Password { get; set; }
		public string? FullName { get; set; }
		public string? Email { get; set; }
		public string? Phone { get; set; }
		public string? AvatarUrl { get; set; }
		public string? Role { get; set; }
		public bool? IsActive { get; set; }
	}
}
