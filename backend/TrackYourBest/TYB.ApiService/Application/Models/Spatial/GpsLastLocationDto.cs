namespace TYB.ApiService.Application.Models.Spatial
{
	public record GpsLastLocationDto(
		Guid DeviceId,
		Guid VehicleId,
		string? DeviceName,
		double Latitude,
		double Longitude,
		DateTime? GpsTimestamp,
		DateTime? ReceivedTimestamp
	);
}
