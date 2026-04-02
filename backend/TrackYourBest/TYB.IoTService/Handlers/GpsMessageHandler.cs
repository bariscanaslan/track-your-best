using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using TYB.IoTService.Infrastructure.Data;
using TYB.IoTService.Infrastructure.Entities.Spatial;
using TYB.IoTService.Models;
using TYB.IoTService.Routing;

namespace TYB.IoTService.Handlers
{
	public class GpsMessageHandler : IMessageHandler
	{
		private static readonly JsonSerializerOptions JsonOptions = new()
		{
			PropertyNameCaseInsensitive = true
		};

		private readonly IoTDbContext _dbContext;
		private readonly ILogger<GpsMessageHandler> _logger;

		public GpsMessageHandler(IoTDbContext dbContext, ILogger<GpsMessageHandler> logger)
		{
			_dbContext = dbContext;
			_logger = logger;
		}

		public bool CanHandle(string topic)
		{
			return topic.StartsWith("gps/");
		}

		public async Task HandleAsync(string topic, string payload)
		{
			if (!TopicParser.TryGetDeviceId(topic, "gps", out var deviceId))
			{
				_logger.LogWarning("Invalid GPS topic: {Topic}", topic);
				return;
			}

			GpsMessage? message;
			try
			{
				message = JsonSerializer.Deserialize<GpsMessage>(payload, JsonOptions);
			}
			catch (JsonException ex)
			{
				_logger.LogWarning(ex, "Invalid GPS payload for device {DeviceId}", deviceId);
				return;
			}

			if (message == null)
			{
				_logger.LogWarning("Empty GPS payload for device {DeviceId}", deviceId);
				return;
			}

			if (!string.IsNullOrWhiteSpace(message.DeviceId)
				&& !message.DeviceId.Equals(deviceId, StringComparison.OrdinalIgnoreCase))
			{
				_logger.LogWarning(
					"GPS device id mismatch. Topic={TopicDeviceId}, Payload={PayloadDeviceId}",
					deviceId,
					message.DeviceId
				);
				return;
			}

			var device = await _dbContext.Devices
				.AsNoTracking()
				.FirstOrDefaultAsync(d => d.DeviceIdentifier == deviceId);

			if (device == null)
			{
				_logger.LogWarning("GPS device not found: {DeviceId}", deviceId);
				return;
			}

			if (!device.IsActive)
			{
				_logger.LogWarning("GPS data rejected for inactive device: {DeviceId}", deviceId);
				return;
			}

			var now = DateTime.UtcNow;

			if (!IsValidSignature(device.SecretKey, message, out var signatureError))
			{
				var invalidRaw = new GpsRaw
				{
					Id = Guid.NewGuid(),
					OrganizationId = device.OrganizationId,
					DeviceId = device.Id,
					DeviceIdentifier = device.DeviceIdentifier,
					Payload = payload,
					ReceivedAt = now,
					MqttTopic = topic,
					Signature = message.Signature,
					IsValid = false,
					ValidationError = signatureError
				};

				_dbContext.GpsRaw.Add(invalidRaw);
				await _dbContext.SaveChangesAsync();
				return;
			}

			var location = new Point(message.Longitude, message.Latitude)
			{
				SRID = 4326
			};

			var gpsData = new GpsData
			{
				Id = Guid.NewGuid(),
				OrganizationId = device.OrganizationId,
				DeviceId = device.Id,
				Latitude = message.Latitude,
				Longitude = message.Longitude,
				Location = location,
				GpsTimestamp = now,
				ReceivedTimestamp = now
			};

			var gpsRaw = new GpsRaw
			{
				Id = Guid.NewGuid(),
				OrganizationId = device.OrganizationId,
				DeviceId = device.Id,
				DeviceIdentifier = device.DeviceIdentifier,
				Payload = payload,
				ReceivedAt = now,
				MqttTopic = topic,
				Signature = message.Signature,
				IsValid = true
			};

			_dbContext.GpsRaw.Add(gpsRaw);
			_dbContext.GpsData.Add(gpsData);
			await _dbContext.SaveChangesAsync();
		}

		private static bool IsValidSignature(string? secretKey, GpsMessage message, out string? error)
		{
			error = null;

			if (string.IsNullOrWhiteSpace(secretKey))
			{
				error = "missing_secret_key";
				return false;
			}

			if (string.IsNullOrWhiteSpace(message.Signature))
			{
				error = "missing_signature";
				return false;
			}

			var payload = BuildSignaturePayload(message);
			if (payload == null)
			{
				error = "invalid_payload";
				return false;
			}

			var computed = ComputeHmacSha256Hex(payload, secretKey);
			var provided = message.Signature.Trim().ToLowerInvariant();
			var matches = FixedTimeEquals(computed, provided);

			if (!matches)
			{
				error = "invalid_signature";
			}

			return matches;
		}

		private static string? BuildSignaturePayload(GpsMessage message)
		{
			if (string.IsNullOrWhiteSpace(message.DeviceId))
			{
				return null;
			}

			var lat = message.Latitude.ToString("G", CultureInfo.InvariantCulture);
			var lon = message.Longitude.ToString("G", CultureInfo.InvariantCulture);
			var ts = message.Timestamp?.ToString(CultureInfo.InvariantCulture) ?? "0";

			return $"{{\"device_id\":\"{message.DeviceId}\",\"latitude\":{lat},\"longitude\":{lon},\"timestamp\":{ts}}}";
		}

		private static string ComputeHmacSha256Hex(string payload, string secretKey)
		{
			var keyBytes = Encoding.UTF8.GetBytes(secretKey);
			var payloadBytes = Encoding.UTF8.GetBytes(payload);

			using var hmac = new HMACSHA256(keyBytes);
			var hash = hmac.ComputeHash(payloadBytes);

			var sb = new StringBuilder(hash.Length * 2);
			foreach (var b in hash)
			{
				sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
			}

			return sb.ToString();
		}

		private static bool FixedTimeEquals(string a, string b)
		{
			if (a.Length != b.Length)
			{
				return false;
			}

			var diff = 0;
			for (var i = 0; i < a.Length; i++)
			{
				diff |= a[i] ^ b[i];
			}

			return diff == 0;
		}
	}
}
