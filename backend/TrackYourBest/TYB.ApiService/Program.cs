using System.Text;
using System.Security.Claims;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using TYB.ApiService.Application.Services;
using TYB.ApiService.Background;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Spatial;
using TYB.ApiService.Infrastructure.Entities.Core;
using TYB.ApiService.Application.Services.Routing;

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

var jwtSecret = builder.Configuration["TYB_JWT_SECRET"]
	?? throw new InvalidOperationException("TYB_JWT_SECRET is not configured.");

NpgsqlConnection.GlobalTypeMapper.MapEnum<TripStatus>("trip_status");
NpgsqlConnection.GlobalTypeMapper.MapEnum<UserRole>("user_role");

builder.Services.AddDbContext<TybDbContext>(options =>
	options.UseNpgsql(connectionString, npgsqlOptions => npgsqlOptions.UseNetTopologySuite())
);

builder.Services.AddScoped<CoreService>();
builder.Services.AddScoped<SpatialService>();
builder.Services.AddScoped<TripsService>();
builder.Services.AddScoped<TripRouteDeviationMonitorService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<GpsSpeedCalculator>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<TripRouteDeviationWorker>();

builder.Services.AddHttpClient<OsrmService>(client =>
{
	var baseUrl = builder.Configuration["TYB_OSRM_BASE_URL"]
		?? throw new InvalidOperationException("TYB_OSRM_BASE_URL is missing in environment variables.");

	client.BaseAddress = new Uri(baseUrl);
});

builder.Services.AddHttpClient<NominatimService>(client =>
{
	var baseUrl = builder.Configuration["TYB_NOMINATIM_BASE_URL"]
		?? throw new InvalidOperationException("TYB_NOMINATIM_BASE_URL is missing in environment variables.");

	client.BaseAddress = new Uri(baseUrl);

	var userAgent = builder.Configuration["TYB_NOMINATIM_USER_AGENT"] ?? "TYB-Default-Agent";
	client.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
	client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
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

builder.Services
	.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
	.AddJwtBearer(options =>
	{
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateLifetime = true,
			ValidateIssuerSigningKey = true,
			ValidIssuer = "TYB.ApiService",
			ValidAudience = "TYB.Frontend",
			IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
			NameClaimType = ClaimTypes.NameIdentifier,
			RoleClaimType = ClaimTypes.Role,
			ClockSkew = TimeSpan.Zero
		};

		// Read JWT from httpOnly cookie instead of Authorization header
		options.Events = new JwtBearerEvents
		{
			OnMessageReceived = context =>
			{
				if (context.Request.Cookies.TryGetValue("tyb_token", out var token))
					context.Token = token;
				return Task.CompletedTask;
			}
		};
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
app.UseAuthentication();
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
