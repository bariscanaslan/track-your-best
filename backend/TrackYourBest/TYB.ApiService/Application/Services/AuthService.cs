using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.DTOs.Auth;
using TYB.ApiService.Infrastructure.Entities.Core;

namespace TYB.ApiService.Application.Services
{
	public class AuthService
	{
		private readonly TybDbContext _dbContext;
		private readonly IConfiguration _configuration;

		public AuthService(TybDbContext dbContext, IConfiguration configuration)
		{
			_dbContext = dbContext;
			_configuration = configuration;
		}

		/// <summary>
		/// Validates login credentials (email or username) and returns the user DTO on success.
		/// Returns null user and an error message on failure.
		/// </summary>
		public async Task<(AuthUserDto? user, string? error)> ValidateLoginAsync(
			string login,
			string password,
			CancellationToken ct
		)
		{
			var loginLower = login.Trim().ToLowerInvariant();

			var user = await _dbContext.Users
				.AsNoTracking()
				.FirstOrDefaultAsync(
					u => u.Email.ToLower() == loginLower || u.Username == loginLower,
					ct
				);

			if (user is null)
				return (null, "Invalid credentials.");

			if (user.IsActive != true)
				return (null, "Your account is inactive. Please contact your administrator.");

			if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
				return (null, "Invalid credentials.");

			await _dbContext.Users
				.Where(u => u.Id == user.Id)
				.ExecuteUpdateAsync(
					s => s.SetProperty(u => u.LastLogin, DateTime.UtcNow),
					ct
				);

			return (MapToDto(user), null);
		}

		public string GenerateToken(AuthUserDto user)
		{
			var secret = _configuration["TYB_JWT_SECRET"]
				?? throw new InvalidOperationException("TYB_JWT_SECRET is not configured.");

			_ = int.TryParse(_configuration["TYB_JWT_EXPIRY_HOURS"], out var expHours);
			if (expHours <= 0) expHours = 8;

			var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
			var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

			var claims = new List<Claim>
			{
				new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
				new(ClaimTypes.NameIdentifier, user.Id.ToString()),
				new(ClaimTypes.Name, user.Username),
				new(ClaimTypes.Role, user.Role),
				new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
				new("username", user.Username),
				new("fullName", user.FullName),
				new("email", user.Email),
				new("role", user.Role),
				new("organizationId", user.OrganizationId?.ToString() ?? string.Empty),
			};

			var token = new JwtSecurityToken(
				issuer: "TYB.ApiService",
				audience: "TYB.Frontend",
				claims: claims,
				expires: DateTime.UtcNow.AddHours(expHours),
				signingCredentials: creds
			);

			return new JwtSecurityTokenHandler().WriteToken(token);
		}

		private static AuthUserDto MapToDto(User user) => new()
		{
			Id = user.Id,
			OrganizationId = user.OrganizationId,
			Username = user.Username,
			Email = user.Email,
			FullName = user.FullName,
			Role = RoleToString(user.Role),
			AvatarUrl = user.AvatarUrl,
		};

		private static string RoleToString(UserRole role) => role switch
		{
			UserRole.Admin => "admin",
			UserRole.FleetManager => "fleet_manager",
			UserRole.Driver => "driver",
			_ => "viewer"
		};
	}
}
