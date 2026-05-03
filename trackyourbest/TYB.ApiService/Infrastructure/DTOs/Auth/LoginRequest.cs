namespace TYB.ApiService.Infrastructure.DTOs.Auth
{
	public class LoginRequest
	{
		/// <summary>Email or username</summary>
		public string Login { get; set; } = string.Empty;
		public string Password { get; set; } = string.Empty;
	}
}
