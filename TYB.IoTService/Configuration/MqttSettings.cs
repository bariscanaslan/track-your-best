using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TYB.IoTService.Configuration
{
	public class MqttSettings
	{
		public string Host { get; set; }
		public int Port { get; set; }
		public string Username { get; set; }
		public string Password { get; set; }
		public string ClientId { get; set; }
		public List<string> SubscribeTopics { get; set; }
	}
}
