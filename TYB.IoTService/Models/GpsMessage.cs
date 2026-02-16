using System.Text.Json.Serialization;

namespace TYB.IoTService.Models
{
	public class GpsMessage
	{
		[JsonPropertyName("device_id")]
		public string? DeviceId { get; set; }

		[JsonPropertyName("latitude")]
		public double Latitude { get; set; }

		[JsonPropertyName("longitude")]
		public double Longitude { get; set; }

		[JsonPropertyName("timestamp")]
		public long? Timestamp { get; set; }

		[JsonPropertyName("signature")]
		public string? Signature { get; set; }
	}
}
