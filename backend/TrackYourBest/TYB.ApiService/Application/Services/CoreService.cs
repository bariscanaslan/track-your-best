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

		private static string? NormalizeOptionalString(string? value)
		{
			if (value is null)
			{
				return null;
			}

			var trimmed = value.Trim();
			return trimmed.Length == 0 ? null : trimmed;
		}

		// Date time UTC conversion
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

		/// <summary>
		/// Safely executes a parameterized raw SQL query to retrieve detailed information for a specific vehicle.
		/// It uses EF Core's string interpolation to prevent SQL injection and maps the result to a DTO.
		/// </summary>
		public async Task<VehicleInfoDto?> GetVehicleInformationAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var row = await _dbContext.VehicleInformations
				.FromSql($"""
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
			WHERE v.id = {vehicleId}
			LIMIT 1
			""")
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

		/// <summary>
		/// Safely executes a parameterized raw SQL query to retrieve the most recently updated driver information for a specific vehicle.
		/// It uses EF Core's string interpolation to prevent SQL injection and maps the result to a DTO.
		/// </summary>
		public async Task<DriverInfoDto?> GetDriverInformationByVehicleAsync(
			Guid vehicleId,
			CancellationToken cancellationToken
		)
		{
			var row = await _dbContext.DriverInformations
				.FromSql($"""
			SELECT
				d.id AS driver_id,
				d.organization_id,
				d.user_id,
				d.vehicle_id,
				u.full_name,
				u.phone,
				u.avatar_url
			FROM tyb_core.drivers d
			LEFT JOIN tyb_core.users u ON u.id = d.user_id
			WHERE d.vehicle_id = {vehicleId}
			ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
			LIMIT 1
			""")
				.AsNoTracking()
				.FirstOrDefaultAsync(cancellationToken);

			if (row is null)
			{
				return null;
			}

			return new DriverInfoDto(
				row.DriverId,
				row.OrganizationId,
				row.UserId,
				row.VehicleId,
				row.FullName,
				row.Phone,
				row.AvatarUrl
			);
		}

		private static OrganizationSummaryDto MapOrganization(Organization o, User? creator) => new()
		{
			Id = o.Id,
			Name = o.Name,
			LegalName = o.LegalName,
			TaxNumber = o.TaxNumber,
			Email = o.Email,
			Phone = o.Phone,
			Address = o.Address,
			City = o.City,
			Country = o.Country,
			Website = o.Website,
			LogoUrl = o.LogoUrl,
			IsActive = o.IsActive,
			CreatedAt = o.CreatedAt,
			UpdatedAt = o.UpdatedAt,
			CreatedBy = o.CreatedBy,
			CreatedByName = creator?.FullName,
		};

		public async Task<IReadOnlyList<OrganizationSummaryDto>> GetOrganizationsAsync(
			CancellationToken cancellationToken
		)
		{
			return await (
				from org in _dbContext.Organizations.AsNoTracking()
				join creator in _dbContext.Users.AsNoTracking()
					on org.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				orderby org.Name
				select new OrganizationSummaryDto
				{
					Id = org.Id,
					Name = org.Name,
					LegalName = org.LegalName,
					TaxNumber = org.TaxNumber,
					Email = org.Email,
					Phone = org.Phone,
					Address = org.Address,
					City = org.City,
					Country = org.Country,
					Website = org.Website,
					LogoUrl = org.LogoUrl,
					IsActive = org.IsActive,
					CreatedAt = org.CreatedAt,
					UpdatedAt = org.UpdatedAt,
					CreatedBy = org.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
				}
			).ToListAsync(cancellationToken);
		}

		public async Task<OrganizationSummaryDto?> GetOrganizationByIdAsync(
			Guid orgId,
			CancellationToken cancellationToken
		)
		{
			return await (
				from org in _dbContext.Organizations.AsNoTracking()
				where org.Id == orgId
				join creator in _dbContext.Users.AsNoTracking()
					on org.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				select new OrganizationSummaryDto
				{
					Id = org.Id,
					Name = org.Name,
					LegalName = org.LegalName,
					TaxNumber = org.TaxNumber,
					Email = org.Email,
					Phone = org.Phone,
					Address = org.Address,
					City = org.City,
					Country = org.Country,
					Website = org.Website,
					LogoUrl = org.LogoUrl,
					IsActive = org.IsActive,
					CreatedAt = org.CreatedAt,
					UpdatedAt = org.UpdatedAt,
					CreatedBy = org.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
				}
			).FirstOrDefaultAsync(cancellationToken);
		}

		public async Task<OrganizationSummaryDto?> CreateOrganizationAsync(
			OrganizationUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			if (string.IsNullOrWhiteSpace(request.Name))
				throw new InvalidOperationException("Name is required.");

			var now = DateTime.UtcNow;
			var entity = new Organization
			{
				Id = Guid.NewGuid(),
				Name = request.Name.Trim(),
				LegalName = request.LegalName?.Trim(),
				TaxNumber = request.TaxNumber?.Trim(),
				Email = request.Email?.Trim(),
				Phone = request.Phone?.Trim(),
				Address = request.Address?.Trim(),
				City = request.City?.Trim(),
				Country = request.Country?.Trim(),
				Website = request.Website?.Trim(),
				LogoUrl = request.LogoUrl?.Trim(),
				IsActive = request.IsActive ?? true,
				CreatedAt = now,
				UpdatedAt = now,
			};

			_dbContext.Organizations.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return await GetOrganizationByIdAsync(entity.Id, cancellationToken);
		}

		public async Task<OrganizationSummaryDto?> UpdateOrganizationAsync(
			Guid orgId,
			OrganizationUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken);
			if (entity is null) return null;

			if (!string.IsNullOrWhiteSpace(request.Name)) entity.Name = request.Name.Trim();
			entity.LegalName = request.LegalName?.Trim() ?? entity.LegalName;
			entity.TaxNumber = request.TaxNumber?.Trim() ?? entity.TaxNumber;
			entity.Email = request.Email?.Trim() ?? entity.Email;
			entity.Phone = request.Phone?.Trim() ?? entity.Phone;
			entity.Address = request.Address?.Trim() ?? entity.Address;
			entity.City = request.City?.Trim() ?? entity.City;
			entity.Country = request.Country?.Trim() ?? entity.Country;
			entity.Website = request.Website?.Trim() ?? entity.Website;
			entity.LogoUrl = request.LogoUrl?.Trim() ?? entity.LogoUrl;
			if (request.IsActive.HasValue) entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);
			return await GetOrganizationByIdAsync(entity.Id, cancellationToken);
		}

		public async Task<bool> DeleteOrganizationAsync(Guid orgId, CancellationToken cancellationToken)
		{
			var entity = await _dbContext.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken);
			if (entity is null) return false;
			_dbContext.Organizations.Remove(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);
			return true;
		}

				public async Task<IReadOnlyList<DeviceSummaryDto>> GetDevicesAsync(
			Guid? organizationId,
			bool? onlyActive,
			CancellationToken cancellationToken
		)
		{
			var devicesQuery = _dbContext.Devices.AsNoTracking();

			if (organizationId.HasValue)
				devicesQuery = devicesQuery.Where(d => d.OrganizationId == organizationId);

			if (onlyActive == true)
				devicesQuery = devicesQuery.Where(d => d.IsActive == true);

			return await (
				from device in devicesQuery
				join org in _dbContext.Organizations.AsNoTracking()
					on device.OrganizationId equals org.Id into orgJoin
				from org in orgJoin.DefaultIfEmpty()
				join creator in _dbContext.Users.AsNoTracking()
					on device.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				orderby device.DeviceName
				select new DeviceSummaryDto
				{
					Id = device.Id,
					OrganizationId = device.OrganizationId,
					OrganizationName = org != null ? org.Name : null,
					DeviceName = device.DeviceName,
					DeviceIdentifier = device.DeviceIdentifier,
					DeviceModel = device.DeviceModel,
					MqttUsername = device.MqttUsername,
					MqttPassword = device.MqttPassword,
					SecretKey = device.SecretKey,
					InstallationDate = device.InstallationDate,
					LastMaintenanceDate = device.LastMaintenanceDate,
					NextMaintenanceDate = device.NextMaintenanceDate,
					BatteryLevel = device.BatteryLevel,
					SignalStrength = device.SignalStrength,
					IsActive = device.IsActive,
					CreatedAt = device.CreatedAt,
					UpdatedAt = device.UpdatedAt,
					CreatedBy = device.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
					Imei = device.Imei,
					IpAddress = device.IpAddress,
					LastSeenAt = device.LastSeenAt
				}
			).ToListAsync(cancellationToken);
		}

		public async Task<DeviceSummaryDto?> GetDeviceByIdAsync(
			Guid deviceId,
			CancellationToken cancellationToken
		)
		{
			return await (
				from device in _dbContext.Devices.AsNoTracking()
				where device.Id == deviceId
				join org in _dbContext.Organizations.AsNoTracking()
					on device.OrganizationId equals org.Id into orgJoin
				from org in orgJoin.DefaultIfEmpty()
				join creator in _dbContext.Users.AsNoTracking()
					on device.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				select new DeviceSummaryDto
				{
					Id = device.Id,
					OrganizationId = device.OrganizationId,
					OrganizationName = org != null ? org.Name : null,
					DeviceName = device.DeviceName,
					DeviceIdentifier = device.DeviceIdentifier,
					DeviceModel = device.DeviceModel,
					MqttUsername = device.MqttUsername,
					MqttPassword = device.MqttPassword,
					SecretKey = device.SecretKey,
					InstallationDate = device.InstallationDate,
					LastMaintenanceDate = device.LastMaintenanceDate,
					NextMaintenanceDate = device.NextMaintenanceDate,
					BatteryLevel = device.BatteryLevel,
					SignalStrength = device.SignalStrength,
					IsActive = device.IsActive,
					CreatedAt = device.CreatedAt,
					UpdatedAt = device.UpdatedAt,
					CreatedBy = device.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
					Imei = device.Imei,
					IpAddress = device.IpAddress,
					LastSeenAt = device.LastSeenAt
				}
			).FirstOrDefaultAsync(cancellationToken);
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
				DeviceModel = request.DeviceModel,
				MqttUsername = request.MqttUsername ?? string.Empty,
				MqttPassword = request.MqttPassword ?? string.Empty,
				SecretKey = request.SecretKey ?? string.Empty,
				InstallationDate = EnsureUtc(request.InstallationDate),
				LastMaintenanceDate = EnsureUtc(request.LastMaintenanceDate),
				NextMaintenanceDate = EnsureUtc(request.NextMaintenanceDate),
				Imei = request.Imei,
				IpAddress = request.IpAddress,
				IsActive = request.IsActive,
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Devices.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DeviceSummaryDto
			{
				Id = entity.Id,
				OrganizationId = entity.OrganizationId,
				DeviceName = entity.DeviceName,
				DeviceIdentifier = entity.DeviceIdentifier,
				DeviceModel = entity.DeviceModel,
				MqttUsername = entity.MqttUsername,
				MqttPassword = entity.MqttPassword,
				SecretKey = entity.SecretKey,
				InstallationDate = entity.InstallationDate,
				LastMaintenanceDate = entity.LastMaintenanceDate,
				NextMaintenanceDate = entity.NextMaintenanceDate,
				BatteryLevel = entity.BatteryLevel,
				SignalStrength = entity.SignalStrength,
				IsActive = entity.IsActive,
				CreatedAt = entity.CreatedAt,
				UpdatedAt = entity.UpdatedAt,
				CreatedBy = entity.CreatedBy,
				Imei = entity.Imei,
				IpAddress = entity.IpAddress,
				LastSeenAt = entity.LastSeenAt
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
			entity.DeviceModel = request.DeviceModel;
			if (request.MqttUsername is not null) entity.MqttUsername = request.MqttUsername;
			if (request.MqttPassword is not null) entity.MqttPassword = request.MqttPassword;
			if (request.SecretKey is not null) entity.SecretKey = request.SecretKey;
			entity.InstallationDate = EnsureUtc(request.InstallationDate);
			entity.LastMaintenanceDate = EnsureUtc(request.LastMaintenanceDate);
			entity.NextMaintenanceDate = EnsureUtc(request.NextMaintenanceDate);
			entity.Imei = request.Imei;
			entity.IpAddress = request.IpAddress;
			entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new DeviceSummaryDto
			{
				Id = entity.Id,
				OrganizationId = entity.OrganizationId,
				DeviceName = entity.DeviceName,
				DeviceIdentifier = entity.DeviceIdentifier,
				DeviceModel = entity.DeviceModel,
				MqttUsername = entity.MqttUsername,
				MqttPassword = entity.MqttPassword,
				SecretKey = entity.SecretKey,
				InstallationDate = entity.InstallationDate,
				LastMaintenanceDate = entity.LastMaintenanceDate,
				NextMaintenanceDate = entity.NextMaintenanceDate,
				BatteryLevel = entity.BatteryLevel,
				SignalStrength = entity.SignalStrength,
				IsActive = entity.IsActive,
				CreatedAt = entity.CreatedAt,
				UpdatedAt = entity.UpdatedAt,
				CreatedBy = entity.CreatedBy,
				Imei = entity.Imei,
				IpAddress = entity.IpAddress,
				LastSeenAt = entity.LastSeenAt
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
					Phone = NormalizeOptionalString(request.Phone),
					AvatarUrl = NormalizeOptionalString(request.AvatarUrl),
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
					OrganizationId = vehicle.OrganizationId,
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
					InspectionExpiry = vehicle.InspectionExpiry,
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
					OrganizationId = vehicle.OrganizationId,
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
					InspectionExpiry = vehicle.InspectionExpiry,
					IsActive = vehicle.IsActive,
					CreatedAt = vehicle.CreatedAt
				};

			return await query.FirstOrDefaultAsync(cancellationToken);
		}

		/// <summary>
		/// Safely creates a new vehicle and conditionally clones an existing device using a parameterized interpolated SQL query.
		/// If a device reassignment is requested and confirmed, the source device is deactivated and its properties are cloned to a new device record.
		/// </summary>
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

				await _dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO tyb_core.devices (
				id, organization_id, device_name, device_identifier, device_model,
				mqtt_username, mqtt_password, secret_key, installation_date,
				last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
				is_active, created_at, updated_at, created_by, imei, ip_address, last_seen_at
			)
			SELECT
				{clonedDeviceId}, organization_id, device_name, device_identifier, device_model,
				mqtt_username, mqtt_password, secret_key, installation_date,
				last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
				TRUE, {now}, {now}, created_by, imei, ip_address, last_seen_at
			FROM tyb_core.devices
			WHERE id = {sourceDevice.Id}
			""", cancellationToken);

				sourceDevice.IsActive = false;
				sourceDevice.UpdatedAt = now;

				finalDeviceId = clonedDeviceId;
			}

			var entity = new Vehicle
			{
				Id = Guid.NewGuid(),
				OrganizationId = request.OrganizationId,
				DeviceId = finalDeviceId,
				VehicleName = request.VehicleName ?? string.Empty,
				PlateNumber = request.PlateNumber ?? string.Empty,
				Brand = request.Brand,
				Model = request.Model,
				Year = request.Year,
				Color = request.Color,
				FuelType = request.FuelType,
				Capacity = request.Capacity,
				InsuranceExpiry = EnsureUtc(request.InsuranceExpiry),
				InspectionExpiry = EnsureUtc(request.InspectionExpiry),
				IsActive = request.IsActive,
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Vehicles.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return new VehicleSummaryDto
			{
				Id = entity.Id,
				OrganizationId = entity.OrganizationId,
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
				InspectionExpiry = entity.InspectionExpiry,
				IsActive = entity.IsActive
			};
		}

		/// <summary>
		/// Safely updates an existing vehicle's information. Conditionally clones a device record using a parameterized interpolated SQL query if a device reassignment is requested and confirmed, deactivating the source device in the process.
		/// </summary>
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

			var requestedDeviceId = request.DeviceId; // Aray�zden se�ilen (Kaynak) cihaz ID'si
			var currentDeviceId = entity.DeviceId;    // Arac�n halihaz�rda ba�l� oldu�u cihaz ID'si

			var isDeviceChanged = requestedDeviceId.HasValue &&
								 (!currentDeviceId.HasValue || requestedDeviceId.Value != currentDeviceId.Value);

			if (isDeviceChanged)
			{
				if (request.ConfirmDeviceReassignment != true)
				{
					throw new InvalidOperationException("Changing connected device requires confirmation.");
				}

				Device? sourceDevice = null;

				if (requestedDeviceId != null)
				{
					sourceDevice = await _dbContext.Devices
					.FirstOrDefaultAsync(device => device.Id == requestedDeviceId.Value, cancellationToken);
				} 

				if (sourceDevice is null)
				{
					throw new InvalidOperationException("Selected source device was not found.");
				}

				var clonedDeviceId = Guid.NewGuid();
				var now = DateTime.UtcNow;

				await _dbContext.Database.ExecuteSqlAsync($"""
			INSERT INTO tyb_core.devices (
				id, organization_id, device_name, device_identifier, device_model,
				mqtt_username, mqtt_password, secret_key, installation_date,
				last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
				is_active, created_at, updated_at, created_by, imei, ip_address, last_seen_at
			)
			SELECT
				{clonedDeviceId}, organization_id, device_name, device_identifier, device_model,
				mqtt_username, mqtt_password, secret_key, installation_date,
				last_maintenance_date, next_maintenance_date, battery_level, signal_strength,
				TRUE, {now}, {now}, created_by, imei, ip_address, last_seen_at
			FROM tyb_core.devices
			WHERE id = {sourceDevice.Id}
			""", cancellationToken);

				entity.DeviceId = clonedDeviceId;

				sourceDevice.IsActive = false;
				sourceDevice.UpdatedAt = now;

			}
			else
			{
				// E�er cihaz de�i�mediyse (isDeviceChanged false) 
				// ama kullan�c� null g�nderdiyse, mevcut cihaz� kald�r.
				// E�er kullan�c� zaten ayn� cihaz� g�nderdiyse, ayn� kal�r.
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
			entity.InspectionExpiry = EnsureUtc(request.InspectionExpiry);
			entity.IsActive = request.IsActive;
			entity.UpdatedAt = DateTime.UtcNow;

			await _dbContext.SaveChangesAsync(cancellationToken);

			return new VehicleSummaryDto
			{
				Id = entity.Id,
				OrganizationId = entity.OrganizationId,
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
				InspectionExpiry = entity.InspectionExpiry,
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

		private static string RoleToString(UserRole role) => role switch
		{
			UserRole.Admin => "admin",
			UserRole.FleetManager => "fleet_manager",
			UserRole.Driver => "driver",
			_ => "viewer"
		};

		private static UserRole ParseRole(string? roleStr) => roleStr?.ToLower() switch
		{
			"admin" => UserRole.Admin,
			"fleet_manager" => UserRole.FleetManager,
			"driver" => UserRole.Driver,
			_ => UserRole.Viewer
		};

		public async Task<IReadOnlyList<UserSummaryDto>> GetUsersAsync(
			Guid? organizationId,
			CancellationToken cancellationToken
		)
		{
			var query = _dbContext.Users.AsNoTracking();

			if (organizationId.HasValue)
				query = query.Where(u => u.OrganizationId == organizationId);

			return await (
				from user in query
				join org in _dbContext.Organizations.AsNoTracking()
					on user.OrganizationId equals org.Id into orgJoin
				from org in orgJoin.DefaultIfEmpty()
				join creator in _dbContext.Users.AsNoTracking()
					on user.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				orderby user.FullName
				select new UserSummaryDto
				{
					Id = user.Id,
					OrganizationId = user.OrganizationId,
					OrganizationName = org != null ? org.Name : null,
					Username = user.Username,
					Email = user.Email,
					FullName = user.FullName,
					Phone = user.Phone,
					Role = RoleToString(user.Role),
					IsActive = user.IsActive,
					LastLogin = user.LastLogin,
					AvatarUrl = user.AvatarUrl,
					CreatedAt = user.CreatedAt,
					UpdatedAt = user.UpdatedAt,
					CreatedBy = user.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
				}
			).ToListAsync(cancellationToken);
		}

		public async Task<UserSummaryDto?> GetUserByIdAsync(
			Guid userId,
			CancellationToken cancellationToken
		)
		{
			return await (
				from user in _dbContext.Users.AsNoTracking()
				where user.Id == userId
				join org in _dbContext.Organizations.AsNoTracking()
					on user.OrganizationId equals org.Id into orgJoin
				from org in orgJoin.DefaultIfEmpty()
				join creator in _dbContext.Users.AsNoTracking()
					on user.CreatedBy equals creator.Id into creatorJoin
				from creator in creatorJoin.DefaultIfEmpty()
				select new UserSummaryDto
				{
					Id = user.Id,
					OrganizationId = user.OrganizationId,
					OrganizationName = org != null ? org.Name : null,
					Username = user.Username,
					Email = user.Email,
					FullName = user.FullName,
					Phone = user.Phone,
					Role = RoleToString(user.Role),
					IsActive = user.IsActive,
					LastLogin = user.LastLogin,
					AvatarUrl = user.AvatarUrl,
					CreatedAt = user.CreatedAt,
					UpdatedAt = user.UpdatedAt,
					CreatedBy = user.CreatedBy,
					CreatedByName = creator != null ? creator.FullName : null,
				}
			).FirstOrDefaultAsync(cancellationToken);
		}

		public async Task<UserSummaryDto?> CreateUserAsync(
			UserUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			if (string.IsNullOrWhiteSpace(request.Username))
			{
				throw new InvalidOperationException("Username is required.");
			}

			if (string.IsNullOrWhiteSpace(request.Email))
			{
				throw new InvalidOperationException("Email is required.");
			}

			var now = DateTime.UtcNow;
			var password = string.IsNullOrWhiteSpace(request.Password) ? "Tyb.1905" : request.Password;

			var entity = new User
			{
				Id = Guid.NewGuid(),
				OrganizationId = request.OrganizationId,
				Username = request.Username.Trim(),
				Email = request.Email.Trim(),
				FullName = request.FullName?.Trim() ?? string.Empty,
				Phone = NormalizeOptionalString(request.Phone),
				AvatarUrl = NormalizeOptionalString(request.AvatarUrl),
				Role = ParseRole(request.Role),
				IsActive = request.IsActive ?? true,
				PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
				CreatedAt = now,
				UpdatedAt = now
			};

			_dbContext.Users.Add(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);

			return await GetUserByIdAsync(entity.Id, cancellationToken);
		}

		public async Task<UserSummaryDto?> UpdateUserAsync(
			Guid userId,
			UserUpsertRequest request,
			CancellationToken cancellationToken
		)
		{
			var entity = await _dbContext.Users
				.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

			if (entity is null) return null;

			var username = NormalizeOptionalString(request.Username);
			var fullName = NormalizeOptionalString(request.FullName);
			var email = NormalizeOptionalString(request.Email);

			if (username is not null) entity.Username = username;
			if (fullName is not null) entity.FullName = fullName;
			if (email is not null) entity.Email = email;
			if (request.Phone is not null) entity.Phone = NormalizeOptionalString(request.Phone);
			if (request.AvatarUrl is not null) entity.AvatarUrl = NormalizeOptionalString(request.AvatarUrl);

			if (request.OrganizationId.HasValue) entity.OrganizationId = request.OrganizationId;
			if (!string.IsNullOrWhiteSpace(request.Role)) entity.Role = ParseRole(request.Role);
			if (request.IsActive.HasValue) entity.IsActive = request.IsActive;
			if (!string.IsNullOrWhiteSpace(request.Password))
			{
				entity.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
			}

			entity.UpdatedAt = DateTime.UtcNow;
			await _dbContext.SaveChangesAsync(cancellationToken);

			return await GetUserByIdAsync(entity.Id, cancellationToken);
		}

		public async Task<bool> DeleteUserAsync(Guid userId, CancellationToken cancellationToken)
		{
			var entity = await _dbContext.Users
				.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

			if (entity is null) return false;

			_dbContext.Users.Remove(entity);
			await _dbContext.SaveChangesAsync(cancellationToken);
			return true;
		}
	}
}







