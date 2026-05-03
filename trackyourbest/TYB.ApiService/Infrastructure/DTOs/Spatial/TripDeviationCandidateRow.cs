using NetTopologySuite.Geometries;

namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class TripDeviationCandidateRow
	{
		public Guid TripId { get; set; }
		public Guid VehicleId { get; set; }
		public Guid DeviceId { get; set; }
		public Point? EndLocation { get; set; }
		public LineString? RouteGeometry { get; set; }
		public double Latitude { get; set; }
		public double Longitude { get; set; }
		public DateTime PositionTimestamp { get; set; }
		public double DistanceToRouteMeters { get; set; }
	}
}
