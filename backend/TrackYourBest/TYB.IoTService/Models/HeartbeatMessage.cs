using System.Text.Json.Serialization;

namespace TYB.IoTService.Models
{
	public class HeartbeatMessage
	{
		[JsonPropertyName("status")]
		public string? Status { get; set; }

		[JsonPropertyName("device_id")]
		public string? DeviceId { get; set; }
	}
}
