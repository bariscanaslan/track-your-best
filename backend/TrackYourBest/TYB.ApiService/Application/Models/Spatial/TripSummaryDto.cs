namespace TYB.ApiService.Application.Models.Spatial
{
	public class TripSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public Guid? DriverId { get; set; }
		public string? TripName { get; set; }
		public string? Status { get; set; }
		public DateTime StartTime { get; set; }
		public DateTime? PlannedEndTime { get; set; }
		public DateTime? EndTime { get; set; }
		public double? TotalDistanceKm { get; set; }
		public int? DurationSeconds { get; set; }
		public List<double[]>? Geometry { get; set; }
	}
}
