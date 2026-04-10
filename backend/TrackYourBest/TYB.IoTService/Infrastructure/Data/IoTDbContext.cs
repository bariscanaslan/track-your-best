using Microsoft.EntityFrameworkCore;
using TYB.IoTService.Infrastructure.Entities.Core;
using TYB.IoTService.Infrastructure.Entities.Spatial;

namespace TYB.IoTService.Infrastructure.Data
{
	public class IoTDbContext : DbContext
	{
		public IoTDbContext(DbContextOptions<IoTDbContext> options) : base(options)
		{
		}

		public DbSet<Device> Devices => Set<Device>();
		public DbSet<Vehicle> Vehicles => Set<Vehicle>();
		public DbSet<GpsData> GpsData => Set<GpsData>();
		public DbSet<GpsRaw> GpsRaw => Set<GpsRaw>();
		public DbSet<Trip> Trips => Set<Trip>();

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
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
				entity.Property(d => d.IsActive).HasColumnName("is_active");
				entity.Property(d => d.SignalStrength).HasColumnName("signal_strength");
				entity.Property(d => d.LastSeenAt).HasColumnName("last_seen_at");
				entity.Property(d => d.UpdatedAt).HasColumnName("updated_at");
				entity.HasIndex(d => d.DeviceIdentifier);
			});

			modelBuilder.Entity<Vehicle>(entity =>
			{
				entity.ToTable("vehicles", "tyb_core");
				entity.HasKey(v => v.Id);
				entity.Property(v => v.Id).HasColumnName("id");
				entity.Property(v => v.DeviceId).HasColumnName("device_id");
			});

			modelBuilder.Entity<Trip>(entity =>
			{
				entity.ToTable("trips", "tyb_spatial");
				entity.HasKey(t => t.Id);
				entity.Property(t => t.Id).HasColumnName("id");
				entity.Property(t => t.VehicleId).HasColumnName("vehicle_id");
				entity.Property(t => t.Status).HasColumnName("status");
			});

			modelBuilder.Entity<GpsData>(entity =>
			{
				entity.ToTable("gps_data", "tyb_spatial");
				entity.HasKey(g => g.Id);
				entity.Property(g => g.Id).HasColumnName("id");
				entity.Property(g => g.OrganizationId).HasColumnName("organization_id");
				entity.Property(g => g.DeviceId).HasColumnName("device_id");
				entity.Property(g => g.TripId).HasColumnName("trip_id");
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.Location)
					.HasColumnName("location")
					.HasColumnType("geography (point, 4326)");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
				entity.Property(g => g.ReceivedTimestamp).HasColumnName("received_timestamp");
			});

			modelBuilder.Entity<GpsRaw>(entity =>
			{
				entity.ToTable("gps_raw", "tyb_spatial");
				entity.HasKey(r => r.Id);
				entity.Property(r => r.Id).HasColumnName("id");
				entity.Property(r => r.OrganizationId).HasColumnName("organization_id");
				entity.Property(r => r.DeviceId).HasColumnName("device_id");
				entity.Property(r => r.DeviceIdentifier).HasColumnName("device_identifier");
				entity.Property(r => r.Payload).HasColumnName("payload").HasColumnType("jsonb");
				entity.Property(r => r.ReceivedAt).HasColumnName("received_at");
				entity.Property(r => r.MqttTopic).HasColumnName("mqtt_topic");
				entity.Property(r => r.SourceIp).HasColumnName("source_ip");
				entity.Property(r => r.Signature).HasColumnName("signature");
				entity.Property(r => r.IsValid).HasColumnName("is_valid");
				entity.Property(r => r.ValidationError).HasColumnName("validation_error");
				entity.HasIndex(r => r.DeviceId);
				entity.HasIndex(r => r.ReceivedAt);
			});
		}
	}
}
