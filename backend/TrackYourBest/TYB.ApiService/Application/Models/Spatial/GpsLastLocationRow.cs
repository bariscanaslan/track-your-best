namespace TYB.ApiService.Application.Models.Spatial
{
	public class GpsLastLocationRow
	{
		public Guid DeviceId { get; set; }
		public Guid VehicleId { get; set; }
		public string? VehicleName { get; set; }
		public string? DeviceIdentifier { get; set; }
		public double Latitude { get; set; }
		public double Longitude { get; set; }
		public DateTime? GpsTimestamp { get; set; }
		public DateTime? ReceivedTimestamp { get; set; }
	}
}
