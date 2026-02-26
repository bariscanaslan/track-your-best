// Dosya Yolu: TYB.MLService/Program.cs

using Microsoft.EntityFrameworkCore;
using TYB.MLService.Infrastructure.Data;
using TYB.MLService.Infrastructure.Services;
using TYB.MLService.ML.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database - PostgreSQL with PostGIS
builder.Services.AddDbContext<MLDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        x => x.UseNetTopologySuite()
    )
);

// HttpClient Services
builder.Services.AddHttpClient<IMLPredictionService, MLPredictionService>();
builder.Services.AddHttpClient<IOsrmService, OsrmService>();

// CORS Policy
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Log startup
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("TYB.MLService started successfully");
logger.LogInformation("ML API: {MLApi}", builder.Configuration["MLApi:BaseUrl"]);
logger.LogInformation("OSRM: {Osrm}", builder.Configuration["Osrm:BaseUrl"]);

app.Run("http://localhost:5200");  