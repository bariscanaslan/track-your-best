using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TYB.IoTService.Handlers
{
	public interface IMessageHandler
	{
		bool CanHandle(string topic);
		Task HandleAsync(string topic, string payload);
	}
}
