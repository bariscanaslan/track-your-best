// Dosya Yolu: TYB.MLService/ML/Models/EtaPredictionResponse.cs

namespace TYB.MLService.ML.Models
{
    public class EtaPredictionResponse
    {
        public double eta_minutes { get; set; }
        public int eta_seconds { get; set; }
        public int eta_hours { get; set; }
        public int eta_minutes_display { get; set; }
        public double confidence { get; set; }
        public TrafficInfo traffic_info { get; set; }
        public InputData input { get; set; }
        public ModelInfo model_info { get; set; }
    }

    public class TrafficInfo
    {
        public int hour { get; set; }
        public int day_of_week { get; set; }
        public bool is_weekend { get; set; }
        public bool is_rush_hour { get; set; }
        public double avg_speed_kmh { get; set; }
        public double traffic_density { get; set; }
        public double speed_factor { get; set; }
    }

    public class InputData
    {
        public double distance_km { get; set; }
        public int osrm_duration_sec { get; set; }
        public string timestamp { get; set; }
    }

    public class ModelInfo
    {
        public double mae_minutes { get; set; }
        public double r2_score { get; set; }
    }
}
