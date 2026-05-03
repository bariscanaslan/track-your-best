namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class DeviceUpsertRequest
	{
		public Guid? OrganizationId { get; set; }
		public string DeviceName { get; set; } = string.Empty;
		public string DeviceIdentifier { get; set; } = string.Empty;
		public string? DeviceModel { get; set; }
		public string? MqttUsername { get; set; }
		public string? MqttPassword { get; set; }
		public string? SecretKey { get; set; }
		public DateTime? InstallationDate { get; set; }
		public DateTime? LastMaintenanceDate { get; set; }
		public DateTime? NextMaintenanceDate { get; set; }
		public string? Imei { get; set; }
		public string? IpAddress { get; set; }
		public bool? IsActive { get; set; }
	}
}
