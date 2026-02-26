// Dosya Yolu: TYB.MLService/ML/Services/IMLPredictionService.cs

using TYB.MLService.ML.Models;

namespace TYB.MLService.ML.Services
{
    public interface IMLPredictionService
    {
        Task<EtaPredictionResponse> PredictEtaAsync(
            double distanceKm, 
            int osrmDurationSec, 
            DateTime? timestamp = null
        );
        
        Task<bool> IsHealthyAsync();
    }
}
