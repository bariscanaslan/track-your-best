using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TYB.IoTService.MQTT
{
	public interface IMqttService
	{
		event Func<string, string, Task>? MessageReceived;

		Task ConnectAsync(CancellationToken cancellationToken);
		Task SubscribeAsync(IEnumerable<string> topics);
		Task PublishAsync(string topic, string payload);
	}
}
