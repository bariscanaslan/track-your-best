namespace TYB.ApiService.Infrastructure.Entities.Analytics
{
	public class EtaPrediction
	{
		public Guid Id { get; set; }
		public Guid TripId { get; set; }
		public Guid? DeviceId { get; set; }
		public DateTime PredictionTime { get; set; }
		public DateTime? PredictedArrivalTime { get; set; }
		public double? RemainingDistanceKm { get; set; }
		public double? ConfidenceScore { get; set; }
		public double? TrafficFactor { get; set; }
		public string? ModelVersion { get; set; }
		/// <summary>Raw JSONB from the ML service containing eta_minutes, is_rush_hour, avg_speed_kmh, etc.</summary>
		public string? Metadata { get; set; }
	}
}
