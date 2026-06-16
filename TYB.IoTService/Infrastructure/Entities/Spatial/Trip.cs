namespace TYB.IoTService.Infrastructure.Entities.Spatial
{
	public class Trip
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public string Status { get; set; } = string.Empty;
	}
}
