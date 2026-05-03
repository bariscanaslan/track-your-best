using Microsoft.AspNetCore.Mvc;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Authorization;

namespace TYB.ApiService.Controllers.Core
{
	[Route("api/uploads")]
	[ApiController]
	[AnyRole]
	public class UploadsController : ControllerBase
	{
		private readonly ProfileImageStorageService _profileImageStorageService;

		public UploadsController(ProfileImageStorageService profileImageStorageService)
		{
			_profileImageStorageService = profileImageStorageService;
		}

		[HttpPost("profile-image")]
		[RequestFormLimits(MultipartBodyLengthLimit = ProfileImageStorageService.MaxFileSizeBytes)]
		public async Task<IActionResult> UploadProfileImage(
			[FromForm] IFormFile? file,
			CancellationToken cancellationToken
		)
		{
			try
			{
				var uploaded = await _profileImageStorageService.SaveProfileImageAsync(
					file,
					Request,
					cancellationToken
				);
				return Ok(uploaded);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
		}
	}
}
