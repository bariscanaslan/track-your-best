namespace TYB.ApiService.Infrastructure.Entities.Core
{
	public class Device
	{
		public Guid Id { get; set; }
		public Guid? OrganizationId { get; set; }
		public string DeviceName { get; set; } = string.Empty;
		public string DeviceIdentifier { get; set; } = string.Empty;
		public string? DeviceModel { get; set; }
		public string MqttUsername { get; set; } = string.Empty;
		public string MqttPassword { get; set; } = string.Empty;
		public string SecretKey { get; set; } = string.Empty;
		public DateTime? InstallationDate { get; set; }
		public DateTime? LastMaintenanceDate { get; set; }
		public DateTime? NextMaintenanceDate { get; set; }
		public int? BatteryLevel { get; set; }
		public int? SignalStrength { get; set; }
		public bool? IsActive { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
		public string? Imei { get; set; }
		public string? IpAddress { get; set; }
		public DateTime? LastSeenAt { get; set; }
	}
}
