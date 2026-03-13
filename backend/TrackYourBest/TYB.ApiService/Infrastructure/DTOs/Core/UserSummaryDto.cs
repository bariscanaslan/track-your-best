namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class UserSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public string? OrganizationName { get; set; }
		public string Username { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string FullName { get; set; } = string.Empty;
		public string? Phone { get; set; }
		public string? Role { get; set; }
		public bool? IsActive { get; set; }
		public DateTime? LastLogin { get; set; }
		public string? AvatarUrl { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
		public string? CreatedByName { get; set; }
	}
}
