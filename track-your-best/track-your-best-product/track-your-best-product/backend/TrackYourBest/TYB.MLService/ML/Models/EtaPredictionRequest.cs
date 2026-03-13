// Dosya Yolu: TYB.MLService/ML/Models/EtaPredictionRequest.cs
using System.Text.Json.Serialization;

namespace TYB.MLService.ML.Models
{
    public class EtaPredictionRequest
    {
        [JsonPropertyName("distance_km")]
        public double distance_km { get; set; }

        [JsonPropertyName("osrm_duration_sec")]
        public int osrm_duration_sec { get; set; }

        [JsonPropertyName("timestamp")]
        public string timestamp { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    }
}