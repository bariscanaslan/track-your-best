using Microsoft.AspNetCore.Http;
using TYB.ApiService.Infrastructure.DTOs.Core;

namespace TYB.ApiService.Application.Services
{
	public class ProfileImageStorageService
	{
		public const long MaxFileSizeBytes = 5 * 1024 * 1024;

		private static readonly IReadOnlyDictionary<string, string> AllowedContentTypes =
			new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
			{
				["image/jpeg"] = ".jpg",
				["image/png"] = ".png",
				["image/gif"] = ".gif",
				["image/webp"] = ".webp"
			};

		private readonly IWebHostEnvironment _environment;

		public ProfileImageStorageService(IWebHostEnvironment environment)
		{
			_environment = environment;
		}

		public async Task<UploadedImageDto> SaveProfileImageAsync(
			IFormFile? file,
			HttpRequest request,
			CancellationToken cancellationToken
		)
		{
			if (file is null || file.Length <= 0)
			{
				throw new InvalidOperationException("Select an image file to upload.");
			}

			if (!AllowedContentTypes.TryGetValue(file.ContentType ?? string.Empty, out var extension))
			{
				throw new InvalidOperationException("Only JPEG, PNG, GIF, and WebP images are allowed.");
			}

			if (file.Length > MaxFileSizeBytes)
			{
				throw new InvalidOperationException("Image must be smaller than 5 MB.");
			}

			var now = DateTime.UtcNow;
			var webRootPath = string.IsNullOrWhiteSpace(_environment.WebRootPath)
				? Path.Combine(_environment.ContentRootPath, "wwwroot")
				: _environment.WebRootPath;
			var relativeFolder = Path.Combine("uploads", "avatars", now.ToString("yyyy"), now.ToString("MM"));
			var absoluteFolder = Path.Combine(webRootPath, relativeFolder);

			Directory.CreateDirectory(absoluteFolder);

			var fileName = $"{Guid.NewGuid():N}{extension}";
			var absolutePath = Path.Combine(absoluteFolder, fileName);

			await using (var stream = new FileStream(
				absolutePath,
				FileMode.CreateNew,
				FileAccess.Write,
				FileShare.None,
				81920,
				useAsync: true
			))
			{
				await file.CopyToAsync(stream, cancellationToken);
			}

			var relativeUrl = "/" + Path.Combine(relativeFolder, fileName).Replace("\\", "/");
			var publicUrl = $"{request.Scheme}://{request.Host}{request.PathBase}{relativeUrl}";

			return new UploadedImageDto
			{
				FileName = fileName,
				ContentType = file.ContentType ?? string.Empty,
				Size = file.Length,
				RelativeUrl = relativeUrl,
				Url = publicUrl
			};
		}
	}
}
