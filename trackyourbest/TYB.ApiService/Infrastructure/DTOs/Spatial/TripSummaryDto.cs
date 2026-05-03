namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class TripSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public string? TripName { get; set; }
		public string? Status { get; set; }
		public string? StartLocation { get; set; }
		public string? EndLocation { get; set; }
		public string? StartAddress { get; set; }
		public string? EndAddress { get; set; }
		public DateTime StartTime { get; set; }
		public DateTime? EndTime { get; set; }
		public DateTime? PlannedEndTime { get; set; }
		public int? DurationSeconds { get; set; }
		public double? TotalDistanceKm { get; set; }
		public double? MaxSpeed { get; set; }
		public double? AvgSpeed { get; set; }
		public int? StopCount { get; set; }
		public int? PauseCount { get; set; }
		public string? Notes { get; set; }
		public DateTime? CreatedAt { get; set; }
		public List<double[]>? Geometry { get; set; }
	}
}
