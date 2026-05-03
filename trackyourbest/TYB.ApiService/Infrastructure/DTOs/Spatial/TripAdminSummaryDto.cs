namespace TYB.ApiService.Infrastructure.DTOs.Spatial
{
	public class TripAdminSummaryDto
	{
		public Guid Id { get; set; }
		public Guid? VehicleId { get; set; }
		public string? VehicleName { get; set; }
		public Guid? DriverId { get; set; }
		public string? DriverName { get; set; }
		public Guid? OrganizationId { get; set; }
		public string? OrganizationName { get; set; }
		public string? TripName { get; set; }
		public string? Status { get; set; }
		public string? OriginAddress { get; set; }
		public string? DestinationAddress { get; set; }
		public DateTime StartedAt { get; set; }
		public DateTime? EndedAt { get; set; }
		public double? DistanceKm { get; set; }
		public DateTime? CreatedAt { get; set; }
	}
}
