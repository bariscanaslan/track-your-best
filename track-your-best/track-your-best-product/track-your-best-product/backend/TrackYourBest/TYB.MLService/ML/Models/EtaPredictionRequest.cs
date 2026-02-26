// Dosya Yolu: TYB.MLService/ML/Models/EtaPredictionRequest.cs

namespace TYB.MLService.ML.Models
{
    public class EtaPredictionRequest
    {
        public double distance_km { get; set; }
        public int osrm_duration_sec { get; set; }
        public string timestamp { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    }
}
