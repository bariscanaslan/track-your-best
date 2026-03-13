namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public record DeviceLastLocationDto(
		Guid DeviceId,
		Guid? VehicleId,
		string? DeviceName,
		Guid? TripId,
		string? Geography,
		double Latitude,
		double Longitude,
		DateTime? GpsTimestamp,
		DateTime? ReceivedTimestamp
	);
}
