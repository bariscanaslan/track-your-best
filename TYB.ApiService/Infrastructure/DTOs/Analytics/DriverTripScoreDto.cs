namespace TYB.ApiService.Infrastructure.DTOs.Analytics
{
    public class DriverTripScoreDto
    {
        public Guid ScoreId { get; set; }
        public Guid DriverId { get; set; }
        public string? DriverName { get; set; }
        public string? AvatarUrl { get; set; }
        public Guid TripId { get; set; }
        public string? TripName { get; set; }
        public double OverallScore { get; set; }
        public double? SpeedScore { get; set; }
        public double? AccelerationScore { get; set; }
        public double? BrakingScore { get; set; }
        public double? CorneringScore { get; set; }
        public double? IdleTimeScore { get; set; }
        public DateTime CalculatedAt { get; set; }
    }
}
