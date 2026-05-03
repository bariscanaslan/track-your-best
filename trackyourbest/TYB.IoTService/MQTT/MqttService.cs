using Microsoft.Extensions.Options;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using System.Text;
using TYB.IoTService.Configuration;
using TYB.IoTService.MQTT;

public class MqttService : IMqttService
{
	private readonly MqttSettings _settings;
	private readonly IMqttClient _client;
	private MqttClientOptions _options;

	public event Func<string, string, Task>? MessageReceived;

	public MqttService(IOptions<MqttSettings> settings)
	{
		_settings = settings.Value;

		var factory = new MqttFactory();
		_client = factory.CreateMqttClient();

		_client.ApplicationMessageReceivedAsync += e =>
		{
			var payload = Encoding.UTF8.GetString(e.ApplicationMessage.PayloadSegment);
			return MessageReceived?.Invoke(
				e.ApplicationMessage.Topic,
				payload
			) ?? Task.CompletedTask;
		};

		_client.DisconnectedAsync += async e =>
		{
			Console.WriteLine("⚠ MQTT Disconnected.");

			await Task.Delay(TimeSpan.FromSeconds(5));

			try
			{
				Console.WriteLine("🔄 Reconnecting MQTT...");
				await _client.ConnectAsync(_options);
			}
			catch
			{
				Console.WriteLine("❌ Reconnect failed.");
			}
		};

		_client.ConnectedAsync += async e =>
		{
			Console.WriteLine("✅ MQTT Connected.");

			foreach (var topic in _settings.SubscribeTopics)
			{
				await _client.SubscribeAsync(topic);
				Console.WriteLine($"🔁 Re-subscribed: {topic}");
			}
		};
	}

	public async Task ConnectAsync(CancellationToken cancellationToken)
	{
		var clientId = string.IsNullOrWhiteSpace(_settings.ClientId)
			? $"tyb-iot-{Guid.NewGuid():N}"
			: $"{_settings.ClientId}-{Guid.NewGuid():N}";

		_options = new MqttClientOptionsBuilder()
			.WithClientId(clientId)
			.WithTcpServer(_settings.Host, _settings.Port)
			.WithCredentials(_settings.Username, _settings.Password)
			.WithKeepAlivePeriod(TimeSpan.FromSeconds(30))
			.WithCleanSession(true)
			.Build();

		await _client.ConnectAsync(_options, cancellationToken);
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
			.WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
			.Build();

		await _client.PublishAsync(message);
	}
}
