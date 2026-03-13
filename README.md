Adım 1 

PS C:\osrm-data>

docker run --rm -t `
-p 5000:5000 `
-v C:\osrm-data:/data `
ghcr.io/project-osrm/osrm-backend `
osrm-routed --algorithm mld /data/turkey.osrm

curl "http://localhost:5000/route/v1/driving/29.025,40.99;29.008,41.042"

Adım 2

PS C:\Users\topra\Desktop\TYB_ML_ETA> .\venv\Scripts\activate
(venv) PS C:\Users\topra\Desktop\TYB_ML_ETA> python scripts/phase4_ml_api.py

Adım 3 

PS C:\Users\topra\Desktop\track-your-best-product\track-your-best-product\backend\TrackYourBest\TYB.MLService> 

Adım 4 

PS C:\Users\topra\Desktop\track-your-best-product\track-your-best-product\backend\TrackYourBest\TYB.ApiService>

Adım 5 

PS C:\Users\topra\Desktop\track-your-best-product\track-your-best-product\frontend> npm run dev 

Adım 6

Reacttan rota seç, approvela sonra test_eta_from_trips ı runla, google mapsden gelen eta ile mlden gelen etayı karşılaştır

Çıkan sonuçlar eta comparisson tablosuna ve TYB_ETA_Validation_Results.xlsx e kayıt olacaktır.