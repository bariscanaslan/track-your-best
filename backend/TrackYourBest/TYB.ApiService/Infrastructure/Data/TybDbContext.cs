using Microsoft.EntityFrameworkCore;
using TYB.ApiService.Infrastructure.DTOs.Core;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
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
		public DbSet<Driver> Drivers => Set<Driver>();
		public DbSet<Vehicle> Vehicles => Set<Vehicle>();
		public DbSet<User> Users => Set<User>();
		public DbSet<GpsData> GpsData => Set<GpsData>();
		public DbSet<DeviceLastLocationRow> DeviceLastLocations => Set<DeviceLastLocationRow>();
		public DbSet<GpsRoutePointRow> GpsRoutePoints => Set<GpsRoutePointRow>();
		public DbSet<DriverInformationRow> DriverInformations => Set<DriverInformationRow>();
		public DbSet<VehicleInformationRow> VehicleInformations => Set<VehicleInformationRow>();
		public DbSet<Trip> Trips => Set<Trip>();

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.HasPostgresEnum<TripStatus>("trip_status");
			modelBuilder.HasPostgresEnum<UserRole>("user_role");

			modelBuilder.Entity<Device>(entity =>
			{
				entity.ToTable("devices", "tyb_core");
				entity.HasKey(d => d.Id);
				entity.Property(d => d.Id).HasColumnName("id");
				entity.Property(d => d.OrganizationId).HasColumnName("organization_id");
				entity.Property(d => d.DeviceName).HasColumnName("device_name");
				entity.Property(d => d.DeviceIdentifier).HasColumnName("device_identifier");
				entity.Property(d => d.DeviceModel).HasColumnName("device_model");
				entity.Property(d => d.MqttUsername).HasColumnName("mqtt_username");
				entity.Property(d => d.MqttPassword).HasColumnName("mqtt_password");
				entity.Property(d => d.SecretKey).HasColumnName("secret_key");
				entity.Property(d => d.InstallationDate).HasColumnName("installation_date");
				entity.Property(d => d.LastMaintenanceDate).HasColumnName("last_maintenance_date");
				entity.Property(d => d.NextMaintenanceDate).HasColumnName("next_maintenance_date");
				entity.Property(d => d.BatteryLevel).HasColumnName("battery_level");
				entity.Property(d => d.Imei).HasColumnName("imei");
				entity.Property(d => d.IpAddress).HasColumnName("ip_address");
				entity.Property(d => d.SignalStrength).HasColumnName("signal_strength");
				entity.Property(d => d.IsActive).HasColumnName("is_active");
				entity.Property(d => d.CreatedAt).HasColumnName("created_at");
				entity.Property(d => d.LastSeenAt).HasColumnName("last_seen_at");
				entity.Property(d => d.UpdatedAt).HasColumnName("updated_at");
				entity.Property(d => d.CreatedBy).HasColumnName("created_by");
				entity.HasIndex(d => d.DeviceIdentifier);
			});

			modelBuilder.Entity<User>(entity =>
			{
				entity.ToTable("users", "tyb_core");
				entity.HasKey(u => u.Id);
				entity.Property(u => u.Id).HasColumnName("id");
				entity.Property(u => u.OrganizationId).HasColumnName("organization_id");
				entity.Property(u => u.Username).HasColumnName("username");
				entity.Property(u => u.Email).HasColumnName("email");
				entity.Property(u => u.PasswordHash).HasColumnName("password_hash");
				entity.Property(u => u.FullName).HasColumnName("full_name");
				entity.Property(u => u.Phone).HasColumnName("phone");
				entity.Property(u => u.Role).HasColumnName("role").HasColumnType("user_role");
				entity.Property(u => u.IsActive).HasColumnName("is_active");
				entity.Property(u => u.LastLogin).HasColumnName("last_login");
				entity.Property(u => u.AvatarUrl).HasColumnName("avatar_url");
				entity.Property(u => u.CreatedAt).HasColumnName("created_at");
				entity.Property(u => u.UpdatedAt).HasColumnName("updated_at");
				entity.Property(u => u.CreatedBy).HasColumnName("created_by");
			});

			modelBuilder.Entity<Driver>(entity =>
			{
				entity.ToTable("drivers", "tyb_core");
				entity.HasKey(d => d.Id);
				entity.Property(d => d.Id).HasColumnName("id");
				entity.Property(d => d.OrganizationId).HasColumnName("organization_id");
				entity.Property(d => d.UserId).HasColumnName("user_id");
				entity.Property(d => d.VehicleId).HasColumnName("vehicle_id");
				entity.Property(d => d.LicenseNumber).HasColumnName("license_number");
				entity.Property(d => d.LicenseType).HasColumnName("license_type");
				entity.Property(d => d.LicenseExpiry).HasColumnName("license_expiry");
				entity.Property(d => d.DateOfBirth).HasColumnName("date_of_birth");
				entity.Property(d => d.HireDate).HasColumnName("hire_date");
				entity.Property(d => d.EmergencyContactName).HasColumnName("emergency_contact_name");
				entity.Property(d => d.EmergencyContactPhone).HasColumnName("emergency_contact_phone");
				entity.Property(d => d.IsActive).HasColumnName("is_active");
				entity.Property(d => d.CreatedAt).HasColumnName("created_at");
				entity.Property(d => d.UpdatedAt).HasColumnName("updated_at");
			});

			modelBuilder.Entity<Vehicle>(entity =>
			{
				entity.ToTable("vehicles", "tyb_core");
				entity.HasKey(v => v.Id);
				entity.Property(v => v.Id).HasColumnName("id");
				entity.Property(v => v.OrganizationId).HasColumnName("organization_id");
				entity.Property(v => v.DeviceId).HasColumnName("device_id");
				entity.Property(v => v.VehicleName).HasColumnName("vehicle_name");
				entity.Property(v => v.PlateNumber).HasColumnName("plate_number");
				entity.Property(v => v.Brand).HasColumnName("brand");
				entity.Property(v => v.Model).HasColumnName("model");
				entity.Property(v => v.Year).HasColumnName("year");
				entity.Property(v => v.Color).HasColumnName("color");
				entity.Property(v => v.FuelType).HasColumnName("fuel_type");
				entity.Property(v => v.Capacity).HasColumnName("capacity");
				entity.Property(v => v.InsuranceExpiry).HasColumnName("insurance_expiry");
				entity.Property(v => v.InspectionExpiry).HasColumnName("inspection_expiry");
				entity.Property(v => v.IsActive).HasColumnName("is_active");
				entity.Property(v => v.CreatedAt).HasColumnName("created_at");
				entity.Property(v => v.UpdatedAt).HasColumnName("updated_at");
				entity.Property(v => v.CreatedBy).HasColumnName("created_by");
			});

			modelBuilder.Entity<GpsData>(entity =>
			{
				entity.ToTable("gps_data", "tyb_spatial");
				entity.HasKey(g => g.Id);
				entity.Property(g => g.Id).HasColumnName("id");
				entity.Property(g => g.DeviceId).HasColumnName("device_id");
				entity.Property(g => g.TripId).HasColumnName("trip_id");
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.Location)
					.HasColumnName("location")
					.HasColumnType("geography (point, 4326)");
				entity.Property(g => g.Altitude).HasColumnName("altitude");
				entity.Property(g => g.Accuracy).HasColumnName("accuracy");
				entity.Property(g => g.Speed).HasColumnName("speed");
				entity.Property(g => g.Heading).HasColumnName("heading");
				entity.Property(g => g.IsMoving).HasColumnName("is_moving");
				entity.Property(g => g.IsStopped).HasColumnName("is_stopped");
				entity.Property(g => g.Acceleration).HasColumnName("acceleration");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
				entity.Property(g => g.ReceivedTimestamp).HasColumnName("received_timestamp");
				entity.Property(g => g.BatteryLevel).HasColumnName("battery_level");
				entity.Property(g => g.SignalQuality).HasColumnName("signal_quality");
				entity.Property(g => g.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
				entity.Property(g => g.OrganizationId).HasColumnName("organization_id");
				entity.HasIndex(g => g.DeviceId);
			});

			modelBuilder.Entity<DeviceLastLocationRow>(entity =>
			{
				entity.HasNoKey();
				entity.ToView(null);
				entity.Property(g => g.DeviceId).HasColumnName("device_id");
				entity.Property(g => g.VehicleId).HasColumnName("vehicle_id");
				entity.Property(g => g.DeviceName).HasColumnName("device_name");
				entity.Property(g => g.TripId).HasColumnName("trip_id");
				entity.Property(g => g.Location)
					.HasColumnName("location")
					.HasColumnType("geography (point, 4326)");
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.Accuracy).HasColumnName("accuracy");
				entity.Property(g => g.Speed).HasColumnName("speed");
				entity.Property(g => g.IsMoving).HasColumnName("is_moving");
				entity.Property(g => g.IsStopped).HasColumnName("is_stopped");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
				entity.Property(g => g.ReceivedTimestamp).HasColumnName("received_timestamp");
			});

			modelBuilder.Entity<GpsRoutePointRow>(entity =>
			{
				entity.HasNoKey();
				entity.ToView(null);
				entity.Property(g => g.Latitude).HasColumnName("latitude");
				entity.Property(g => g.Longitude).HasColumnName("longitude");
				entity.Property(g => g.GpsTimestamp).HasColumnName("gps_timestamp");
			});

			modelBuilder.Entity<DriverInformationRow>(entity =>
			{
				entity.HasNoKey();
				entity.ToView(null);
				entity.Property(d => d.OrganizationId).HasColumnName("organization_id");
				entity.Property(d => d.UserId).HasColumnName("user_id");
				entity.Property(d => d.VehicleId).HasColumnName("vehicle_id");
				entity.Property(d => d.FullName).HasColumnName("full_name");
				entity.Property(d => d.Phone).HasColumnName("phone");
				entity.Property(d => d.AvatarUrl).HasColumnName("avatar_url");
			});

			modelBuilder.Entity<VehicleInformationRow>(entity =>
			{
				entity.HasNoKey();
				entity.ToView(null);
				entity.Property(v => v.OrganizationId).HasColumnName("organization_id");
				entity.Property(v => v.DeviceId).HasColumnName("device_id");
				entity.Property(v => v.VehicleName).HasColumnName("vehicle_name");
				entity.Property(v => v.PlateNumber).HasColumnName("plate_number");
				entity.Property(v => v.Brand).HasColumnName("brand");
				entity.Property(v => v.Model).HasColumnName("model");
				entity.Property(v => v.Year).HasColumnName("year");
				entity.Property(v => v.Color).HasColumnName("color");
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
				entity.Property(t => t.Notes).HasColumnName("notes");
				entity.Property(t => t.PauseCount).HasColumnName("pause_count");
				entity.Property(t => t.CreatedAt).HasColumnName("created_at");
				entity.Property(t => t.UpdatedAt).HasColumnName("updated_at");
			});
		}
	}
}
