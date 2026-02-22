using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Spatial;

LoadEnv(new[]
{
	Path.Combine(Directory.GetCurrentDirectory(), ".env"),
	Path.Combine(AppContext.BaseDirectory, ".env"),
	Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".env")
});

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

var connectionString =
	builder.Configuration.GetConnectionString("Api")
	?? builder.Configuration["TYB_API_CONNECTION_STRING"];

if (string.IsNullOrWhiteSpace(connectionString))
{
	throw new InvalidOperationException(
		"Missing API DB connection string. Set ConnectionStrings:Api or TYB_API_CONNECTION_STRING."
	);
}

NpgsqlConnection.GlobalTypeMapper.MapEnum<TripStatus>("trip_status");

builder.Services.AddDbContext<TybDbContext>(options =>
	options.UseNpgsql(connectionString, npgsqlOptions => npgsqlOptions.UseNetTopologySuite())
);

builder.Services.AddScoped<CoreService>();
builder.Services.AddScoped<TripsService>();
builder.Services.AddHttpClient<OsrmService>(client =>
{
	var baseUrl =
		builder.Configuration["TYB_OSRM_BASE_URL"]
		?? "http://localhost:5000";
	client.BaseAddress = new Uri(baseUrl);
});

builder.Services.AddCors(options =>
{
	options.AddPolicy("LocalDev", policy =>
	{
		policy
			.WithOrigins("http://localhost:3003", "http://172.16.2.197:3003")
			.AllowAnyHeader()
			.AllowAnyMethod()
			.AllowCredentials();
	});
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("LocalDev");
app.UseAuthorization();
app.MapControllers();

app.Run();

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
