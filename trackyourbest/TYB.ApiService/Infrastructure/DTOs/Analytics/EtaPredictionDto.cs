namespace TYB.ApiService.Infrastructure.DTOs.Analytics
{
	public class EtaPredictionDto
	{
		public Guid Id { get; set; }
		public Guid TripId { get; set; }
		public DateTime PredictionTime { get; set; }
		public DateTime? PredictedArrivalTime { get; set; }
		public double? RemainingDistanceKm { get; set; }
		public double? ConfidenceScore { get; set; }
		public double? TrafficFactor { get; set; }
		public string? ModelVersion { get; set; }

		// Parsed from metadata JSON
		public double? EtaMinutes { get; set; }
		public bool? IsRushHour { get; set; }
		public double? AvgSpeedKmh { get; set; }
		public double? TrafficDensity { get; set; }
		public string? DayOfWeek { get; set; }
		public bool? IsWeekend { get; set; }
	}
}
