// Dosya Yolu: TYB.MLService/Infrastructure/Services/IOsrmService.cs

using TYB.MLService.ML.Models;

namespace TYB.MLService.Infrastructure.Services
{
    public interface IOsrmService
    {
        Task<OsrmResponse> GetRouteAsync(
            double startLat, 
            double startLon, 
            double endLat, 
            double endLon
        );
    }
}
