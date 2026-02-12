using DotNetEnv;
using TYB.IoTService.Background;
using TYB.IoTService.Configuration;
using TYB.IoTService.Handlers;
using TYB.IoTService.MQTT;
using TYB.IoTService.Routing;
using TYB.IoTService.Test;

Env.Load();

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services.Configure<MqttSettings>(
	builder.Configuration.GetSection("Mqtt")
);

builder.Services.AddSingleton<IMqttService, MqttService>();
builder.Services.AddSingleton<MqttTopicManager>();
builder.Services.AddSingleton<TopicRouter>();

builder.Services.AddSingleton<IMessageHandler, GpsMessageHandler>();
builder.Services.AddSingleton<IMessageHandler, HeartbeatMessageHandler>();
builder.Services.AddSingleton<IMessageHandler, DeviceInfoMessageHandler>();

builder.Services.AddHostedService<TestPublisher>();
builder.Services.AddHostedService<MqttWorker>();

var host = builder.Build();
host.Run();
