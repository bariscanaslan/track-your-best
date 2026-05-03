namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public record GpsRoutePointDto(
		double Latitude,
		double Longitude,
		DateTime? GpsTimestamp
	);
}
