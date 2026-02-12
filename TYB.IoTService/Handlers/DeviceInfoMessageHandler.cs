using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TYB.IoTService.Handlers
{
	public class DeviceInfoMessageHandler : IMessageHandler
	{
		public bool CanHandle(string topic)
			=> topic.StartsWith("device-info/");

		public Task HandleAsync(string topic, string payload)
		{
			Console.WriteLine($"[DEVICE-INFO] {topic}");
			Console.WriteLine(payload);
			return Task.CompletedTask;
		}
	}

}
