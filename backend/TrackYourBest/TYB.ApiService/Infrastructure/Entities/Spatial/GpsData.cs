using NetTopologySuite.Geometries;

namespace TYB.ApiService.Infrastructure.Entities.Spatial
{
	public class GpsData
	{
		public Guid Id { get; set; }
		public Guid DeviceId { get; set; }
		public Guid? TripId { get; set; }
		public Point? Location { get; set; }
		public double Latitude { get; set; }
		public double Longitude { get; set; }
		public DateTime? GpsTimestamp { get; set; }
		public DateTime? ReceivedTimestamp { get; set; }
		public Guid? OrganizationId { get; set; }
	}
}
