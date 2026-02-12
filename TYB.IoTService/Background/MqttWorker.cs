using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TYB.IoTService.Configuration;
using TYB.IoTService.MQTT;
using TYB.IoTService.Routing;

namespace TYB.IoTService.Background
{
	public class MqttWorker : BackgroundService
	{
		private readonly IMqttService _mqttService;
		private readonly TopicRouter _router;
		private readonly MqttTopicManager _topicManager;

		public MqttWorker(
			IMqttService mqttService,
			TopicRouter router,
			MqttTopicManager topicManager)
		{
			_mqttService = mqttService;
			_router = router;
			_topicManager = topicManager;
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			_mqttService.MessageReceived += async (topic, payload) =>
			{
				await _router.RouteAsync(topic, payload);
			};

			await _mqttService.ConnectAsync(stoppingToken);
			await _mqttService.SubscribeAsync(_topicManager.GetSubscribeTopics());

			Console.WriteLine("MQTT Connected & Subscribed.");

			while (!stoppingToken.IsCancellationRequested)
			{
				await Task.Delay(1000, stoppingToken);
			}
		}
	}


}
