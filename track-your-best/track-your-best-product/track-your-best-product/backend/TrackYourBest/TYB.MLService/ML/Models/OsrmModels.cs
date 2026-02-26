// Dosya Yolu: TYB.MLService/ML/Models/OsrmModels.cs

namespace TYB.MLService.ML.Models
{
    public class OsrmResponse
    {
        public string code { get; set; }
        public OsrmRoute[] routes { get; set; }
    }

    public class OsrmRoute
    {
        public double distance { get; set; }  // meters
        public double duration { get; set; }  // seconds
    }
}
