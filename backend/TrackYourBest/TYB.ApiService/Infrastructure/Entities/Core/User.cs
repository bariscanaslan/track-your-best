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
		public string Role { get; set; } = string.Empty;
		public bool? IsActive { get; set; }
		public bool? IsVerified { get; set; }
		public DateTime? LastLogin { get; set; }
		public int? FailedLoginAttempts { get; set; }
		public DateTime? AccountLockedUntil { get; set; }
		public string? AvatarUrl { get; set; }
		public string? Preferences { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
	}
}
