// Dosya Yolu: TYB.MLService/Infrastructure/Data/MLDbContext.cs

using Microsoft.EntityFrameworkCore;
using TYB.MLService.Infrastructure.Entities.Analytics;

namespace TYB.MLService.Infrastructure.Data
{
    public class MLDbContext : DbContext
    {
        public MLDbContext(DbContextOptions<MLDbContext> options) : base(options) { }

        public DbSet<EtaPrediction> EtaPredictions { get; set; }
        // Diğer DbSet'leri de buraya ekleyebilirsin...

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ETA Predictions Configuration
            modelBuilder.Entity<EtaPrediction>(entity =>
            {
                entity.ToTable("eta_predictions", "tyb_analytics");
                entity.HasKey(e => e.Id);
                
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TripId).HasColumnName("trip_id");
                entity.Property(e => e.DeviceId).HasColumnName("device_id");
                
                entity.Property(e => e.PredictionTime).HasColumnName("prediction_time");
                entity.Property(e => e.PredictedArrivalTime).HasColumnName("predicted_arrival_time");
                entity.Property(e => e.ActualArrivalTime).HasColumnName("actual_arrival_time");
                
                entity.Property(e => e.CurrentLocation)
                    .HasColumnName("current_location")
                    .HasColumnType("geometry(Point,4326)");
                
                entity.Property(e => e.Destination)
                    .HasColumnName("destination")
                    .HasColumnType("geometry(Point,4326)");
                
                entity.Property(e => e.RemainingDistanceKm)
                    .HasColumnName("remaining_distance_km")
                    .HasColumnType("numeric(10,2)");
                
                entity.Property(e => e.PredictionErrorSeconds).HasColumnName("prediction_error_seconds");
                
                entity.Property(e => e.AccuracyPercentage)
                    .HasColumnName("accuracy_percentage")
                    .HasColumnType("numeric(5,2)");
                
                entity.Property(e => e.ModelVersion)
                    .HasColumnName("model_version")
                    .HasMaxLength(50);
                
                entity.Property(e => e.ConfidenceScore)
                    .HasColumnName("confidence_score")
                    .HasColumnType("numeric(5,2)");
                
                entity.Property(e => e.TrafficFactor)
                    .HasColumnName("traffic_factor")
                    .HasColumnType("numeric(5,2)");
                
                entity.Property(e => e.WeatherFactor)
                    .HasColumnName("weather_factor")
                    .HasColumnType("numeric(5,2)");
                
                entity.Property(e => e.HistoricalPerformance)
                    .HasColumnName("historical_performance")
                    .HasColumnType("numeric(5,2)");
                
                entity.Property(e => e.Metadata)
                    .HasColumnName("metadata")
                    .HasColumnType("jsonb")
                    .HasDefaultValueSql("'{}'");
            });
        }
    }
}
