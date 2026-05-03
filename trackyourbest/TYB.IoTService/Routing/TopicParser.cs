namespace TYB.IoTService.Routing
{
	public static class TopicParser
	{
		public static bool TryGetDeviceId(string topic, string prefix, out string deviceId)
		{
			deviceId = string.Empty;

			if (string.IsNullOrWhiteSpace(topic))
			{
				return false;
			}

			var parts = topic.Split('/', StringSplitOptions.RemoveEmptyEntries);

			if (parts.Length != 2)
			{
				return false;
			}

			if (!parts[0].Equals(prefix, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			deviceId = parts[1];
			return !string.IsNullOrWhiteSpace(deviceId);
		}
	}
}
