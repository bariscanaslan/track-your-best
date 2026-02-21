using NetTopologySuite.Geometries;

namespace TYB.ApiService.Infrastructure.Entities.Spatial
{
	public class Trip
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public Guid? DriverId { get; set; }
		public string? TripName { get; set; }
		public TripStatus? Status { get; set; }
		public Point? StartLocation { get; set; }
		public Point? EndLocation { get; set; }
		public string? StartAddress { get; set; }
		public string? EndAddress { get; set; }
		public DateTime StartTime { get; set; }
		public DateTime? EndTime { get; set; }
		public DateTime? PlannedEndTime { get; set; }
		public int? DurationSeconds { get; set; }
		public decimal? TotalDistanceKm { get; set; }
		public LineString? RouteGeometry { get; set; }
		public decimal? MaxSpeed { get; set; }
		public decimal? AvgSpeed { get; set; }
		public int? StopCount { get; set; }
		public int? HarshAccelerationCount { get; set; }
		public int? HarshBrakingCount { get; set; }
		public string? Purpose { get; set; }
		public string? Notes { get; set; }
		public string? Metadata { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
	}
}
