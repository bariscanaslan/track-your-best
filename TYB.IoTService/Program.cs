using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using TYB.IoTService.Background;
using TYB.IoTService.Configuration;
using TYB.IoTService.Handlers;
using TYB.IoTService.Infrastructure.Data;
using TYB.IoTService.MQTT;
using TYB.IoTService.Routing;

Env.Load();

var builder = Host.CreateApplicationBuilder(args);

builder.Configuration.AddEnvironmentVariables();

var connectionString =
	builder.Configuration.GetConnectionString("IoT")
	?? builder.Configuration["TYB_IOT_CONNECTION_STRING"];

if (string.IsNullOrWhiteSpace(connectionString))
{
	throw new InvalidOperationException(
		"Missing IoT DB connection string. Set ConnectionStrings:IoT or TYB_IOT_CONNECTION_STRING."
	);
}

builder.Services.AddDbContext<IoTDbContext>(options =>
	options.UseNpgsql(connectionString, npgsqlOptions => npgsqlOptions.UseNetTopologySuite())
);

builder.Services.Configure<MqttSettings>(
	builder.Configuration.GetSection("Mqtt")
);

builder.Services.AddSingleton<IMqttService, MqttService>();
builder.Services.AddSingleton<MqttTopicManager>();

builder.Services.AddScoped<TopicRouter>();
builder.Services.AddScoped<IMessageHandler, GpsMessageHandler>();
builder.Services.AddScoped<IMessageHandler, HeartbeatMessageHandler>();
builder.Services.AddScoped<IMessageHandler, DeviceInfoMessageHandler>();

builder.Services.AddHostedService<MqttWorker>();

var host = builder.Build();
host.Run();
