namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class UserUpsertRequest
	{
		public string? FullName { get; set; }
		public string? Email { get; set; }
		public string? Phone { get; set; }
		public string? AvatarUrl { get; set; }
	}
}
