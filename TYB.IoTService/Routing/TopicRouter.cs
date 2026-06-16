using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TYB.IoTService.Handlers;

namespace TYB.IoTService.Routing
{
	public class TopicRouter
	{
		private readonly IEnumerable<IMessageHandler> _handlers;

		public TopicRouter(IEnumerable<IMessageHandler> handlers)
		{
			_handlers = handlers;
		}

		public async Task RouteAsync(string topic, string payload)
		{
			var handler = _handlers.FirstOrDefault(h => h.CanHandle(topic));

			if (handler != null)
			{
				await handler.HandleAsync(topic, payload);
			}
			else
			{
				Console.WriteLine($"No handler found for topic: {topic}");
			}
		}
	}

}
