namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public record GpsDataInfoDto(
		Guid DeviceId,
		Guid? TripId,
		string? Geography,
		double Latitude,
		double Longitude,
		decimal? Accuracy,
		decimal? Speed,
		bool? IsMoving,
		bool? IsStopped,
		DateTime? GpsTimestamp
	);
}
