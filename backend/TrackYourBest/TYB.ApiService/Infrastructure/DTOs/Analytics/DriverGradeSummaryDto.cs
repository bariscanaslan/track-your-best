namespace TYB.ApiService.Infrastructure.DTOs.Analytics
{
	public class DriverGradeSummaryDto
	{
		public Guid DriverId { get; set; }
		public double AverageOverallScore { get; set; }
		public int TripCount { get; set; }
		public DateTime? LastCalculatedAt { get; set; }
	}
}