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
			=> topic.StartsWith("device-info/");

		public async Task HandleAsync(string topic, string payload)
		{
			if (!TopicParser.TryGetDeviceId(topic, "device-info", out var deviceId))
			{
				_logger.LogWarning("Invalid device-info topic: {Topic}", topic);
				return;
			}

			DeviceInfoMessage? message;
			try
			{
				message = JsonSerializer.Deserialize<DeviceInfoMessage>(payload, JsonOptions);
			}
			catch (JsonException ex)
			{
				_logger.LogWarning(ex, "Invalid device-info payload for device {DeviceId}", deviceId);
				return;
			}

			if (message == null)
			{
				_logger.LogWarning("Empty device-info payload for device {DeviceId}", deviceId);
				return;
			}

			if (!string.IsNullOrWhiteSpace(message.DeviceId)
				&& !message.DeviceId.Equals(deviceId, StringComparison.OrdinalIgnoreCase))
			{
				_logger.LogWarning(
					"Device-info device id mismatch. Topic={TopicDeviceId}, Payload={PayloadDeviceId}",
					deviceId,
					message.DeviceId
				);
				return;
			}

			var device = await _dbContext.Devices
				.FirstOrDefaultAsync(d => d.DeviceIdentifier == deviceId);

			if (device == null)
			{
				_logger.LogWarning("Device-info device not found: {DeviceId}", deviceId);
				return;
			}

			device.Imei = message.Imei ?? device.Imei;
			device.IpAddress = message.Ip ?? device.IpAddress;
			device.SignalStrength = message.Rssi ?? device.SignalStrength;
			device.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync();
		}
	}
}
