namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class TripPlanRequest
	{
		public Guid VehicleId { get; set; }
		public Guid? DriverId { get; set; }
		public string? TripName { get; set; }
		public double StartLat { get; set; }
		public double StartLng { get; set; }
		public double EndLat { get; set; }
		public double EndLng { get; set; }
		public string? StartAddress { get; set; }
		public string? EndAddress { get; set; }
		public DateTime? PlannedEndTime { get; set; }
		public string? Purpose { get; set; }
		public string? Notes { get; set; }
	}
}
