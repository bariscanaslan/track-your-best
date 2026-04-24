using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Authorization;
using TYB.ApiService.Infrastructure.DTOs.Core;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/[controller]")]
	[ApiController]
	[AnyRole]
	public class OrganizationsController : ControllerBase
	{
		private readonly CoreService _coreService;

		public OrganizationsController(CoreService coreService)
		{
			_coreService = coreService;
		}

		[HttpGet]
		public async Task<IActionResult> GetOrganizations(CancellationToken cancellationToken)
		{
			var data = await _coreService.GetOrganizationsAsync(cancellationToken);
			return Ok(data);
		}

		[HttpGet("{orgId:guid}")]
		public async Task<IActionResult> GetOrganization(
			[FromRoute] Guid orgId,
			CancellationToken cancellationToken
		)
		{
			var data = await _coreService.GetOrganizationByIdAsync(orgId, cancellationToken);
			return data is null ? NotFound() : Ok(data);
		}

		[HttpPost]
		public async Task<IActionResult> CreateOrganization(
			[FromBody] OrganizationUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var created = await _coreService.CreateOrganizationAsync(request, cancellationToken);
				return CreatedAtAction(nameof(GetOrganization), new { orgId = created?.Id }, created);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}

		[HttpPut("{orgId:guid}")]
		public async Task<IActionResult> UpdateOrganization(
			[FromRoute] Guid orgId,
			[FromBody] OrganizationUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var updated = await _coreService.UpdateOrganizationAsync(orgId, request, cancellationToken);
			return updated is null ? NotFound() : Ok(updated);
		}

		[HttpDelete("{orgId:guid}")]
		public async Task<IActionResult> DeleteOrganization(
			[FromRoute] Guid orgId,
			CancellationToken cancellationToken
		)
		{
			var removed = await _coreService.DeleteOrganizationAsync(orgId, cancellationToken);
			return removed ? NoContent() : NotFound();
		}
	}
}
