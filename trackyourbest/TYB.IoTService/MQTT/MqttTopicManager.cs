using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TYB.IoTService.Configuration;

namespace TYB.IoTService.MQTT
{
	public class MqttTopicManager
	{
		private readonly MqttSettings _settings;

		public MqttTopicManager(IOptions<MqttSettings> settings)
		{
			_settings = settings.Value;
		}

		public IEnumerable<string> GetSubscribeTopics()
		{
			return _settings.SubscribeTopics;
		}
	}
}
