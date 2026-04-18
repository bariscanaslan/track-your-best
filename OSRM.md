🪟 1️⃣ Klasör Oluştur

PowerShell aç:

mkdir C:\osrm-data
cd C:\osrm-data
🌍 2️⃣ OSM Verisini İndir (Türkiye)
curl -L -o turkey.osm.pbf https://download.geofabrik.de/europe/turkey-latest.osm.pbf

Dosya birkaç GB olabilir, indirme sürebilir.

🐳 3️⃣ OSRM Docker Image Çek
docker pull ghcr.io/project-osrm/osrm-backend
⚙️ 4️⃣ Haritayı İşle (Preprocessing)

PowerShell'de $(pwd) çalışmaz.
Onun yerine Windows path’i direkt veriyoruz.

4.1 Extract
docker run --rm -t `
  -v C:\osrm-data:/data `
  ghcr.io/project-osrm/osrm-backend `
  osrm-extract -p /opt/car.lua /data/turkey.osm.pbf
4.2 Partition
docker run --rm -t `
  -v C:\osrm-data:/data `
  ghcr.io/project-osrm/osrm-backend `
  osrm-partition /data/turkey.osrm
4.3 Customize
docker run --rm -t `
  -v C:\osrm-data:/data `
  ghcr.io/project-osrm/osrm-backend `
  osrm-customize /data/turkey.osrm
🚀 5️⃣ OSRM Server’ı Başlat
docker run --rm -t `
  -p 5000:5000 `
  -v C:\osrm-data:/data `
  ghcr.io/project-osrm/osrm-backend `
  osrm-routed --algorithm mld /data/turkey.osrm

Başarılıysa şunu görürsün:

Listening on 0.0.0.0:5000
🧪 6️⃣ Test Et

PowerShell'de:

curl "http://localhost:5000/route/v1/driving/28.9784,41.0082;29.0000,41.0150?overview=full&geometries=geojson"

JSON dönüyorsa çalışıyor 🎉