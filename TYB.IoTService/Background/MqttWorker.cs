using Microsoft.Extensions.DependencyInjection;
using TYB.IoTService.MQTT;
using TYB.IoTService.Routing;

namespace TYB.IoTService.Background
{
	public class MqttWorker : BackgroundService
	{
		private readonly IMqttService _mqttService;
		private readonly MqttTopicManager _topicManager;
		private readonly IServiceScopeFactory _scopeFactory;

		public MqttWorker(
			IMqttService mqttService,
			MqttTopicManager topicManager,
			IServiceScopeFactory scopeFactory)
		{
			_mqttService = mqttService;
			_topicManager = topicManager;
			_scopeFactory = scopeFactory;
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			_mqttService.MessageReceived += async (topic, payload) =>
			{
				using var scope = _scopeFactory.CreateScope();
				var router = scope.ServiceProvider.GetRequiredService<TopicRouter>();
				await router.RouteAsync(topic, payload);
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
