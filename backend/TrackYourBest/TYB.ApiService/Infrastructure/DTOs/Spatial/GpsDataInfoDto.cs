namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public record GpsDataInfoDto(
		Guid DeviceId,
		Guid? TripId,
		string? Geography,
		double Latitude,
		double Longitude,
		DateTime? GpsTimestamp
	);
}
