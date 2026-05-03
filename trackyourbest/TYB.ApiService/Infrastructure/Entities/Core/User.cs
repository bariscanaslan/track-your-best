namespace TYB.ApiService.Infrastructure.Entities.Core
{
	public class User
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public string Username { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string PasswordHash { get; set; } = string.Empty;
		public string FullName { get; set; } = string.Empty;
		public string? Phone { get; set; }
		public UserRole Role { get; set; } = UserRole.Viewer;
		public bool? IsActive { get; set; }
		public DateTime? LastLogin { get; set; }
		public string? AvatarUrl { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
	}
}
