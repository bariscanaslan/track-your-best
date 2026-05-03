using NetTopologySuite.Geometries;

namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class DeviceLastLocationRow
	{
		public Guid DeviceId { get; set; }
		public Guid? VehicleId { get; set; }
		public string? DeviceName { get; set; }
		public Guid? TripId { get; set; }
		public Point? Location { get; set; }
		public double Latitude { get; set; }
		public double Longitude { get; set; }
		public DateTime? GpsTimestamp { get; set; }
		public DateTime? ReceivedTimestamp { get; set; }
	}
}
