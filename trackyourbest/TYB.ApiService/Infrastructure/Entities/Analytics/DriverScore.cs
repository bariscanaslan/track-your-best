namespace TYB.ApiService.Infrastructure.Entities.Analytics
{
    public class DriverScore
    {
        public Guid Id { get; set; }
        public Guid DriverId { get; set; }
        public Guid TripId { get; set; }
        public DateTime AnalysisDate { get; set; }
        public string PeriodType { get; set; } = default!;
        public double OverallScore { get; set; }
        public double? SpeedScore { get; set; }
        public double? AccelerationScore { get; set; }
        public double? BrakingScore { get; set; }
        public double? CorneringScore { get; set; }
        public double? IdleTimeScore { get; set; }
        public int? TotalTrips { get; set; }
        public double? TotalDistanceKm { get; set; }
        public int? TotalDurationSeconds { get; set; }
        public int? SpeedingEvents { get; set; }
        public int? HarshAccelerationEvents { get; set; }
        public int? HarshBrakingEvents { get; set; }
        public double? FuelEfficiencyScore { get; set; }
        public double? EstimatedFuelConsumption { get; set; }
        public string? Metadata { get; set; }
        public DateTime CalculatedAt { get; set; }
    }
}