namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class GeocodeResultDto
	{
		public string DisplayName { get; set; } = string.Empty;
		public string OpenAddress { get; set; } = string.Empty;
		public double Latitude { get; set; }
		public double Longitude { get; set; }
	}
}
