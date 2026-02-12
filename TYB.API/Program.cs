using Microsoft.EntityFrameworkCore;
using TYB.API.Data;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// SERVICES
// ============================================================================

// Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = 
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = 
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Database Context
var connectionString = builder.Configuration.GetConnectionString("PostgreSQL");
builder.Services.AddDbContext<TybDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseNetTopologySuite())
);

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
            "http://localhost:3000",
            "http://localhost:3003",
            "https://app.trackyourbest.net"
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Track Your Best API",
        Version = "v1.0",
        Description = "IoT & AI-Based Smart Mobility Platform - Microservice API"
    });
});

var app = builder.Build();

// ============================================================================
// MIDDLEWARE PIPELINE
// ============================================================================

// Development tools
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "TYB API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors();

app.UseAuthorization();

app.MapControllers();

// Root endpoint
app.MapGet("/", () => new
{
    service = "Track Your Best API",
    version = "1.0.0",
    status = "running",
    architecture = "microservice",
    database = "tyb_production",
    documentation = "/swagger",
    endpoints = new
    {
        devices = "/api/devices",
        gps = "/api/gps",
        trips = "/api/trips",
        drivers = "/api/drivers",
        analytics = "/api/analytics",
        vehicles = "/api/vehicles"
    }
}).WithTags("Root");

// ============================================================================
// DATABASE CONNECTION TEST
// ============================================================================

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TybDbContext>();
    try
    {
        await db.Database.CanConnectAsync();
        Console.WriteLine("✅ PostgreSQL connected: tyb_production");
        
        var schemas = await db.Database.SqlQuery<string>($@"
            SELECT schema_name::text 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tyb%'
            ORDER BY schema_name
        ").ToListAsync();
        
        Console.WriteLine($"✅ Schemas: {string.Join(", ", schemas)}");
        
        var postgis = await db.Database.SqlQuery<string>($@"
            SELECT PostGIS_version()::text
        ").FirstOrDefaultAsync();
        
        Console.WriteLine($"✅ PostGIS: {postgis}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Database error: {ex.Message}");
    }
}

Console.WriteLine("🚀 TYB Microservice API running on http://localhost:5000");
Console.WriteLine("📄 Swagger UI: http://localhost:5000/swagger");

app.Run();
