namespace TYB.ApiService.Infrastructure.DTOs.Analytics
{
	public class AnomalySummaryDto
	{
		public Guid Id { get; set; }
		public Guid TripId { get; set; }
		public Guid DeviceId { get; set; }
		public string? AnomalyType { get; set; }
		public string? Severity { get; set; }
		public string? Description { get; set; }
		public double? ConfidenceScore { get; set; }
		public string? AlgorithmUsed { get; set; }
		public DateTime DetectedAt { get; set; }
		public double? Latitude { get; set; }
		public double? Longitude { get; set; }
		public List<string> Flags { get; set; } = new();
		public double? AnomalyScore { get; set; }
	}
}
