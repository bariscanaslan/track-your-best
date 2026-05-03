using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TYB.IoTService.Infrastructure.Data;
using TYB.IoTService.Models;
using TYB.IoTService.Routing;

namespace TYB.IoTService.Handlers
{
	public class HeartbeatMessageHandler : IMessageHandler
	{
		private static readonly JsonSerializerOptions JsonOptions = new()
		{
			PropertyNameCaseInsensitive = true
		};

		private readonly IoTDbContext _dbContext;
		private readonly ILogger<HeartbeatMessageHandler> _logger;

		public HeartbeatMessageHandler(IoTDbContext dbContext, ILogger<HeartbeatMessageHandler> logger)
		{
			_dbContext = dbContext;
			_logger = logger;
		}

		public bool CanHandle(string topic)
			=> topic.StartsWith("heartbeat/");

		public async Task HandleAsync(string topic, string payload)
		{
			var hasTopicDeviceId = TopicParser.TryGetDeviceId(topic, "heartbeat", out var deviceId);
			if (hasTopicDeviceId && deviceId.Equals("alive", StringComparison.OrdinalIgnoreCase))
			{
				hasTopicDeviceId = false;
			}

			HeartbeatMessage? message = null;
			string? fallbackFromPayload = null;
			if (!string.IsNullOrWhiteSpace(payload))
			{
				try
				{
					message = JsonSerializer.Deserialize<HeartbeatMessage>(payload, JsonOptions);
					fallbackFromPayload = ExtractDeviceIdFromPayload(message);
				}
				catch (JsonException)
				{
					fallbackFromPayload = ExtractDeviceIdFromRawPayload(payload);
				}
			}

			if (!hasTopicDeviceId)
			{
				if (!string.IsNullOrWhiteSpace(fallbackFromPayload))
				{
					deviceId = fallbackFromPayload;
					hasTopicDeviceId = true;
				}
			}

			if (!hasTopicDeviceId)
			{
				return;
			}

			if (message != null
				&& !string.IsNullOrWhiteSpace(message.DeviceId)
				&& !message.DeviceId.Equals(deviceId, StringComparison.OrdinalIgnoreCase))
			{
				return;
			}

			var device = await _dbContext.Devices
				.Where(d => d.DeviceIdentifier == deviceId && d.IsActive)
				.OrderByDescending(d => d.UpdatedAt)
				.FirstOrDefaultAsync();

			if (device == null)
			{
				if (!string.IsNullOrWhiteSpace(fallbackFromPayload)
					&& !fallbackFromPayload.Equals(deviceId, StringComparison.OrdinalIgnoreCase))
				{
					deviceId = fallbackFromPayload;
					device = await _dbContext.Devices
						.Where(d => d.DeviceIdentifier == deviceId && d.IsActive)
						.OrderByDescending(d => d.UpdatedAt)
						.FirstOrDefaultAsync();
				}
			}

			if (device == null)
			{
				return;
			}

			var now = DateTime.UtcNow;
			device.LastSeenAt = now;
			device.UpdatedAt = now;

			await _dbContext.SaveChangesAsync();
		}

		private static string? ExtractDeviceIdFromPayload(HeartbeatMessage? message)
		{
			if (message == null)
			{
				return null;
			}

			if (!string.IsNullOrWhiteSpace(message.DeviceId))
			{
				return message.DeviceId;
			}

			if (string.IsNullOrWhiteSpace(message.Status))
			{
				return null;
			}

			var status = message.Status.Trim();
			var spaceIndex = status.IndexOf(' ');
			return spaceIndex > 0 ? status[..spaceIndex] : status;
		}

		private static string? ExtractDeviceIdFromRawPayload(string payload)
		{
			if (string.IsNullOrWhiteSpace(payload))
			{
				return null;
			}

			var text = payload.Trim();
			var spaceIndex = text.IndexOf(' ');
			return spaceIndex > 0 ? text[..spaceIndex] : null;
		}
	}
}
