// Dosya Yolu: TYB.MLService/Application/Controllers/EtaController.cs

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.Text.Json;
using TYB.MLService.Infrastructure.Data;
using TYB.MLService.Infrastructure.Entities.Analytics;
using TYB.MLService.Infrastructure.Services;
using TYB.MLService.ML.Services;

namespace TYB.MLService.Application.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EtaController : ControllerBase
    {
        private readonly IMLPredictionService _mlService;
        private readonly IOsrmService _osrmService;
        private readonly MLDbContext _dbContext;
        private readonly ILogger<EtaController> _logger;

        public EtaController(
            IMLPredictionService mlService,
            IOsrmService osrmService,
            MLDbContext dbContext,
            ILogger<EtaController> logger)
        {
            _mlService = mlService;
            _osrmService = osrmService;
            _dbContext = dbContext;
            _logger = logger;
        }

        [HttpPost("predict")]
        public async Task<IActionResult> PredictEta([FromBody] EtaPredictRequest request)
        {
            try
            {
                _logger.LogInformation("ETA Prediction started for TripId: {TripId}, DeviceId: {DeviceId}",
                    request.TripId, request.DeviceId);

                // 1. OSRM'den route al
                var osrmResponse = await _osrmService.GetRouteAsync(
                    request.StartLat, request.StartLon,
                    request.EndLat, request.EndLon
                );

                var route = osrmResponse.routes[0];
                double distanceKm = route.distance / 1000.0;
                int durationSec = (int)route.duration;

                _logger.LogInformation("OSRM Route: {Distance}km, {Duration}s", distanceKm, durationSec);

                // 2. ML API'den prediction al
                // CRITICAL: Use Turkey local time (UTC+3), not UTC!
                var turkeyTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
                var turkeyTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, turkeyTimeZone);

                var prediction = await _mlService.PredictEtaAsync(
                    distanceKm,
                    durationSec,
                    turkeyTime  // ✅ Turkey local time!
                );

                _logger.LogInformation("ML Prediction: {Minutes} minutes, Confidence: {Confidence}",
                    prediction.eta_minutes, prediction.confidence);

                // 3. PostgreSQL'e kaydet (tyb_analytics.eta_predictions)
                var etaPrediction = new EtaPrediction
                {
                    Id = Guid.NewGuid(),
                    TripId = request.TripId,
                    DeviceId = request.DeviceId,
                    PredictionTime = DateTime.UtcNow,
                    PredictedArrivalTime = DateTime.UtcNow.AddSeconds(prediction.eta_seconds),
                    CurrentLocation = new Point(request.StartLon, request.StartLat) { SRID = 4326 },
                    Destination = new Point(request.EndLon, request.EndLat) { SRID = 4326 },
                    RemainingDistanceKm = distanceKm,
                    ModelVersion = "istanbul_v1",
                    ConfidenceScore = prediction.confidence,
                    TrafficFactor = prediction.traffic_info.speed_factor,
                    Metadata = JsonSerializer.Serialize(new
                    {
                        prediction.eta_hours,
                        prediction.eta_minutes,  // ✅ Total minutes saved to metadata
                        prediction.eta_seconds,
                        traffic_info = prediction.traffic_info,
                        model_info = prediction.model_info
                    })
                };

                _dbContext.EtaPredictions.Add(etaPrediction);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation("ETA Prediction saved to database: {EtaId}", etaPrediction.Id);

                // 4. React'a response döner (sadece gerekli bilgiler)
                // ✅ CRITICAL FIX: Use eta_minutes (TOTAL) for calculations!
                return Ok(new
                {
                    prediction_id = etaPrediction.Id,

                    // ✅ FIX: Use eta_minutes (TOTAL minutes), NOT eta_minutes_display!
                    eta_minutes = prediction.eta_minutes,  // ✅ TOTAL (e.g., 72.12)

                    eta_hours = prediction.eta_hours,
                    eta_minutes_display = prediction.eta_minutes_display,  // Just minute part (e.g., 12)
                    eta_seconds = prediction.eta_seconds,

                    // Formatted string for UI display
                    eta_formatted = prediction.eta_hours > 0
                        ? $"{prediction.eta_hours}h {prediction.eta_minutes_display}min"
                        : $"{prediction.eta_minutes_display}min",

                    predicted_arrival_time = etaPrediction.PredictedArrivalTime,
                    distance_km = Math.Round(distanceKm, 2),
                    confidence = Math.Round(prediction.confidence, 4),

                    traffic_info = new
                    {
                        is_rush_hour = prediction.traffic_info.is_rush_hour,
                        avg_speed_kmh = Math.Round(prediction.traffic_info.avg_speed_kmh, 1),
                        traffic_density = Math.Round(prediction.traffic_info.traffic_density, 1),
                        hour = prediction.traffic_info.hour,  // For debugging
                        day_of_week = prediction.traffic_info.day_of_week
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ETA Prediction failed for TripId: {TripId}", request.TripId);
                return StatusCode(500, new
                {
                    error = "ETA prediction failed",
                    message = ex.Message
                });
            }
        }

        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            var mlHealthy = await _mlService.IsHealthyAsync();
            var dbHealthy = await _dbContext.Database.CanConnectAsync();

            var status = (mlHealthy && dbHealthy) ? "healthy" : "unhealthy";

            _logger.LogInformation("Health Check: Status={Status}, ML={ML}, DB={DB}",
                status, mlHealthy, dbHealthy);

            return Ok(new
            {
                status,
                ml_api = mlHealthy,
                database = dbHealthy,
                timestamp = DateTime.UtcNow
            });
        }

        [HttpGet("predictions/{tripId}")]
        public async Task<IActionResult> GetPredictionsByTrip(Guid tripId)
        {
            try
            {
                var predictions = await _dbContext.EtaPredictions
                    .Where(p => p.TripId == tripId)
                    .OrderByDescending(p => p.PredictionTime)
                    .ToListAsync();

                return Ok(predictions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching predictions for TripId: {TripId}", tripId);
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class EtaPredictRequest
    {
        public Guid TripId { get; set; }
        public Guid DeviceId { get; set; }
        public double StartLat { get; set; }
        public double StartLon { get; set; }
        public double EndLat { get; set; }
        public double EndLon { get; set; }
    }
}