using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Auth;

namespace TYB.ApiService.Controllers.Auth
{
	[Route("api/auth")]
	[ApiController]
	public class AuthController : ControllerBase
	{
		private readonly AuthService _authService;
		private readonly IConfiguration _configuration;

		private const string CookieName = "tyb_token";

		public AuthController(AuthService authService, IConfiguration configuration)
		{
			_authService = authService;
			_configuration = configuration;
		}

		/// <summary>
		/// Authenticates a user with email/username and password.
		/// On success, sets an httpOnly JWT cookie and returns user info.
		/// </summary>
		[HttpPost("login")]
		public async Task<IActionResult> Login(
			[FromBody] LoginRequest request,
			CancellationToken ct
		)
		{
			if (string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrWhiteSpace(request.Password))
				return BadRequest(new { message = "Login and password are required." });

			var (user, error) = await _authService.ValidateLoginAsync(request.Login, request.Password, ct);

			if (user is null)
				return Unauthorized(new { message = error });

			var token = _authService.GenerateToken(user);

			_ = int.TryParse(_configuration["TYB_JWT_EXPIRY_HOURS"], out var expHours);
			if (expHours <= 0) expHours = 8;

			Response.Cookies.Append(CookieName, token, BuildCookieOptions(DateTimeOffset.UtcNow.AddHours(expHours)));

			return Ok(user);
		}

		/// <summary>
		/// Returns the currently authenticated user's info based on the JWT cookie.
		/// </summary>
		[HttpGet("me")]
		[Authorize]
		public IActionResult Me()
		{
			var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
				?? User.FindFirstValue(ClaimTypes.Name)
				?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
			var username = User.FindFirstValue("username")
				?? User.FindFirstValue(ClaimTypes.Name);
			var fullName = User.FindFirstValue("fullName");
			var email = User.FindFirstValue("email");
			var role = User.FindFirstValue("role")
				?? User.FindFirstValue(ClaimTypes.Role);
			var orgIdStr = User.FindFirstValue("organizationId");

			if (sub is null || username is null || !Guid.TryParse(sub, out var userId))
			{
				Response.Cookies.Delete(CookieName, BuildCookieOptions());
				return Unauthorized(new { message = "Invalid token." });
			}

			return Ok(new AuthUserDto
			{
				Id = userId,
				OrganizationId = Guid.TryParse(orgIdStr, out var orgId) ? orgId : null,
				Username = username,
				Email = email ?? string.Empty,
				FullName = fullName ?? string.Empty,
				Role = role ?? "viewer",
			});
		}

		/// <summary>
		/// Clears the JWT cookie, effectively logging the user out.
		/// </summary>
		[HttpPost("logout")]
		public IActionResult Logout()
		{
			Response.Cookies.Delete(CookieName, BuildCookieOptions());
			return Ok(new { message = "Logged out successfully." });
		}

		private CookieOptions BuildCookieOptions(DateTimeOffset? expires = null)
		{
			return new CookieOptions
			{
				HttpOnly = true,
				Secure = false, // Set to true in production (HTTPS)
				SameSite = SameSiteMode.Lax,
				Expires = expires,
				Path = "/"
			};
		}
	}
}
