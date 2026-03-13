using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.DTOs.Core;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	public class UsersController : ControllerBase
	{
		private readonly CoreService _coreService;

		public UsersController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet]
		public async Task<IActionResult> GetUsers(
			[FromQuery] Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetUsersAsync(organizationId, cancellationToken);
			return Ok(data);
		}

		[HttpGet("{userId:guid}")]
		public async Task<IActionResult> GetUser(
			[FromRoute] Guid userId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetUserByIdAsync(userId, cancellationToken);
			return data is null ? NotFound() : Ok(data);
		}

		[HttpPost]
		public async Task<IActionResult> CreateUser(
			[FromBody] UserUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var created = await _coreService.CreateUserAsync(request, cancellationToken);
				return CreatedAtAction(nameof(GetUser), new { userId = created?.Id }, created);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}

		[HttpPut("{userId:guid}")]
		public async Task<IActionResult> UpdateUser(
			[FromRoute] Guid userId,
			[FromBody] UserUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var updated = await _coreService.UpdateUserAsync(userId, request, cancellationToken);
			return updated is null ? NotFound() : Ok(updated);
		}

		[HttpDelete("{userId:guid}")]
		public async Task<IActionResult> DeleteUser(
			[FromRoute] Guid userId,
			CancellationToken cancellationToken
		)
		{
			var removed = await _coreService.DeleteUserAsync(userId, cancellationToken);
			return removed ? NoContent() : NotFound();
		}
	}
}
