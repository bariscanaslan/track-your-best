// Dosya Yolu: TYB.MLService/ML/Services/MLPredictionService.cs

using System.Text;
using System.Text.Json;
using TYB.MLService.ML.Models;

namespace TYB.MLService.ML.Services
{
    public class MLPredictionService : IMLPredictionService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<MLPredictionService> _logger;

        public MLPredictionService(
            HttpClient httpClient,
            ILogger<MLPredictionService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            
            var baseUrl = configuration["MLApi:BaseUrl"] ?? "http://localhost:5001";
            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
        }

        public async Task<EtaPredictionResponse> PredictEtaAsync(
            double distanceKm,
            int osrmDurationSec,
            DateTime? timestamp = null)
        {
            try
            {
                var request = new EtaPredictionRequest
                {
                    distance_km = distanceKm,
                    osrm_duration_sec = osrmDurationSec,
                    timestamp = (timestamp ?? DateTime.Now).ToString("yyyy-MM-dd HH:mm:ss")
                };

                _logger.LogInformation(
                    "ML Prediction Request: Distance={Distance}km, Duration={Duration}sec",
                    distanceKm, osrmDurationSec
                );

                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("/predict_eta", content);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("ML API error: {StatusCode} - {Error}", 
                        response.StatusCode, error);
                    throw new Exception($"ML API returned {response.StatusCode}");
                }

                var result = await response.Content.ReadFromJsonAsync<EtaPredictionResponse>();

                _logger.LogInformation(
                    "ML Prediction Response: {Minutes} minutes, Confidence: {Confidence}",
                    result.eta_minutes, result.confidence
                );

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error predicting ETA");
                throw;
            }
        }

        public async Task<bool> IsHealthyAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/health");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ML API health check failed");
                return false;
            }
        }
    }
}
