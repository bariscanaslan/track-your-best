using MQTTnet;
using MQTTnet.Client;
using System.Text;
using Microsoft.Extensions.Options;
using TYB.IoTService.Configuration;

namespace TYB.IoTService.MQTT
{
	public class MqttService : IMqttService
	{
		private readonly MqttSettings _settings;
		private readonly IMqttClient _client;

		public event Func<string, string, Task>? MessageReceived;

		public MqttService(IOptions<MqttSettings> settings)
		{
			_settings = settings.Value;
			var factory = new MqttFactory();
			_client = factory.CreateMqttClient();
			_client.ApplicationMessageReceivedAsync += e =>
			{
				var payload = Encoding.UTF8.GetString(e.ApplicationMessage.Payload);
				return MessageReceived?.Invoke(e.ApplicationMessage.Topic, payload) ?? Task.CompletedTask;
			};
		}

		public async Task ConnectAsync(CancellationToken cancellationToken)
		{
			var options = new MqttClientOptionsBuilder()
				.WithClientId(_settings.ClientId)
				.WithTcpServer(_settings.Host, _settings.Port)
				.WithCredentials(_settings.Username, _settings.Password)
				.Build();

			await _client.ConnectAsync(options, cancellationToken);
		}

		public async Task SubscribeAsync(IEnumerable<string> topics)
		{
			foreach (var topic in topics)
			{
				await _client.SubscribeAsync(topic);
			}
		}

		public async Task PublishAsync(string topic, string payload)
		{
			var message = new MqttApplicationMessageBuilder()
				.WithTopic(topic)
				.WithPayload(payload)
				.Build();

			await _client.PublishAsync(message);
		}

	}
}
