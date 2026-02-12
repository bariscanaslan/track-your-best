using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TYB.IoTService.MQTT;

namespace TYB.IoTService.Test
{
	public class TestPublisher : BackgroundService
	{
		private readonly IMqttService _mqttService;

		public TestPublisher(IMqttService mqttService)
		{
			_mqttService = mqttService;
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			await Task.Delay(3000, stoppingToken);

			await _mqttService.PublishAsync("gps/test-device", "{ \"msg\": \"hello gps\" }");
			await _mqttService.PublishAsync("heartbeat/test-device", "{ \"msg\": \"alive\" }");
			await _mqttService.PublishAsync("device-info/test-device", "{ \"fw\": \"1.0.0\" }");

			Console.WriteLine("Test messages published.");
		}
	}

}
