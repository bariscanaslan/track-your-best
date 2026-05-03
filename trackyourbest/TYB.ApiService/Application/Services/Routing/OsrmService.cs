using System.Text.Json;

namespace TYB.ApiService.Application.Services.Routing
{
	public class OsrmService
	{
		private readonly HttpClient _httpClient;

		public OsrmService(HttpClient httpClient)
		{
			_httpClient = httpClient;
		}

		public async Task<OsrmRouteResult> GetRouteAsync(
			double startLat,
			double startLng,
			double endLat,
			double endLng,
			CancellationToken cancellationToken
		)
		{
			var requestPath =
				$"/route/v1/driving/{startLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
				$"{startLat.ToString(System.Globalization.CultureInfo.InvariantCulture)};" +
				$"{endLng.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
				$"{endLat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
				"?overview=full&geometries=geojson";

			using var response = await _httpClient.GetAsync(requestPath, cancellationToken);
			response.EnsureSuccessStatusCode();

			var content = await response.Content.ReadAsStringAsync(cancellationToken);
			var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
			var osrmResponse = JsonSerializer.Deserialize<OsrmRouteResponse>(content, options);

			if (osrmResponse?.Routes is null || osrmResponse.Routes.Count == 0)
			{
				throw new InvalidOperationException("OSRM returned no routes.");
			}

			var route = osrmResponse.Routes[0];
			if (route.Geometry?.Coordinates is null || route.Geometry.Coordinates.Count == 0)
			{
				throw new InvalidOperationException("OSRM route geometry is empty.");
			}

			var coordinates = route.Geometry.Coordinates
				.Select(coord => new[] { coord[1], coord[0] }) // Convert to [lat, lng]
				.ToList();

			return new OsrmRouteResult
			{
				Coordinates = coordinates,
				DistanceMeters = route.Distance,
				DurationSeconds = route.Duration
			};
		}

		private class OsrmRouteResponse
		{
			public List<Route> Routes { get; set; } = [];
		}

		private class Route
		{
			public double Distance { get; set; }
			public double Duration { get; set; }
			public Geometry? Geometry { get; set; }
		}

		private class Geometry
		{
			public List<double[]> Coordinates { get; set; } = [];
		}
	}

	public class OsrmRouteResult
	{
		public List<double[]> Coordinates { get; set; } = [];
		public double DistanceMeters { get; set; }
		public double DurationSeconds { get; set; }
	}
}
