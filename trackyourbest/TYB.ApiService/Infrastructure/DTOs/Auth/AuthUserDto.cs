namespace TYB.ApiService.Infrastructure.DTOs.Auth
{
	public class AuthUserDto
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public string Username { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string FullName { get; set; } = string.Empty;
		public string Role { get; set; } = string.Empty;
		public string? AvatarUrl { get; set; }
	}
}
