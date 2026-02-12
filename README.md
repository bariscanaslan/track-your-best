🗄️ Track Your Best - PostgreSQL + PostGIS Database
Quick database reference guide.

📦 Installation
PostgreSQL 15+ with PostGIS 3.6

https://www.postgresql.org/download/windows/ (install Stack Builder → PostGIS)

pgAdmin 4: https://www.pgadmin.org/download/ (Download Last Version)

🚀 Quick Setup
sqlCREATE DATABASE tyb_production;
CREATE EXTENSION postgis;
SELECT PostGIS_version(); -- Verify installation
```

---

## 📊 Database Schema

**4 Schemas, 15 Tables:**

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `tyb_core` | Core entities | organizations, users, devices, vehicles, drivers |
| `tyb_spatial` | GPS & maps | gps_data, trips, geofences |
| `tyb_analytics` | AI & metrics | driver_scores, anomalies, eta_predictions |
| `tyb_audit` | Logging | session_logs, system_events |

**Key Relationships:**
```
organizations → users → drivers → trips → gps_data
devices → gps_data (spatial index)

🌍 PostGIS in This Project
Why PostGIS?
NeedPostGIS SolutionCalculate distanceST_Distance() - accurate metersFind nearest devicesGIST index - 1000x fasterGeofence detectionST_Within() - polygon checkRoute geometrygeometry(LineString)
Example Usage:
sql-- Find devices within 5km
SELECT * FROM tyb_spatial.gps_data
WHERE ST_DWithin(
    location::geography,
    ST_MakePoint(29.0234, 41.0567)::geography,
    5000
);

🔧 .NET Integration
1. Install Packages:
bashdotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
2. Configure (Program.cs):
csharpbuilder.Services.AddDbContext<TybDbContext>(options =>
    options.UseNpgsql(connectionString, 
        o => o.UseNetTopologySuite() // ⚠️ Required for PostGIS
    )
);
3. Connection String (appsettings.json):
json{
  "ConnectionStrings": {
    "PostgreSQL": "Host=localhost;Port=5432;Database=tyb_production;Username=postgres;Password=your_password"
  }
}
4. Use in Controller:
csharp// Raw SQL with spatial query
var devices = await _db.Database.SqlQuery<DeviceDto>($@"
    SELECT id, device_name,
           ST_Distance(location::geography, 
                       ST_MakePoint({lon}, {lat})::geography) as distance
    FROM tyb_spatial.gps_data
    ORDER BY distance LIMIT 10
").ToListAsync();

📐 Spatial Index (Performance)
sqlCREATE INDEX idx_gps_location 
ON tyb_spatial.gps_data 
USING GIST (location);
Result: 1000x faster spatial queries

🔍 Connection Test
pgAdmin:
sqlSELECT PostGIS_version();
.NET:
csharpvar canConnect = await db.Database.CanConnectAsync();
Console.WriteLine(canConnect ? "✅ Connected" : "❌ Failed");
```

---

## 🚀 Default Access

**Admin User:**
```
Username: admin
Password: Admin123!
Database: tyb_production on localhost:5432

🔧 Troubleshooting
IssueFixPostGIS not foundCREATE EXTENSION postgis;Can't read geometryAdd .UseNetTopologySuite()Slow queriesCreate GIST indexConnection failedCheck password in appsettings.json

Track Your Best - PostgreSQL 15 + PostGIS 3.6 + .NET 8
