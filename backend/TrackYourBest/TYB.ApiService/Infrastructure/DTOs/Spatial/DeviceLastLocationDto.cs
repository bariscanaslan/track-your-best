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
		decimal? Accuracy,
		decimal? Speed,
		bool? IsMoving,
		bool? IsStopped,
		DateTime? GpsTimestamp,
		DateTime? ReceivedTimestamp
	);
}
