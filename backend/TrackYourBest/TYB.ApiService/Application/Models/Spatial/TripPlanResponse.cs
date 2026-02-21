namespace TYB.ApiService.Application.Models.Spatial
{
	public class TripPlanResponse
	{
		public Guid TripId { get; set; }
		public double DistanceKm { get; set; }
		public int DurationSeconds { get; set; }
		public List<double[]> Geometry { get; set; } = [];
	}
}
