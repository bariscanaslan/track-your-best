using NetTopologySuite.Geometries;

namespace TYB.ApiService.Infrastructure.Entities.Analytics
{
	public class Anomaly
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
		public string? Metadata { get; set; }
		public Point? Location { get; set; }
	}
}
