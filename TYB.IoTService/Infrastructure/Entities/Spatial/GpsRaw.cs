namespace TYB.IoTService.Infrastructure.Entities.Spatial
{
	public class GpsRaw
	{
		public Guid Id { get; set; }
		public Guid OrganizationId { get; set; }
		public Guid DeviceId { get; set; }
		public string DeviceIdentifier { get; set; } = string.Empty;
		public string Payload { get; set; } = string.Empty;
		public DateTime ReceivedAt { get; set; }
		public string MqttTopic { get; set; } = string.Empty;
		public string? SourceIp { get; set; }
		public string? Signature { get; set; }
		public bool IsValid { get; set; }
		public string? ValidationError { get; set; }
	}
}
