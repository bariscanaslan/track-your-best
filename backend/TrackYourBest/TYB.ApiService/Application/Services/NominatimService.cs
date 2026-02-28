using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace TYB.ApiService.Application.Services
{
	public class NominatimService
	{
		private readonly HttpClient _httpClient;
		private readonly IMemoryCache _cache;
		private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

		public NominatimService(HttpClient httpClient, IMemoryCache cache)
		{
			_httpClient = httpClient;
			_cache = cache;
		}

		public async Task<string?> ReverseGeocodeAsync(
			double latitude,
			double longitude,
			CancellationToken cancellationToken
		)
		{
			var cacheKey = BuildCacheKey(latitude, longitude);
			if (_cache.TryGetValue(cacheKey, out string? cached) && !string.IsNullOrWhiteSpace(cached))
			{
				return cached;
			}

			var lat = latitude.ToString(CultureInfo.InvariantCulture);
			var lon = longitude.ToString(CultureInfo.InvariantCulture);
			var requestPath = $"/reverse?format=jsonv2&lat={lat}&lon={lon}&addressdetails=1";

			using var response = await _httpClient.GetAsync(requestPath, cancellationToken);
			if (!response.IsSuccessStatusCode)
			{
				return null;
			}

			var content = await response.Content.ReadAsStringAsync(cancellationToken);
			if (string.IsNullOrWhiteSpace(content))
			{
				return null;
			}

			using var doc = JsonDocument.Parse(content);
			var root = doc.RootElement;

			string? displayName = null;
			if (root.TryGetProperty("display_name", out var displayNameElement))
			{
				displayName = displayNameElement.GetString();
			}

			string? fallbackAddress = null;
			if (root.TryGetProperty("address", out var addressElement)
				&& addressElement.ValueKind == JsonValueKind.Object)
			{
				fallbackAddress = BuildAddress(addressElement);
			}

			var address = !string.IsNullOrWhiteSpace(displayName) ? displayName : fallbackAddress;
			if (string.IsNullOrWhiteSpace(address))
			{
				return null;
			}

			_cache.Set(cacheKey, address, CacheDuration);
			return address;
		}

		public async Task<NominatimSearchResult?> ForwardGeocodeAsync(
			string query,
			CancellationToken cancellationToken
		)
		{
			var normalizedQuery = query.Trim();
			if (string.IsNullOrWhiteSpace(normalizedQuery))
			{
				return null;
			}

			var cacheKey = BuildForwardCacheKey(normalizedQuery);
			if (_cache.TryGetValue(cacheKey, out NominatimSearchResult? cached))
			{
				return cached;
			}

			var requestPath = $"/search?format=jsonv2&q={Uri.EscapeDataString(normalizedQuery)}&addressdetails=1&limit=1";
			using var response = await _httpClient.GetAsync(requestPath, cancellationToken);
			if (!response.IsSuccessStatusCode)
			{
				return null;
			}

			var content = await response.Content.ReadAsStringAsync(cancellationToken);
			if (string.IsNullOrWhiteSpace(content))
			{
				return null;
			}

			var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
			var results = JsonSerializer.Deserialize<List<NominatimSearchResponse>>(content, options);
			if (results is null || results.Count == 0)
			{
				return null;
			}

			var first = results[0];
			if (!double.TryParse(first.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude)
				|| !double.TryParse(first.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
			{
				return null;
			}

			var result = new NominatimSearchResult
			{
				DisplayName = first.DisplayName ?? normalizedQuery,
				Latitude = latitude,
				Longitude = longitude
			};

			_cache.Set(cacheKey, result, CacheDuration);
			return result;
		}

		private static string BuildCacheKey(double latitude, double longitude)
		{
			var lat = Math.Round(latitude, 6).ToString(CultureInfo.InvariantCulture);
			var lon = Math.Round(longitude, 6).ToString(CultureInfo.InvariantCulture);
			return $"nominatim:reverse:{lat}:{lon}";
		}

		private static string BuildForwardCacheKey(string query)
		{
			var normalized = query.Trim().ToLowerInvariant();
			return $"nominatim:forward:{normalized}";
		}

		private static string? BuildAddress(JsonElement addressElement)
		{
			var houseNumber = GetAddressField(addressElement, "house_number");
			var road = GetAddressField(addressElement, "road");
			var neighbourhood = GetAddressField(addressElement, "neighbourhood");
			var suburb = GetAddressField(addressElement, "suburb");
			var city = GetAddressField(addressElement, "city")
				?? GetAddressField(addressElement, "town")
				?? GetAddressField(addressElement, "village");
			var state = GetAddressField(addressElement, "state");
			var country = GetAddressField(addressElement, "country");

			var parts = new List<string>();
			if (!string.IsNullOrWhiteSpace(road))
			{
				var roadPart = string.IsNullOrWhiteSpace(houseNumber)
					? road
					: $"{houseNumber} {road}";
				parts.Add(roadPart);
			}
			else if (!string.IsNullOrWhiteSpace(houseNumber))
			{
				parts.Add(houseNumber);
			}

			AddIfPresent(parts, neighbourhood);
			AddIfPresent(parts, suburb);
			AddIfPresent(parts, city);
			AddIfPresent(parts, state);
			AddIfPresent(parts, country);

			return parts.Count > 0 ? string.Join(", ", parts) : null;
		}

		private static void AddIfPresent(List<string> parts, string? value)
		{
			if (!string.IsNullOrWhiteSpace(value))
			{
				parts.Add(value);
			}
		}

		private static string? GetAddressField(JsonElement element, string propertyName)
		{
			if (!element.TryGetProperty(propertyName, out var value))
			{
				return null;
			}

			return value.GetString();
		}

		private class NominatimSearchResponse
		{
			public string? DisplayName { get; set; }
			public string? Lat { get; set; }
			public string? Lon { get; set; }
		}
	}

	public class NominatimSearchResult
	{
		public string DisplayName { get; set; } = string.Empty;
		public double Latitude { get; set; }
		public double Longitude { get; set; }
	}
}
