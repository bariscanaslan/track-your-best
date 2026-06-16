using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TYB.IoTService.Infrastructure.Data;
using TYB.IoTService.Models;
using TYB.IoTService.Routing;

namespace TYB.IoTService.Handlers
{
	public class DeviceInfoMessageHandler : IMessageHandler
	{
		private static readonly JsonSerializerOptions JsonOptions = new()
		{
			PropertyNameCaseInsensitive = true
		};

		private readonly IoTDbContext _dbContext;
		private readonly ILogger<DeviceInfoMessageHandler> _logger;

		public DeviceInfoMessageHandler(IoTDbContext dbContext, ILogger<DeviceInfoMessageHandler> logger)
		{
			_dbContext = dbContext;
			_logger = logger;
		}

		public bool CanHandle(string topic)
			=> topic.StartsWith("device-info/", StringComparison.OrdinalIgnoreCase)
				|| topic.Equals("device-info", StringComparison.OrdinalIgnoreCase);

		public async Task HandleAsync(string topic, string payload)
		{
			DeviceInfoMessage? message;
			try
			{
				message = JsonSerializer.Deserialize<DeviceInfoMessage>(payload, JsonOptions);
			}
			catch (JsonException ex)
			{
				_logger.LogWarning(ex, "Invalid device-info payload. Topic={Topic}", topic);
				return;
			}

			if (message == null)
			{
				_logger.LogWarning("Empty device-info payload. Topic={Topic}", topic);
				return;
			}

			var hasTopicDeviceId = TopicParser.TryGetDeviceId(topic, "device-info", out var topicDeviceId);
			var payloadDeviceId = message.DeviceId?.Trim();
			var payloadImei = message.Imei?.Trim();

			string? deviceId = null;
			if (hasTopicDeviceId)
			{
				deviceId = topicDeviceId;
			}
			else if (topic.Equals("device-info", StringComparison.OrdinalIgnoreCase))
			{
				deviceId = payloadImei ?? payloadDeviceId;
			}
			else
			{
				_logger.LogWarning("Invalid device-info topic: {Topic}", topic);
				return;
			}

			if (string.IsNullOrWhiteSpace(deviceId))
			{
				_logger.LogWarning("Cannot resolve device id for device-info message. Topic={Topic}", topic);
				return;
			}

			if (hasTopicDeviceId
				&& !string.IsNullOrWhiteSpace(payloadDeviceId)
				&& !payloadDeviceId.Equals(deviceId, StringComparison.OrdinalIgnoreCase))
			{
				_logger.LogWarning(
					"Device-info device id mismatch. Topic={TopicDeviceId}, Payload={PayloadDeviceId}",
					deviceId,
					message.DeviceId
				);
				return;
			}

			var device = await _dbContext.Devices
				.Where(d => d.DeviceIdentifier == deviceId && d.IsActive)
				.OrderByDescending(d => d.UpdatedAt)
				.FirstOrDefaultAsync();

			if (device == null && !string.IsNullOrWhiteSpace(payloadImei))
			{
				device = await _dbContext.Devices
					.Where(d => (d.DeviceIdentifier == payloadImei || d.Imei == payloadImei) && d.IsActive)
					.OrderByDescending(d => d.UpdatedAt)
					.FirstOrDefaultAsync();
			}

			if (device == null)
			{
				_logger.LogWarning("Device-info device not found: {DeviceId}", deviceId);
				return;
			}

			device.Imei = message.Imei ?? device.Imei;
			device.IpAddress = message.IpAddress ?? message.Ip ?? device.IpAddress;
			device.SignalStrength = message.SignalStrength ?? message.Rssi ?? device.SignalStrength;
			device.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync();
		}
	}
}
