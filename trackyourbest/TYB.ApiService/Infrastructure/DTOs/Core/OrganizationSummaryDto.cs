namespace TYB.ApiService.Infrastructure.DTOs.Core
{
	public class OrganizationSummaryDto
	{
		public Guid Id { get; set; }
		public string Name { get; set; } = string.Empty;
		public string? LegalName { get; set; }
		public string? TaxNumber { get; set; }
		public string? Email { get; set; }
		public string? Phone { get; set; }
		public string? Address { get; set; }
		public string? City { get; set; }
		public string? Country { get; set; }
		public string? Website { get; set; }
		public string? LogoUrl { get; set; }
		public bool? IsActive { get; set; }
		public DateTime? CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public Guid? CreatedBy { get; set; }
		public string? CreatedByName { get; set; }
	}
}
