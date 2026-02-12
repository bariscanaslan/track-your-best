using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TYB.IoTService.Handlers
{
	public class HeartbeatMessageHandler : IMessageHandler
	{
		public bool CanHandle(string topic)
			=> topic.StartsWith("heartbeat/");

		public Task HandleAsync(string topic, string payload)
		{
			Console.WriteLine($"[HEARTBEAT] {topic}");
			Console.WriteLine(payload);
			return Task.CompletedTask;
		}
	}
}
