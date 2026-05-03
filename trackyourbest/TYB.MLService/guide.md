# TYB MLService Guide

## 1. Proje Nedir?

`TYB.MLService`, Track Your Best platformu için çalışan Python tabanlı bir arka plan worker servisidir. Bu servis doğrudan bir HTTP API sunmaz. Onun yerine belirli aralıklarla veritabanını tarar, uygun kayıtları bulur, makine öğrenmesi ve kural tabanlı analiz çalıştırır, sonuçları tekrar veritabanına yazar.

Projede üç temel iş vardır:

1. ETA tahmini
2. Sürücü skorlama
3. Anomali tespiti

Servis PostgreSQL/PostGIS veritabanına bağlanır, `APScheduler` ile zamanlanmış işleri çalıştırır ve ETA için harici bir OSRM routing servisine istek atar.

## 2. Yüksek Seviyede Ne İşe Yarıyor?

Bu servis operasyonel olarak şunları yapar:

- Aktif sayılabilecek yolculuklar için tahmini varış zamanı üretir.
- Tamamlanmış yolculukların sürüş kalitesini puanlar.
- Tamamlanmış yolculuklarda GPS davranışı ve hareket profilinden anomali arar.
- Analiz sonuçlarını uygulamanın başka katmanlarının tüketebileceği analytics tablolarına yazar.

Kısaca: `tyb_spatial` şemasındaki operasyonel seyahat verisini okuyup, `tyb_analytics` şemasında analitik çıktı üretir.

## 3. Ana Mimari

Ana akış şu şekildedir:

1. `main.py` servisi başlatır.
2. `jobs/scheduler.py` üç zamanlanmış job ekler.
3. Her job veritabanından kendi kriterine uyan kayıtları çeker.
4. `ml_core/` altındaki bileşenler feature üretir veya model tahmini yapar.
5. Sonuçlar analytics tablolarına yazılır.

Ana dosyalar:

- `TYB.MLService/main.py`: giriş noktası
- `TYB.MLService/jobs/scheduler.py`: job kayıtları ve periyotlar
- `TYB.MLService/db/database.py`: SQLAlchemy engine ve session
- `TYB.MLService/db/models.py`: ORM modelleri ve ETA helper fonksiyonları
- `TYB.MLService/ml_core/`: feature extraction ve model wrapper katmanı
- `TYB.MLService/utils/osrm_client.py`: rota ve süre almak için OSRM istemcisi

## 4. Çalışma Sıklıkları

Kod içindeki sabit ayarlara göre job periyotları şunlardır:

- Anomali tespiti: 120 saniye
- Sürücü skorlama: 300 saniye
- ETA tahmini: 180 saniye

Bu değerler `config/settings.py` içindeki `JOB_INTERVALS` sabitinden gelir.

Not: `.env` içinde `JOB_*_INTERVAL` alanları var ama mevcut kod bu değerleri okumuyor. Yani pratikte çalışan periyotlar `settings.py` içindeki hardcoded değerlerdir.

## 5. Bağımlılıklar ve Dış Sistemler

Servisin doğru çalışması için şu bileşenler gerekir:

- PostgreSQL + PostGIS
- OSRM sunucusu
- `models_bin/` içindeki model dosyaları
- `data/ibb_traffic_patterns_2024_2025.csv`

ETA job’ı özellikle iki şeye bağımlıdır:

- OSRM route sonucu
- Eğitilmiş ETA modeli + trafik pattern CSV’si

## 6. Veritabanı Bağlantısı ve Şemalar

Servis varsayılan olarak şu bağlantı stringini kullanır:

`postgresql://postgres:password@localhost:5432/tyb_production`

Kullanılan ana şemalar:

- `tyb_spatial`: operasyonel seyahat ve GPS verisi
- `tyb_analytics`: ML çıktıları

## 7. Veritabanından Hangi Bilgileri Okuyor?

### 7.1 `tyb_spatial.trips`

Bu tablo servis için ana giriş tablosudur. Kod seviyesinde kullanılan başlıca alanlar:

- `id`
- `vehicle_id`
- `driver_id`
- `status`
- `start_location`
- `end_location`
- `start_time`
- `end_time`
- `planned_end_time`
- `duration_seconds`
- `total_distance_km`
- `max_speed`
- `avg_speed`
- `stop_count`
- `harsh_acceleration_count`
- `harsh_braking_count`
- `metadata`
- `created_at`
- `updated_at`

Job bazında kullanım:

- ETA job, `status='driver_approve'` olan tripleri okur.
- Driver scoring job, `status='completed'` olan ve henüz score üretilmemiş tripleri okur.
- Anomaly job, `status='completed'` olan ve henüz anomaly kaydı oluşmamış tripleri okur.

### 7.2 `tyb_spatial.gps_data`

Bu tablo yolculukların ham GPS izidir. Kodun kullandığı alanlar:

- `id`
- `trip_id`
- `device_id`
- `latitude`
- `longitude`
- `gps_timestamp`
- `received_timestamp`

Kullanım biçimi:

- Driver scoring job, bir trip’in tüm GPS noktalarını zaman sırasına göre okur.
- Anomaly job, bir trip’in tüm GPS noktalarını zaman sırasına göre okur.
- ETA job, bir trip’in en son GPS kaydını okur. Eğer GPS yoksa `start_location` fallback olarak kullanılır.

### 7.3 ETA için dolaylı okunan bilgiler

ETA tahmini sadece DB’den gelen veriyle yapılmaz. Şunlar da okunur:

- `data/ibb_traffic_patterns_2024_2025.csv`
- `models_bin/eta_model_istanbul.pkl`
- OSRM servisinden rota mesafesi ve süre bilgisi

Bu sayede tahmin girdileri oluşturulur:

- kalan mesafe
- OSRM baz süre
- saat
- haftanın günü
- hafta sonu bilgisi
- rush hour bilgisi
- trafik yoğunluğu
- ortalama hız

## 8. Veritabanında Hangi Bilgileri Oluşturuyor?

Servis veritabanında üç tip çıktı üretir:

### 8.1 `tyb_analytics.eta_predictions`

ETA job her çalıştığında uygun tripler için yeni prediction satırı oluşturur. Aynı trip için tek kayıt güncellemek yerine yeni kayıt ekleme mantığı vardır.

Yazılan başlıca alanlar:

- `id`
- `trip_id`
- `device_id` (`None` yazılıyor)
- `prediction_time`
- `predicted_arrival_time`
- `current_location`
- `destination`
- `remaining_distance_km`
- `model_version`
- `confidence_score`
- `traffic_factor`
- `weather_factor` (`1.0` default)
- `historical_performance` (`None`)
- `metadata`

`metadata` içine yazılan detaylar:

- `eta_minutes`
- `eta_formatted`
- `is_rush_hour`
- `avg_speed_kmh`
- `traffic_density`
- `hour`
- `day_of_week`
- `is_weekend`
- `model_info`

### 8.2 `tyb_analytics.driver_scores`

Driver scoring job, tamamlanmış ve henüz puanlanmamış tripler için tekil kayıt üretir. `trip_id` alanı unique tanımlıdır; yani amaç bir trip için tek score kaydı tutmaktır.

Yazılan başlıca alanlar:

- `id`
- `trip_id`
- `driver_id`
- `overall_score`
- `speed_score`
- `acceleration_score`
- `braking_score`
- `idle_time_score`
- `total_distance_km`
- `total_duration_seconds`
- `speeding_events`
- `harsh_acceleration_events`
- `harsh_braking_events`
- `analysis_date`
- `calculated_at`
- `metadata`

`metadata` içine yazılan detaylar:

- `algo_version`
- `ml_reference_score`
- olay sayıları ve severity toplamları
- speeding süresi
- speeding ratio

### 8.3 `tyb_analytics.anomalies`

Anomaly job, tamamlanmış ve henüz anomaly kaydı olmayan tripler için kayıt oluşturur. Bu tabloda aynı trip için teorik olarak birden fazla satır olabilir, ama job seçim mantığı ilk anomaly oluşunca o trip’i tekrar seçmez.

Yazılan başlıca alanlar:

- `id`
- `trip_id`
- `device_id`
- `anomaly_type`
- `severity`
- `description`
- `confidence_score`
- `algorithm_used`
- `detected_at`
- `metadata`

`metadata` içine yazılan detaylar:

- `anomaly_score`
- `raw_score`
- `flags`
- `features`
- `severity`

## 9. Job Bazlı Ayrıntılı Akış

## 9.1 ETA Prediction Job

Dosya: `TYB.MLService/jobs/eta_prediction_job.py`

Bu job’ın amacı, `driver_approve` durumundaki tripler için düzenli ETA üretmektir.

Akış:

1. `get_pending_trips(session)` çağrılır.
2. `tyb_spatial.trips` tablosundan `status='driver_approve'` olan tripler alınır.
3. Her trip için son GPS kaydı aranır.
4. GPS varsa mevcut konum olarak son GPS noktası alınır.
5. GPS yoksa başlangıç noktası (`start_location`) mevcut konum kabul edilir.
6. `end_location` hedef olarak alınır.
7. OSRM’ye istek atılarak kalan rota mesafesi ve tahmini sürüş süresi alınır.
8. ETA modeli çağrılır.
9. Sonuç `tyb_analytics.eta_predictions` tablosuna yeni satır olarak yazılır.

Okuduğu veriler:

- `trips.status`
- `trips.start_location`
- `trips.end_location`
- `gps_data.latitude`
- `gps_data.longitude`
- `gps_data.gps_timestamp`
- trafik CSV verisi
- ETA model dosyası
- OSRM response

Oluşturduğu veriler:

- tahmini varış zamanı
- prediction zamanı
- kalan mesafe
- trafik etkisi
- confidence skoru
- metadata içinde detay ETA açıklaması

Önemli davranış:

- Bu job trip durumunu güncellemez.
- Aynı trip için her turda yeni prediction oluşturabilir.
- `ETA_BATCH_SIZE=10`, yani tek çalıştırmada en fazla 10 trip işler.

## 9.2 Driver Scoring Job

Dosya: `TYB.MLService/jobs/driver_scoring_job.py`

Bu job’ın amacı, tamamlanmış bir yolculuğun sürüş kalitesini puanlamaktır.

Akış:

1. `status='completed'` ve `driver_scores` tablosunda kaydı olmayan tripler seçilir.
2. İlgili trip için tüm GPS kayıtları zaman sırasıyla okunur.
3. GPS noktalarından hız, ivme, sert fren, sert hızlanma gibi feature’lar çıkarılır.
4. ML modeli referans skor üretir.
5. Nihai skor doğrudan event-based matematik ile hesaplanır.
6. Sonuç `tyb_analytics.driver_scores` tablosuna yazılır.

Burada kritik nokta:

- Kodun yorumuna göre ML model nihai skoru belirlemiyor.
- ML skoru sadece `metadata.ml_reference_score` olarak tutuluyor.
- Asıl `overall_score`, hız/fren/hızlanma cezaları üzerinden hesaplanıyor.

Preprocessing ile üretilen önemli feature’lar:

- `duration_sec`
- `moving_seconds`
- `distance_m`
- `avg_speed_mps`
- `p95_speed_mps`
- `max_speed_mps`
- `speed_std`
- `stop_count`
- `speeding_seconds`
- `speeding_ratio_pct`
- `brake_event_count`
- `brake_severity_sum`
- `accel_event_count`
- `accel_severity_sum`

Skor mantığı:

- yüksek hız profili cezalandırılır
- sert fren olayları cezalandırılır
- sert hızlanma olayları cezalandırılır
- en kötü alt skor, overall score üzerinde ekstra etkili olur

Okuduğu veriler:

- `trips.id`
- `trips.driver_id`
- `trips.status`
- ilgili `gps_data` kayıtları

Oluşturduğu veriler:

- overall sürücü puanı
- alt kırılım puanları
- olay bazlı metrikler
- metadata içinde algoritma versiyonu ve ML referans skoru

## 9.3 Anomaly Detection Job

Dosya: `TYB.MLService/jobs/anomaly_job.py`

Bu job tamamlanmış triplerde olağandışı sürüş veya GPS davranışı arar.

Akış:

1. `status='completed'` ve `anomalies` tablosunda kaydı olmayan tripler seçilir.
2. İlgili trip için tüm GPS noktaları okunur.
3. Preprocessing ile feature set çıkarılır.
4. Bu feature set anomaly modeline uygun giriş formatına çevrilir.
5. Isolation Forest pipeline ile skor üretilir.
6. Ardından rule-based override uygulanır.
7. Sonuç anomali kabul edilirse `tyb_analytics.anomalies` tablosuna yazılır.

Model sonrası rule-based flag örnekleri:

- `IMPOSSIBLE_MOTION`
- `JERK_HIGH`
- `CRASH_OR_TELEPORT_SUSPICION`
- `OSCILLATION`
- `GPS_SPIKE`

Severity mantığı:

- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`

Anomali kaydı ancak şu durumda oluşur:

- skor threshold üstündeyse
- veya fiziksel/rule-based flag’lerden biri tetiklenirse

Okuduğu veriler:

- `trips.id`
- `trips.status`
- trip’e ait tüm `gps_data`

Oluşturduğu veriler:

- anomali skoru
- severity
- açıklama
- confidence
- flags
- feature snapshot

## 10. Feature Extraction Katmanı Ne Yapıyor?

Dosya: `TYB.MLService/ml_core/preprocessing.py`

Bu dosya tüm GPS analizinin merkezidir. Ham GPS noktasını doğrudan model input’una vermez. Arada şu işleri yapar:

- iki nokta arası mesafeyi `haversine` ile hesaplar
- zaman farkından hız üretir
- hareketli ortalama ile hız serisini yumuşatır
- ivme serisi çıkarır
- stop/moving sürelerini ayırır
- discrete event extraction ile sert fren ve sert hızlanma olaylarını sayar

Bu nedenle driver scoring ve anomaly detection aynı temel feature kaynağını paylaşır.

## 11. ETA Modeli Nasıl Çalışıyor?

Dosya: `TYB.MLService/ml_core/eta_predictor.py`

ETA modeli şu girdilerle çalışır:

- `distance_km`
- `osrm_duration_sec`
- `hour`
- `day_of_week`
- `is_weekend`
- `is_rush_hour`
- `ibb_avg_speed`
- `ibb_traffic_density`
- `ibb_speed_factor`

Model çıktıları:

- `eta_minutes`
- `eta_seconds`
- `eta_formatted`
- `predicted_arrival_time`
- `confidence`
- `traffic_info`
- `model_info`

Önemli nokta:

- ETA sadece rota uzunluğuna değil zaman bağlamına da bakar.
- İstanbul trafik pattern CSV’si bu yüzden kritik girdidir.

## 12. Projenin Gerçek Veri Sözleşmesi

Koddan çıkan gerçek iş kuralı özeti:

- `driver_approve` = ETA üretilecek trip
- `completed` = skorlama ve anomali analizi yapılacak trip
- `cancelled` = ETA job tarafından doğal olarak dışarıda kalır

Bu servis kendisi trip oluşturmaz, GPS verisi üretmez, trip status değiştirmez. Bunlar başka servislerin görevidir. Bu servis yalnızca mevcut operasyonel veriyi okuyup analytics kaydı üretir.

## 13. Veritabanı Okuma/Yazma Matrisi

| Job | Okuduğu Kaynak | Filtre | Yazdığı Hedef | Ürettiği Şey |
|---|---|---|---|---|
| ETA Prediction | `tyb_spatial.trips`, `tyb_spatial.gps_data`, OSRM, traffic CSV | `trips.status='driver_approve'` | `tyb_analytics.eta_predictions` | ETA geçmişi |
| Driver Scoring | `tyb_spatial.trips`, `tyb_spatial.gps_data` | `trips.status='completed'` ve mevcut score yok | `tyb_analytics.driver_scores` | Trip bazlı sürüş puanı |
| Anomaly Detection | `tyb_spatial.trips`, `tyb_spatial.gps_data` | `trips.status='completed'` ve mevcut anomaly yok | `tyb_analytics.anomalies` | Anomali kaydı |

## 14. Dikkat Çeken Teknik Notlar

Kod incelemesinde dokümana eklenmesi gereken bazı önemli noktalar var:

### 14.1 `.env` interval ayarları etkisiz

`.env` içinde interval alanları var ama `settings.py` bunları kullanmıyor. Operasyonda interval değiştirmek istenirse kod güncellemesi gerekir.

### 14.2 Anomaly kayıtlarında `device_id` artık GPS verisinden türetiliyor

Anomaly job içinde `Trip` ORM modelinde olmayan `trip.device_id` erişimi yerine, ilgili trip’in GPS kayıtlarındaki `device_id` değeri kullanılıyor. Böylece ORM-model uyuşmazlığı nedeniyle job’ın kırılması engellenmiş oldu.

### 14.3 README ile gerçek kod arasında kısmi farklar var

Doküman bazı yerlerde ONNX veya farklı dosya isimlerinden bahsediyor, fakat mevcut kod:

- driver scoring için `joblib` ile PKL yükleyen `driver_scoring_model.pkl` bekliyor
- anomaly için `anomaly_model.pkl` kullanıyor
- ETA için `eta_model_istanbul.pkl` kullanıyor

Yani operasyonel referans olarak README’dan çok kodun kendisi esas alınmalıdır.

### 14.4 ETA kayıtları append-only mantıkta

Aynı trip için her ETA çalışmasında yeni satır üretilir. Bu iyi bir history sağlar ama tablo büyümesini hızlandırır.

## 15. Servis Başlatıldığında Ne Olur?

1. Logging konfigüre edilir.
2. Scheduler ayağa kalkar.
3. Üç job sisteme eklenir.
4. Process sonsuz döngüde canlı tutulur.
5. SIGINT veya SIGTERM alınırsa scheduler kapatılır.

Bu nedenle servis bir worker process gibi davranır; request-response tipi bir servis değildir.

## 16. Hangi Dosya Ne İş Yapıyor?

### Giriş ve config

- `TYB.MLService/main.py`: worker process başlangıcı
- `TYB.MLService/config/settings.py`: DB, OSRM, model path, scheduler interval, threshold ayarları

### DB katmanı

- `TYB.MLService/db/database.py`: SQLAlchemy engine ve session yönetimi
- `TYB.MLService/db/models.py`: ORM tabloları ve ETA helper’ları

### Job katmanı

- `TYB.MLService/jobs/scheduler.py`: job registration
- `TYB.MLService/jobs/eta_prediction_job.py`: ETA üretimi
- `TYB.MLService/jobs/driver_scoring_job.py`: sürücü puanlama
- `TYB.MLService/jobs/anomaly_job.py`: anomali üretimi

### ML ve yardımcı katman

- `TYB.MLService/ml_core/preprocessing.py`: GPS feature extraction
- `TYB.MLService/ml_core/driver_scorer.py`: sürücü skorlama model wrapper
- `TYB.MLService/ml_core/anomaly_detector.py`: anomaly model wrapper + rule engine
- `TYB.MLService/ml_core/eta_predictor.py`: ETA modeli ve trafik pattern kullanımı
- `TYB.MLService/utils/osrm_client.py`: rota ve süre hesabı için OSRM istemcisi
- `TYB.MLService/utils/logger.py`: logging setup

## 17. Operasyonel Olarak Bu Proje Hangi Sorunu Çözüyor?

Bu proje, ham telemetri ve trip verisini tek başına anlamlandırmak yerine, onun üstüne operasyonel karar desteği ekliyor:

- kullanıcıya veya ekrana ETA göstermek
- sürücü performansını sayısallaştırmak
- şüpheli sürüş / GPS davranışını işaretlemek

Bu sayede TYB platformu sadece konum saklayan bir sistem olmaktan çıkıp analitik yorum üreten bir sisteme dönüşüyor.

## 18. Sonuç

`TYB.MLService` özü itibarıyla bir analytics worker’dır. Veri üretim kaynağı değildir; veri tüketip analitik sonuç üretir. En önemli girdileri `trips`, `gps_data`, trafik pattern verisi ve OSRM route bilgisidir. En önemli çıktıları ise `eta_predictions`, `driver_scores` ve `anomalies` tablolarıdır.

Eğer bu projeyi devralacak biri tek cümlelik bir özet isterse:

`TYB.MLService`, trip ve GPS verisini düzenli aralıklarla analiz edip ETA, sürücü puanı ve anomali kaydı üreten Python arka plan servisidir.
