namespace TYB.IoTService.Infrastructure.Entities.Core
{
	public class Device
	{
		public Guid Id { get; set; }
		public Guid OrganizationId { get; set; }
		public string DeviceIdentifier { get; set; } = string.Empty;
		public string? SecretKey { get; set; }
		public string? Imei { get; set; }
		public string? IpAddress { get; set; }
		public int? SignalStrength { get; set; }
		public bool IsActive { get; set; }
		public DateTime? LastSeenAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
	}
}
