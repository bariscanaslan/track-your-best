using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using TYB.ApiService.Infrastructure.DTOs.Core;
using TYB.ApiService.Infrastructure.DTOs.Spatial;
using TYB.ApiService.Infrastructure.Data;
using TYB.ApiService.Infrastructure.Entities.Core;
using BCrypt.Net;

namespace TYB.ApiService.Application.Services
{
	public class CoreService
	{
		private readonly TybDbContext _dbContext;

		private static DateTime? EnsureUtc(DateTime? value)
		{
			if (!value.HasValue)
			{
				return null;
			}

			var date = value.Value;
			return date.Kind switch
			{
				DateTimeKind.Utc => date,
				DateTimeKind.Local => date.ToUniversalTime(),
				_ => DateTime.SpecifyKind(date, DateTimeKind.Utc)
			};
		}

		public CoreService(TybDbContext dbContext)
		{
			_dbContext = dbContext;
		}

		public async Task<IReadOnlyList<DeviceLastLocationDto>> GetLatestDeviceLocationsAsync(
			Guid organizationId,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT DISTINCT ON (g.device_id)
					g.device_id,
					v.id AS vehicle_id,
					d.device_name,
					g.trip_id,
					g.location,
					g.latitude,
					g.longitude,
					g.accuracy,
					g.speed,
					g.is_moving,
					g.is_stopped,
					g.gps_timestamp,
					g.received_timestamp
				FROM tyb_spatial.gps_data g
				INNER JOIN tyb_core.devices d ON d.id = g.device_id
				LEFT JOIN tyb_core.vehicles v ON v.device_id = g.device_id
				WHERE d.organization_id = {0} 
					AND d.is_active = TRUE  -- SADECE AKTÝF CÝHAZLAR
					AND g.latitude IS NOT NULL
					AND g.longitude IS NOT NULL
					AND g.latitude BETWEEN -90 AND 90
					AND g.longitude BETWEEN -180 AND 180
					AND NOT (g.latitude = 0 AND g.longitude = 0)
				ORDER BY g.device_id, g.gps_timestamp DESC NULLS LAST, g.received_timestamp DESC NULLS LAST
				""";

			var rows = await _dbContext.DeviceLastLocations
				.FromSqlRaw(sql, organizationId)
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			var wktWriter = new WKTWriter();

			return rows
				.Select(row => new DeviceLastLocationDto(
					row.DeviceId,
					row.VehicleId,
					row.DeviceName,
					row.TripId,
					row.Location is null ? null : wktWriter.Write(row.Location),
					row.Latitude,
					row.Longitude,
					row.Accuracy,
					row.Speed,
					row.IsMoving,
					row.IsStopped,
					row.GpsTimestamp,
					row.ReceivedTimestamp
				))
				.ToList();
		}

		public async Task<DeviceInfoDto?> GetDeviceInformationAsync(
			Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			var device = await _dbContext.Devices
				.AsNoTracking()
				.FirstOrDefaultAsync(d => d.Id == deviceId, cancellationToken);

			if (device is null)
			{
				return null;
			}

			return new DeviceInfoDto(
				device.OrganizationId,
				device.DeviceName,
				device.DeviceIdentifier,
				device.SignalStrength,
				device.Imei,
				device.IpAddress,
				device.LastSeenAt
			);
		}

		public async Task<VehicleInfoDto?> GetVehicleInformationAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					v.organization_id,
					v.device_id,
					v.vehicle_name,
					v.plate_number,
					v.brand,
					v.model,
					v.year,
					v.color
				FROM tyb_core.vehicles v
				WHERE v.id = {0}
				LIMIT 1
				""";

			var row = await _dbContext.VehicleInformations
				.FromSqlRaw(sql, vehicleId)
				.AsNoTracking()
				.FirstOrDefaultAsync(cancellationToken);

			if (row is null)
			{
				return null;
			}

			return new VehicleInfoDto(
				row.OrganizationId,
				row.DeviceId,
				row.VehicleName,
				row.PlateNumber,
				row.Brand,
				row.Model,
				row.Year,
				row.Color
			);
		}

		public async Task<DriverInfoDto?> GetDriverInformationByVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					d.organization_id,
					d.user_id,
					d.vehicle_id,
					u.full_name,
					u.phone,
					u.avatar_url
				FROM tyb_core.drivers d
				LEFT JOIN tyb_core.users u ON u.id = d.user_id
				WHERE d.vehicle_id = {0}
				ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
				LIMIT 1
				""";

			var row = await _dbContext.DriverInformations
				.FromSqlRaw(sql, vehicleId)
				.AsNoTracking()
				.FirstOrDefaultAsync(cancellationToken);

			if (row is null)
			{
				return null;
			}

			return new DriverInfoDto(
				row.OrganizationId,
				row.UserId,
				row.VehicleId,
				row.FullName,
				row.Phone,
				row.AvatarUrl
			);
		}

		public async Task<IReadOnlyList<GpsRoutePointDto>> GetGpsRouteByVehicleAsync(
			Guid vehicleId,
			DateTime start,
			DateTime end,
			CancellationToken cancellationToken
		)
		{
			const string sql = """
				SELECT
					g.latitude,
					g.longitude,
					g.gps_timestamp
				FROM tyb_spatial.gps_data g
				INNER JOIN tyb_core.vehicles v ON v.device_id = g.device_id
				WHERE v.id = {0}
					AND g.gps_timestamp >= {1}
					AND g.gps_timestamp <= {2}
				ORDER BY g.gps_timestamp ASC
				""";

			var rows = await _dbContext.GpsRoutePoints
				.FromSqlRaw(sql, vehicleId, start, end)
				.AsNoTracking()
				.ToListAsync(cancellationToken);

			return rows.Select(row => new GpsRoutePointDto(
				row.Latitude,
				row.Longitude,
				row.GpsTimestamp
			)).ToList();
		}

		public async Task<IReadOnlyList<DeviceSummaryDto>> GetDevicesAsync(
			Guid? organizationId,
			bool? onlyActive,
			CancellationToken cancellationToken
		)
		{
			var query = _dbContext.Devices.AsNoTracking();

			if (organizationId.HasValue)
			{
				query = query.Where(device => device.OrganizationId == organizationId);
			}

			if (onlyActive == true)
			{
				query = query.Where(device => device.IsActive == true);
			}

			return await query
				.AsNoTracking()
				.OrderBy(device => device.DeviceName)
				.Select(device => new DeviceSummaryDto
				{
					Id = device.Id,
					DeviceName = device.DeviceName,
					DeviceIdentifier = device.DeviceIdentifier,
					InstallationDate = device.InstallationDate,
					SignalStrength = device.SignalStrength,
					Imei = device.Imei,
					IpAddress = device.IpAddress,
					LastSeenAt = device.LastSeenAt,
					IsActive = device.IsActive
				})
				.ToListAsync(cancellationToken);
		}

		public async Task<DeviceSummaryDto?> CreateDeviceAsync(
			DeviceUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var now = DateTime.UtcNow;
			var entity = new Device
			{
				Id = Guid.NewGuid(),
				OrganizationId = request.OrganizationId,
				DeviceName = request.DeviceName ?? string.Empty,
				DeviceIdentifier = request.DeviceIdentifier ?? string.Empty,
				InstallationDate = EnsureUtc(request.InstallationDate),
				SignalStrength = request.SignalStrength,
				Imei = request.Imei,
				IpAddress = request.IpAddress,
				LastSeenAt = EnsureUtc(request.LastSeenAt),
				IsActive = request.IsActive,
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Devices.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DeviceSummaryDto
			{
				Id = entity.Id,
				DeviceName = entity.DeviceName,
				DeviceIdentifier = entity.DeviceIdentifier,
				InstallationDate = entity.InstallationDate,
				SignalStrength = entity.SignalStrength,
				Imei = entity.Imei,
				IpAddress = entity.IpAddress,
				LastSeenAt = entity.LastSeenAt,
				IsActive = entity.IsActive
			};
		}

		public async Task<DeviceSummaryDto?> UpdateDeviceAsync(
			Guid deviceId,
			DeviceUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Devices
				.FirstOrDefaultAsync(device => device.Id == deviceId, cancellationToken);

			if (entity is null)
			{
				return null;
			}

			entity.OrganizationId = request.OrganizationId ?? entity.OrganizationId;
			entity.DeviceName = request.DeviceName ?? entity.DeviceName;
			entity.DeviceIdentifier = request.DeviceIdentifier ?? entity.DeviceIdentifier;
			entity.InstallationDate = EnsureUtc(request.InstallationDate);
			entity.SignalStrength = request.SignalStrength;
			entity.Imei = request.Imei;
			entity.IpAddress = request.IpAddress;
			entity.LastSeenAt = EnsureUtc(request.LastSeenAt);
			entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DeviceSummaryDto
			{
				Id = entity.Id,
				DeviceName = entity.DeviceName,
				DeviceIdentifier = entity.DeviceIdentifier,
				InstallationDate = entity.InstallationDate,
				SignalStrength = entity.SignalStrength,
				Imei = entity.Imei,
				IpAddress = entity.IpAddress,
				LastSeenAt = entity.LastSeenAt,
				IsActive = entity.IsActive
			};
		}

		public async Task<bool> DeleteDeviceAsync(Guid deviceId, CancellationToken cancellationToken)
		{
			var entity = await _dbContext.Devices
				.FirstOrDefaultAsync(device => device.Id == deviceId, cancellationToken);

			if (entity is null)
			{
				return false;
			}

			_dbContext.Devices.Remove(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);
			return true;
		}

		public async Task<IReadOnlyList<DriverSummaryDto>> GetDriversAsync(
			Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var driversQuery = _dbContext.Drivers.AsNoTracking();

			if (organizationId.HasValue)
			{
				driversQuery = driversQuery.Where(driver => driver.OrganizationId == organizationId);
			}

			var query =
				from driver in driversQuery
				join user in _dbContext.Users.AsNoTracking() on driver.UserId equals user.Id into userJoin
				from user in userJoin.DefaultIfEmpty()
				join vehicle in _dbContext.Vehicles.AsNoTracking() on driver.VehicleId equals vehicle.Id into vehicleJoin
				from vehicle in vehicleJoin.DefaultIfEmpty()
				orderby driver.LicenseNumber
				select new DriverSummaryDto
				{
					Id = driver.Id,
					VehicleId = driver.VehicleId,
					VehicleName = vehicle != null ? vehicle.VehicleName : null,
					UserId = driver.UserId,
					FullName = user != null ? user.FullName : null,
					Email = user != null ? user.Email : null,
					Phone = user != null ? user.Phone : null,
					AvatarUrl = user != null ? user.AvatarUrl : null,
					UserCreatedAt = user != null ? user.CreatedAt : null,
					LastLogin = user != null ? user.LastLogin : null,
					LicenseNumber = driver.LicenseNumber,
					LicenseType = driver.LicenseType,
					LicenseExpiry = driver.LicenseExpiry,
					DateOfBirth = driver.DateOfBirth,
					HireDate = driver.HireDate,
					EmergencyContactName = driver.EmergencyContactName,
					EmergencyContactPhone = driver.EmergencyContactPhone,
					IsActive = driver.IsActive
				};

			return await query.ToListAsync(cancellationToken);
		}

		public async Task<DriverSummaryDto?> GetDriverByIdAsync(
			Guid driverId,
			Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var driversQuery = _dbContext.Drivers.AsNoTracking()
				.Where(driver => driver.Id == driverId);

			if (organizationId.HasValue)
			{
				driversQuery = driversQuery.Where(driver => driver.OrganizationId == organizationId);
			}

			var query =
				from driver in driversQuery
				join user in _dbContext.Users.AsNoTracking() on driver.UserId equals user.Id into userJoin
				from user in userJoin.DefaultIfEmpty()
				join vehicle in _dbContext.Vehicles.AsNoTracking() on driver.VehicleId equals vehicle.Id into vehicleJoin
				from vehicle in vehicleJoin.DefaultIfEmpty()
				select new DriverSummaryDto
				{
					Id = driver.Id,
					VehicleId = driver.VehicleId,
					VehicleName = vehicle != null ? vehicle.VehicleName : null,
					UserId = driver.UserId,
					FullName = user != null ? user.FullName : null,
					Email = user != null ? user.Email : null,
					Phone = user != null ? user.Phone : null,
					AvatarUrl = user != null ? user.AvatarUrl : null,
					UserCreatedAt = user != null ? user.CreatedAt : null,
					LastLogin = user != null ? user.LastLogin : null,
					LicenseNumber = driver.LicenseNumber,
					LicenseType = driver.LicenseType,
					LicenseExpiry = driver.LicenseExpiry,
					DateOfBirth = driver.DateOfBirth,
					HireDate = driver.HireDate,
					EmergencyContactName = driver.EmergencyContactName,
					EmergencyContactPhone = driver.EmergencyContactPhone,
					IsActive = driver.IsActive
				};

			return await query.FirstOrDefaultAsync(cancellationToken);
		}

		public async Task<DriverSummaryDto?> CreateDriverAsync(
			DriverUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var now = DateTime.UtcNow;
			Guid? userId = request.UserId;

			if (!userId.HasValue)
			{
				if (request.OrganizationId is null)
				{
					throw new InvalidOperationException("OrganizationId is required to create a user.");
				}

				if (string.IsNullOrWhiteSpace(request.Username)
					|| string.IsNullOrWhiteSpace(request.Email)
					|| string.IsNullOrWhiteSpace(request.FullName))
				{
					throw new InvalidOperationException("Username, Email, and FullName are required to create a user.");
				}

				var user = new User
				{
					Id = Guid.NewGuid(),
					OrganizationId = request.OrganizationId,
					Username = request.Username.Trim(),
					Email = request.Email.Trim(),
					FullName = request.FullName.Trim(),
					Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
					AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim(),
					Role = UserRole.Driver,
					IsActive = true,
					PasswordHash = BCrypt.Net.BCrypt.HashPassword("Tyb.1905"),
					CreatedAt = now,
					UpdatedAt = now
				};

				_dbContext.Users.Add(user);
				userId = user.Id;
			}

			var entity = new Driver
			{
				Id = Guid.NewGuid(),
				OrganizationId = request.OrganizationId,
				UserId = userId,
				VehicleId = request.VehicleId,
				LicenseNumber = request.LicenseNumber ?? string.Empty,
				LicenseType = request.LicenseType,
				LicenseExpiry = request.LicenseExpiry,
				DateOfBirth = request.DateOfBirth,
				HireDate = request.HireDate,
				EmergencyContactName = request.EmergencyContactName,
				EmergencyContactPhone = request.EmergencyContactPhone,
				IsActive = request.IsActive,
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Drivers.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DriverSummaryDto
			{
				Id = entity.Id,
				UserId = entity.UserId,
				VehicleId = entity.VehicleId,
				LicenseNumber = entity.LicenseNumber,
				LicenseType = entity.LicenseType,
				LicenseExpiry = entity.LicenseExpiry,
				DateOfBirth = entity.DateOfBirth,
				HireDate = entity.HireDate,
				EmergencyContactName = entity.EmergencyContactName,
				EmergencyContactPhone = entity.EmergencyContactPhone,
				IsActive = entity.IsActive
			};
		}

		public async Task<DriverSummaryDto?> UpdateDriverAsync(
			Guid driverId,
			DriverUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Drivers
				.FirstOrDefaultAsync(driver => driver.Id == driverId, cancellationToken);

			if (entity is null)
			{
				return null;
			}

			entity.OrganizationId = request.OrganizationId ?? entity.OrganizationId;
			entity.UserId = request.UserId;
			entity.VehicleId = request.VehicleId;
			entity.LicenseNumber = request.LicenseNumber ?? entity.LicenseNumber;
			entity.LicenseType = request.LicenseType;
			entity.LicenseExpiry = request.LicenseExpiry;
			entity.DateOfBirth = request.DateOfBirth;
			entity.HireDate = request.HireDate;
			entity.EmergencyContactName = request.EmergencyContactName;
			entity.EmergencyContactPhone = request.EmergencyContactPhone;
			entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DriverSummaryDto
			{
				Id = entity.Id,
				UserId = entity.UserId,
				VehicleId = entity.VehicleId,
				LicenseNumber = entity.LicenseNumber,
				LicenseType = entity.LicenseType,
				LicenseExpiry = entity.LicenseExpiry,
				DateOfBirth = entity.DateOfBirth,
				HireDate = entity.HireDate,
				EmergencyContactName = entity.EmergencyContactName,
				EmergencyContactPhone = entity.EmergencyContactPhone,
				IsActive = entity.IsActive
			};
		}

		public async Task<bool> DeleteDriverAsync(Guid driverId, CancellationToken cancellationToken)
		{
			var entity = await _dbContext.Drivers
				.FirstOrDefaultAsync(driver => driver.Id == driverId, cancellationToken);

			if (entity is null)
			{
				return false;
			}

			_dbContext.Drivers.Remove(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);
			return true;
		}

		public async Task<User?> UpdateUserAsync(
			Guid userId,
			UserUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Users
				.FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

			if (entity is null)
			{
				return null;
			}

			if (!string.IsNullOrWhiteSpace(request.FullName))
			{
				entity.FullName = request.FullName;
			}

			if (!string.IsNullOrWhiteSpace(request.Email))
			{
				entity.Email = request.Email;
			}

			if (!string.IsNullOrWhiteSpace(request.Phone))
			{
				entity.Phone = request.Phone;
			}

			entity.AvatarUrl = request.AvatarUrl ?? entity.AvatarUrl;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);
			return entity;
		}

		public async Task<IReadOnlyList<VehicleSummaryDto>> GetVehiclesAsync(
			Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var vehiclesQuery = _dbContext.Vehicles.AsNoTracking();

			if (organizationId.HasValue)
			{
				vehiclesQuery = vehiclesQuery.Where(vehicle => vehicle.OrganizationId == organizationId);
			}

			var query =
				from vehicle in vehiclesQuery
				join device in _dbContext.Devices.AsNoTracking() on vehicle.DeviceId equals device.Id into deviceJoin
				from device in deviceJoin.DefaultIfEmpty()
				orderby vehicle.VehicleName
				select new VehicleSummaryDto
				{
					Id = vehicle.Id,
					DeviceId = vehicle.DeviceId,
					DeviceName = device != null ? device.DeviceName : null,
					VehicleName = vehicle.VehicleName,
					PlateNumber = vehicle.PlateNumber,
					Brand = vehicle.Brand,
					Model = vehicle.Model,
					Year = vehicle.Year,
					Color = vehicle.Color,
					FuelType = vehicle.FuelType,
					Capacity = vehicle.Capacity,
					InsuranceExpiry = vehicle.InsuranceExpiry,
					IsActive = vehicle.IsActive,
					CreatedAt = vehicle.CreatedAt
				};

			return await query.ToListAsync(cancellationToken);
		}

		public async Task<VehicleSummaryDto?> GetVehicleByIdAsync(
			Guid vehicleId,
			Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var vehiclesQuery = _dbContext.Vehicles.AsNoTracking()
				.Where(vehicle => vehicle.Id == vehicleId);

			if (organizationId.HasValue)
			{
				vehiclesQuery = vehiclesQuery.Where(vehicle => vehicle.OrganizationId == organizationId);
			}

			var query =
				from vehicle in vehiclesQuery
				join device in _dbContext.Devices.AsNoTracking() on vehicle.DeviceId equals device.Id into deviceJoin
				from device in deviceJoin.DefaultIfEmpty()
				select new VehicleSummaryDto
				{
					Id = vehicle.Id,
					DeviceId = vehicle.DeviceId,
					DeviceName = device != null ? device.DeviceName : null,
					VehicleName = vehicle.VehicleName,
					PlateNumber = vehicle.PlateNumber,
					Brand = vehicle.Brand,
					Model = vehicle.Model,
					Year = vehicle.Year,
					Color = vehicle.Color,
					FuelType = vehicle.FuelType,
					Capacity = vehicle.Capacity,
					InsuranceExpiry = vehicle.InsuranceExpiry,
					IsActive = vehicle.IsActive,
					CreatedAt = vehicle.CreatedAt
				};

			return await query.FirstOrDefaultAsync(cancellationToken);
		}

		public async Task<VehicleSummaryDto?> CreateVehicleAsync(
			VehicleUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var now = DateTime.UtcNow;
			Guid? finalDeviceId = request.DeviceId;

			if (request.DeviceId.HasValue)
			{
				var sourceDevice = await _dbContext.Devices
					.FirstOrDefaultAsync(d => d.Id == request.DeviceId.Value, cancellationToken);

				if (sourceDevice == null)
				{
					throw new InvalidOperationException("Selected device not found.");
				}

				if (request.ConfirmDeviceReassignment != true)
				{
					throw new InvalidOperationException("Assigning a device requires confirmation.");
				}

				var clonedDeviceId = Guid.NewGuid();

				await _dbContext.Database.ExecuteSqlRawAsync(
					"""
            INSERT INTO tyb_core.devices (
                id, organization_id, device_name, device_identifier, device_model,
                mqtt_username, mqtt_password, secret_key, installation_date,
                last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
                is_active, created_at, updated_at, created_by, imei, ip_address, last_seen_at
            )
            SELECT
                {0}, organization_id, device_name, device_identifier, device_model,
                mqtt_username, mqtt_password, secret_key, installation_date,
                last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
                TRUE, {1}, {1}, created_by, imei, ip_address, last_seen_at
            FROM tyb_core.devices
            WHERE id = {2}
            """,
					clonedDeviceId,
					now,
					sourceDevice.Id
				);

				sourceDevice.IsActive = false;
				sourceDevice.UpdatedAt = now;

				finalDeviceId = clonedDeviceId;
			}

			var entity = new Vehicle
			{
				Id = Guid.NewGuid(),
				OrganizationId = request.OrganizationId,
				DeviceId = finalDeviceId, // Klonlanmýþ ID kullanýlýyor
				VehicleName = request.VehicleName ?? string.Empty,
				PlateNumber = request.PlateNumber ?? string.Empty,
				Brand = request.Brand,
				Model = request.Model,
				Year = request.Year,
				Color = request.Color,
				FuelType = request.FuelType,
				Capacity = request.Capacity,
				InsuranceExpiry = EnsureUtc(request.InsuranceExpiry),
				IsActive = request.IsActive,
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Vehicles.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new VehicleSummaryDto
			{
				Id = entity.Id,
				DeviceId = entity.DeviceId,
				VehicleName = entity.VehicleName,
				PlateNumber = entity.PlateNumber,
				Brand = entity.Brand,
				Model = entity.Model,
				Year = entity.Year,
				Color = entity.Color,
				FuelType = entity.FuelType,
				Capacity = entity.Capacity,
				InsuranceExpiry = entity.InsuranceExpiry,
				IsActive = entity.IsActive
			};
		}

		public async Task<VehicleSummaryDto?> UpdateVehicleAsync(
			Guid vehicleId,
			VehicleUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Vehicles
				.FirstOrDefaultAsync(vehicle => vehicle.Id == vehicleId, cancellationToken);

			if (entity is null) return null;

			entity.OrganizationId = request.OrganizationId ?? entity.OrganizationId;

			var requestedDeviceId = request.DeviceId; // Arayüzden seçilen (Kaynak) cihaz ID'si
			var currentDeviceId = entity.DeviceId;    // Aracýn halihazýrda baðlý olduðu cihaz ID'si

			var isDeviceChanged = requestedDeviceId.HasValue &&
								 (!currentDeviceId.HasValue || requestedDeviceId.Value != currentDeviceId.Value);

			if (isDeviceChanged)
			{
				if (request.ConfirmDeviceReassignment != true)
				{
					throw new InvalidOperationException("Changing connected device requires confirmation.");
				}

				var sourceDevice = await _dbContext.Devices
					.FirstOrDefaultAsync(device => device.Id == requestedDeviceId.Value, cancellationToken);

				if (sourceDevice is null)
				{
					throw new InvalidOperationException("Selected source device was not found.");
				}

				var clonedDeviceId = Guid.NewGuid();
				var now = DateTime.UtcNow;

				await _dbContext.Database.ExecuteSqlRawAsync(
					"""
            INSERT INTO tyb_core.devices (
                id, organization_id, device_name, device_identifier, device_model,
                mqtt_username, mqtt_password, secret_key, installation_date,
                last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
                is_active, created_at, updated_at, created_by, imei, ip_address, last_seen_at
            )
            SELECT
                {0}, organization_id, device_name, device_identifier, device_model,
                mqtt_username, mqtt_password, secret_key, installation_date,
                last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
                TRUE, {1}, {1}, created_by, imei, ip_address, last_seen_at
            FROM tyb_core.devices
            WHERE id = {2}
            """,
					clonedDeviceId,
					now,
					sourceDevice.Id
				);

				entity.DeviceId = clonedDeviceId;

				sourceDevice.IsActive = false;
				sourceDevice.UpdatedAt = now;

			}
			else
			{
				// Eðer cihaz deðiþmediyse (isDeviceChanged false) 
				// ama kullanýcý null gönderdiyse, mevcut cihazý kaldýr.
				// Eðer kullanýcý zaten ayný cihazý gönderdiyse, ayný kalýr.
				entity.DeviceId = requestedDeviceId;
			}

			entity.VehicleName = request.VehicleName ?? entity.VehicleName;
			entity.PlateNumber = request.PlateNumber ?? entity.PlateNumber;
			entity.Brand = request.Brand;
			entity.Model = request.Model;
			entity.Year = request.Year;
			entity.Color = request.Color;
			entity.FuelType = request.FuelType;
			entity.Capacity = request.Capacity;
			entity.InsuranceExpiry = EnsureUtc(request.InsuranceExpiry);
			entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new VehicleSummaryDto
			{
				Id = entity.Id,
				DeviceId = entity.DeviceId,
				VehicleName = entity.VehicleName,
				PlateNumber = entity.PlateNumber,
				Brand = entity.Brand,
				Model = entity.Model,
				Year = entity.Year,
				Color = entity.Color,
				FuelType = entity.FuelType,
				Capacity = entity.Capacity,
				InsuranceExpiry = entity.InsuranceExpiry,
				IsActive = entity.IsActive
			};
		}

		public async Task<bool> DeleteVehicleAsync(Guid vehicleId, CancellationToken cancellationToken)
		{
			var entity = await _dbContext.Vehicles
				.FirstOrDefaultAsync(vehicle => vehicle.Id == vehicleId, cancellationToken);

			if (entity is null)
			{
				return false;
			}

			_dbContext.Vehicles.Remove(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);
			return true;
		}
	}
}
