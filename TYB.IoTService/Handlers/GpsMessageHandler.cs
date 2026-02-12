using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using TYB.IoTService.Handlers;

namespace TYB.IoTService.Handlers
{
	public class GpsMessageHandler : IMessageHandler
	{
		public bool CanHandle(string topic)
		{
			return topic.StartsWith("gps/");
		}

		public Task HandleAsync(string topic, string payload)
		{
			Console.WriteLine("GPS MESSAGE RECEIVED");
			Console.WriteLine($"Topic: {topic}");
			Console.WriteLine($"Payload: {payload}");
			Console.WriteLine("-----------------------------------");

			return Task.CompletedTask;
		}
	}
}
