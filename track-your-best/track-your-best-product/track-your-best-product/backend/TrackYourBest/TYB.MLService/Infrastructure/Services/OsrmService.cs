// Dosya: TYB.MLService/Infrastructure/Services/OsrmService.cs

using TYB.MLService.ML.Models;
using System.Globalization;  

namespace TYB.MLService.Infrastructure.Services
{
    public class OsrmService : IOsrmService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OsrmService> _logger;

        public OsrmService(
            HttpClient httpClient,
            ILogger<OsrmService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;

            var baseUrl = configuration["Osrm:BaseUrl"] ?? "http://localhost:5000";
            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public async Task<OsrmResponse> GetRouteAsync(
            double startLat,
            double startLon,
            double endLat,
            double endLon)
        {
            try
            {
                // ? CultureInfo ile nokta (.) formatý zorla
                var culture = CultureInfo.InvariantCulture;

                var url = string.Format(
                    culture,
                    "/route/v1/driving/{0:0.######},{1:0.######};{2:0.######},{3:0.######}",
                    startLon, startLat, endLon, endLat
                );

                _logger.LogInformation("OSRM Request URL: {Url}", url);

                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError(
                        "OSRM API error: {StatusCode}, Response: {Content}",
                        response.StatusCode,
                        errorContent
                    );
                    throw new Exception($"OSRM API returned {response.StatusCode}: {errorContent}");
                }

                var result = await response.Content.ReadFromJsonAsync<OsrmResponse>();

                if (result?.routes == null || result.routes.Length == 0)
                {
                    _logger.LogWarning("No route found");
                    throw new Exception("No route found");
                }

                var route = result.routes[0];
                _logger.LogInformation(
                    "OSRM Response: Distance={Distance}m, Duration={Duration}s",
                    route.distance, route.duration
                );

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting OSRM route");
                throw;
            }
        }
    }
}