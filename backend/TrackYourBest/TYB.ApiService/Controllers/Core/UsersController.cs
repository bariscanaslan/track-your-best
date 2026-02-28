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
	}
}
