using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Application.Models.Spatial;
using TYB.ApiService.Infrastructure.Entities.Core;
using TYB.ApiService.Infrastructure.Entities.Spatial;

namespace TYB.ApiService.Infrastructure.Data
{
	public class TybDbContext : DbContext
	{
		public TybDbContext(DbContextOptions<TybDbContext> options) : base(options)
		{
		}

		public DbSet<Device> Devices => Set<Device>();
		public DbSet<GpsData> GpsData => Set<GpsData>();
		public DbSet<GpsLastLocationRow> GpsLastLocations => Set<GpsLastLocationRow>();
		public DbSet<Trip> Trips => Set<Trip>();

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.HasPostgresEnum<TripStatus>("trip_status");

			modelBuilder.Entity<Device>(entity =>
			{
				entity.ToTable("devices", "tyb_core");
				entity.HasKey(d => d.Id);
				entity.Property(d => d.Id).HasColumnName("id");
				entity.Property(d => d.OrganizationId).HasColumnName("organization_id");
				entity.Property(d => d.DeviceIdentifier).HasColumnName("device_identifier");
				entity.Property(d => d.SecretKey).HasColumnName("secret_key");
				entity.Property(d => d.Imei).HasColumnName("imei");
				entity.Property(d => d.IpAddress).HasColumnName("ip_address");
				entity.Property(d => d.SignalStrength).HasColumnName("signal_strength");
				entity.Property(d => d.LastSeenAt).HasColumnName("last_seen_at");
				entity.Property(d => d.UpdatedAt).HasColumnName("updated_at");
				entity.HasIndex(d => d.DeviceIdentifier);
			});

			modelBuilder.Entity<GpsData>(entity =>
			{
				entity.ToTable("gps_data", "tyb_spatial");
				entity.HasKey(g => g.Id);
				entity.Property(g => g.Id).HasColumnName("id");
				entity.Property(g => g.OrganizationId).HasColumnName("organization_id");
				entity.Property(g => g.DeviceId).HasColumnName("device_id");
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.Location)
					.HasColumnName("location")
					.HasColumnType("geography (point, 4326)");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
				entity.Property(g => g.ReceivedTimestamp).HasColumnName("received_timestamp");
				entity.HasIndex(g => g.DeviceId);
			});

			modelBuilder.Entity<GpsLastLocationRow>(entity =>
			{
				entity.HasNoKey();
				entity.ToView(null);
				entity.Property(g => g.DeviceId).HasColumnName("device_id");
				entity.Property(g => g.VehicleId).HasColumnName("vehicle_id");
				entity.Property(g => g.VehicleName).HasColumnName("vehicle_name");
				entity.Property(g => g.DeviceIdentifier).HasColumnName("device_identifier");
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
				entity.Property(g => g.ReceivedTimestamp).HasColumnName("received_timestamp");
			});

			modelBuilder.Entity<Trip>(entity =>
			{
				entity.ToTable("trips", "tyb_spatial");
				entity.HasKey(t => t.Id);
				entity.Property(t => t.Id).HasColumnName("id");
				entity.Property(t => t.VehicleId).HasColumnName("vehicle_id");
				entity.Property(t => t.DriverId).HasColumnName("driver_id");
				entity.Property(t => t.TripName).HasColumnName("trip_name");
				entity.Property(t => t.Status)
					.HasColumnName("status")
					.HasColumnType("trip_status");
				entity.Property(t => t.StartLocation)
					.HasColumnName("start_location")
					.HasColumnType("geometry(Point,4326)");
				entity.Property(t => t.EndLocation)
					.HasColumnName("end_location")
					.HasColumnType("geometry(Point,4326)");
				entity.Property(t => t.StartAddress).HasColumnName("start_address");
				entity.Property(t => t.EndAddress).HasColumnName("end_address");
				entity.Property(t => t.StartTime).HasColumnName("start_time");
				entity.Property(t => t.EndTime).HasColumnName("end_time");
				entity.Property(t => t.PlannedEndTime).HasColumnName("planned_end_time");
				entity.Property(t => t.DurationSeconds).HasColumnName("duration_seconds");
				entity.Property(t => t.TotalDistanceKm).HasColumnName("total_distance_km");
				entity.Property(t => t.RouteGeometry)
					.HasColumnName("route_geometry")
					.HasColumnType("geometry(LineString,4326)");
				entity.Property(t => t.MaxSpeed).HasColumnName("max_speed");
				entity.Property(t => t.AvgSpeed).HasColumnName("avg_speed");
				entity.Property(t => t.StopCount).HasColumnName("stop_count");
				entity.Property(t => t.HarshAccelerationCount).HasColumnName("harsh_acceleration_count");
				entity.Property(t => t.HarshBrakingCount).HasColumnName("harsh_braking_count");
				entity.Property(t => t.Purpose).HasColumnName("purpose");
				entity.Property(t => t.Notes).HasColumnName("notes");
				entity.Property(t => t.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
				entity.Property(t => t.CreatedAt).HasColumnName("created_at");
				entity.Property(t => t.UpdatedAt).HasColumnName("updated_at");
			});
		}
	}
}
