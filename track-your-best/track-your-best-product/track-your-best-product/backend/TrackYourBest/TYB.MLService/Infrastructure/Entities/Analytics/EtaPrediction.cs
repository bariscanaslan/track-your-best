// Dosya Yolu: TYB.MLService/Infrastructure/Entities/Analytics/EtaPrediction.cs

using NetTopologySuite.Geometries;

namespace TYB.MLService.Infrastructure.Entities.Analytics
{
    public class EtaPrediction
    {
        public Guid Id { get; set; }
        public Guid TripId { get; set; }
        public Guid DeviceId { get; set; }
        
        public DateTime PredictionTime { get; set; }
        public DateTime PredictedArrivalTime { get; set; }
        public DateTime? ActualArrivalTime { get; set; }
        
        public Point CurrentLocation { get; set; }
        public Point Destination { get; set; }
        public double? RemainingDistanceKm { get; set; }
        
        public int? PredictionErrorSeconds { get; set; }
        public double? AccuracyPercentage { get; set; }
        
        public string ModelVersion { get; set; }
        public double? ConfidenceScore { get; set; }
        
        public double? TrafficFactor { get; set; }
        public double? WeatherFactor { get; set; }
        public double? HistoricalPerformance { get; set; }
        
        public string Metadata { get; set; }  // JSON string
    }
}
