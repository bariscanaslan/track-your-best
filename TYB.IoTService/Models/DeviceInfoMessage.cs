using System.Text.Json.Serialization;

namespace TYB.IoTService.Models
{
	public class DeviceInfoMessage
	{
		[JsonPropertyName("device_id")]
		public string? DeviceId { get; set; }

		[JsonPropertyName("imei")]
		public string? Imei { get; set; }

		[JsonPropertyName("ip")]
		public string? Ip { get; set; }

		[JsonPropertyName("rssi")]
		public int? Rssi { get; set; }
	}
}
