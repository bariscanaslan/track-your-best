namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class DriverTripDecisionRequest
	{
		public string Decision { get; set; } = string.Empty;
		public string? Notes { get; set; }
	}
}
