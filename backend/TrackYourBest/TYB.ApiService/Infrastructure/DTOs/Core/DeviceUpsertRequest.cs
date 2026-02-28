namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class DeviceUpsertRequest
	{
		public Guid? OrganizationId { get; set; }
		public string DeviceName { get; set; } = string.Empty;
		public string DeviceIdentifier { get; set; } = string.Empty;
		public DateTime? InstallationDate { get; set; }
		public int? SignalStrength { get; set; }
		public string? Imei { get; set; }
		public string? IpAddress { get; set; }
		public DateTime? LastSeenAt { get; set; }
		public bool? IsActive { get; set; }
	}
}
