// Dosya Yolu: TYB.MLService/ML/Models/EtaPredictionResponse.cs
using System.Text.Json.Serialization;

namespace TYB.MLService.ML.Models
{
    public class EtaPredictionResponse
    {
        [JsonPropertyName("eta_minutes")]
        public double eta_minutes { get; set; }

        [JsonPropertyName("eta_seconds")]
        public int eta_seconds { get; set; }

        [JsonPropertyName("eta_hours")]
        public int eta_hours { get; set; }

        [JsonPropertyName("eta_minutes_display")]
        public int eta_minutes_display { get; set; }

        [JsonPropertyName("confidence")]
        public double confidence { get; set; }

        [JsonPropertyName("traffic_info")]
        public TrafficInfo traffic_info { get; set; }

        [JsonPropertyName("input")]
        public InputData input { get; set; }

        [JsonPropertyName("model_info")]
        public ModelInfo model_info { get; set; }
    }

    public class TrafficInfo
    {
        [JsonPropertyName("hour")]
        public int hour { get; set; }

        [JsonPropertyName("day_of_week")]
        public int day_of_week { get; set; }

        [JsonPropertyName("is_weekend")]
        public bool is_weekend { get; set; }

        [JsonPropertyName("is_rush_hour")]
        public bool is_rush_hour { get; set; }

        [JsonPropertyName("avg_speed_kmh")]
        public double avg_speed_kmh { get; set; }

        [JsonPropertyName("traffic_density")]
        public double traffic_density { get; set; }

        [JsonPropertyName("speed_factor")]
        public double speed_factor { get; set; }
    }

    public class InputData
    {
        [JsonPropertyName("distance_km")]
        public double distance_km { get; set; }

        [JsonPropertyName("osrm_duration_sec")]
        public int osrm_duration_sec { get; set; }

        [JsonPropertyName("timestamp")]
        public string timestamp { get; set; }
    }

    public class ModelInfo
    {
        [JsonPropertyName("mae_minutes")]
        public double mae_minutes { get; set; }

        [JsonPropertyName("r2_score")]
        public double r2_score { get; set; }
    }
}