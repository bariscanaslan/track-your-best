using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using TYB.IoTService.Background;
using TYB.IoTService.Configuration;
using TYB.IoTService.Handlers;
using TYB.IoTService.Infrastructure.Data;
using TYB.IoTService.MQTT;
using TYB.IoTService.Routing;

LoadEnv(new[]
{
	Path.Combine(Directory.GetCurrentDirectory(), ".env"),
	Path.Combine(AppContext.BaseDirectory, ".env"),
	Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".env")
});

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

static void LoadEnv(IEnumerable<string> candidates)
{
	foreach (var envPath in candidates)
	{
		if (!File.Exists(envPath))
		{
			continue;
		}

		Env.Load(envPath);
		LoadEnvFallback(envPath);
		break;
	}
}

static void LoadEnvFallback(string envPath)
{
	foreach (var rawLine in File.ReadAllLines(envPath))
	{
		var line = rawLine.Trim();
		if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#", StringComparison.Ordinal))
		{
			continue;
		}

		var separatorIndex = line.IndexOf('=', StringComparison.Ordinal);
		if (separatorIndex <= 0)
		{
			continue;
		}

		var key = line[..separatorIndex].Trim();
		var value = line[(separatorIndex + 1)..].Trim();

		if (string.IsNullOrWhiteSpace(key))
		{
			continue;
		}

		if (Environment.GetEnvironmentVariable(key) is null)
		{
			Environment.SetEnvironmentVariable(key, value);
		}
	}
}
