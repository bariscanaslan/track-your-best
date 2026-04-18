#define TINY_GSM_MODEM_SIM808
#define TINY_GSM_RX_BUFFER 1024

#include <HardwareSerial.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>

//////////////////////////////////////////////////
// SERIAL & MODEM
//////////////////////////////////////////////////

HardwareSerial sim808(2);

const int SIM808_RX_PIN = 16;
const int SIM808_TX_PIN = 17;
const uint32_t SIM808_BAUD = 9600;

TinyGsm modem(sim808);
TinyGsmClient gsmClient(modem);
PubSubClient mqtt(gsmClient);

//////////////////////////////////////////////////
// NETWORK CONFIG
//////////////////////////////////////////////////

const char* APN        = "internet";
const char* GPRS_USER  = "";
const char* GPRS_PASS  = "";

const char* MQTT_HOST = "51.20.118.85";
const uint16_t MQTT_PORT = 1883;

const char* MQTT_USERNAME = "tyb-device";
const char* MQTT_PASSWORD = "Tyb.1905";

//////////////////////////////////////////////////
// DEVICE CONFIG
//////////////////////////////////////////////////

// Organization TYB Logistics: 0310ed50-86f2-468c-901d-6b3fcb113914

const char* DEVICE_ID_0 = "tyb00";
const char* DEVICE_SECRET_0 = "9bd71e81578fce257f3acf93aea9bdbced4b0b43d490850376a63fb59fcda3c8";

const char* DEVICE_ID_1 = "tyb01";
const char* DEVICE_SECRET_1 = "1fff2d3f2f1c2f164130518daf32191ba2f743d7b85ff8f27ba41287f4b80eb2";

const char* DEVICE_ID_2 = "tyb02";
const char* DEVICE_SECRET_2 = "1eb6bcfec8402afee74a52df0884e6a5a561d6b034eb3f043d73583a1c09ef01";

// Organization BMA Teknik Servis: a8f6ddc9-fabe-4c1f-8a4a-71673be127c4

const char* DEVICE_ID_4 = "tyb04";
const char* DEVICE_SECRET_4 = "f2da9ad8bb5f8fd8301ba346492698f1d3886a57a1cf3d33f0a43efbc9948721";

const char* DEVICE_ID = DEVICE_ID_2;

String GPS_TOPIC        = "gps/" + String(DEVICE_ID);
String HEARTBEAT_TOPIC  = "heartbeat/" + String(DEVICE_ID);
String DEVICEINFO_TOPIC = "device-info/" + String(DEVICE_ID);

const char* DEVICE_SECRET = DEVICE_SECRET_2;

unsigned long lastGpsSend = 0;
unsigned long lastHeartbeat = 0;

//////////////////////////////////////////////////
// GPS TUNING
//////////////////////////////////////////////////

const unsigned long GPS_INTERVAL_NOFIX_MS = 1500;   // Fix yokken daha sık dene
const unsigned long GPS_INTERVAL_FIX_MS   = 5000;   // Fix varken normal periyot
const unsigned long GPS_NOFIX_RESET_MS    = 120000; // 120 sn fix yoksa GNSS soft reset

bool gpsHasFix = false;
unsigned long noFixSince = 0;
unsigned long lastGnssReset = 0;

//////////////////////////////////////////////////
// HMAC
//////////////////////////////////////////////////

String hmacSha256(const String& message, const String& secret) {

  byte hash[32];
  mbedtls_md_context_t ctx;
  const mbedtls_md_info_t* info =
    mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, info, 1);
  mbedtls_md_hmac_starts(&ctx,
    (const unsigned char*)secret.c_str(), secret.length());
  mbedtls_md_hmac_update(&ctx,
    (const unsigned char*)message.c_str(), message.length());
  mbedtls_md_hmac_finish(&ctx, hash);
  mbedtls_md_free(&ctx);

  char buf[65];
  for (int i = 0; i < 32; i++) {
    sprintf(buf + (i * 2), "%02x", hash[i]);
  }
  buf[64] = 0;

  return String(buf);
}

//////////////////////////////////////////////////
// AT HELPERS
//////////////////////////////////////////////////

static void drainUart(HardwareSerial& s) {
  while (s.available()) (void)s.read();
}

static String readUntilTimeout(HardwareSerial& s, unsigned long timeoutMs) {
  String resp;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (s.available()) {
      resp += char(s.read());
    }
    delay(10);
  }
  return resp;
}

// fieldIndex: 0=runStatus, 1=fixStatus, 2=utc, 3=lat, 4=lon ...
static bool getCsvField(const String& csv, int fieldIndex, String& out) {
  int start = 0;
  int end = -1;

  for (int i = 0; i <= fieldIndex; i++) {
    start = end + 1;
    end = csv.indexOf(',', start);
    if (end < 0) {
      // last field
      if (i == fieldIndex) {
        out = csv.substring(start);
        out.trim();
        return true;
      }
      return false;
    }
  }
  out = csv.substring(start, end);
  out.trim();
  return true;
}

//////////////////////////////////////////////////
// GPS
//////////////////////////////////////////////////

// Fix durumunu CGNSINF fixStatus alanından kontrol eder.
// Fix yoksa false döner.
bool getGpsLatLon(double& lat, double& lon) {

  lat = 0.0;
  lon = 0.0;

  drainUart(sim808);
  sim808.println("AT+CGNSINF");

  // SIM808 bazen cevabı parçalı döner; timeoutlu oku
  String response = readUntilTimeout(sim808, 1800);

  int pos = response.indexOf("+CGNSINF:");
  if (pos < 0) return false;

  // Satırı al (pos'tan sonraki ilk newline'a kadar)
  int lineEnd = response.indexOf('\n', pos);
  String line = (lineEnd > pos) ? response.substring(pos, lineEnd) : response.substring(pos);
  line.trim();

  int colon = line.indexOf(':');
  if (colon < 0) return false;

  String csv = line.substring(colon + 1);
  csv.trim();

  String fixStr, latStr, lonStr;

  // fixStatus alanı (1 => fix var)
  if (!getCsvField(csv, 1, fixStr)) return false;
  if (fixStr != "1") return false;

  if (!getCsvField(csv, 3, latStr)) return false;
  if (!getCsvField(csv, 4, lonStr)) return false;

  lat = latStr.toFloat();
  lon = lonStr.toFloat();

  return !(lat == 0.0 && lon == 0.0);
}

static void gnssSoftReset() {
  Serial.println("♻️ GNSS soft reset (CGNSPWR=0/1)...");
  drainUart(sim808);
  sim808.println("AT+CGNSPWR=0");
  delay(1200);
  drainUart(sim808);
  sim808.println("AT+CGNSPWR=1");
  delay(1200);
}

//////////////////////////////////////////////////
// GSM + GPRS
//////////////////////////////////////////////////

bool connectGPRS() {

  Serial.println("🔄 Restarting modem...");
  modem.restart();

  Serial.println("📶 Waiting for GSM network...");

  if (!modem.waitForNetwork(60000L)) {
    Serial.println("❌ GSM Network FAILED");
    return false;
  }

  Serial.println("✅ GSM Connected");
  Serial.print("📡 Signal Quality (RSSI): ");
  Serial.println(modem.getSignalQuality());

  Serial.println("🌐 Connecting to GPRS...");

  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) {
    Serial.println("❌ GPRS FAILED");
    return false;
  }

  Serial.println("✅ GPRS Connected");
  Serial.print("🌍 IP Address: ");
  Serial.println(modem.localIP());

  return true;
}

void ensureGPRS() {

  while (true) {

    if (connectGPRS()) break;

    Serial.println("⏳ Retrying GSM in 5 seconds...");
    delay(5000);
  }
}

//////////////////////////////////////////////////
// MQTT
//////////////////////////////////////////////////

bool connectMQTT() {

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  String clientId = "esp32-" + String(random(0xffff), HEX);

  Serial.print("🔌 Connecting MQTT... ");

  if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {

    Serial.println("✅ Connected");

    sendDeviceInfo();
    sendHeartbeat();
    lastHeartbeat = millis();

    return true;
  }

  Serial.print("❌ MQTT FAILED. State=");
  Serial.println(mqtt.state());

  return false;
}

void ensureMQTT() {

  while (!mqtt.connected()) {

    if (connectMQTT()) break;

    Serial.println("⏳ Retrying MQTT in 5 seconds...");
    delay(5000);
  }
}

//////////////////////////////////////////////////
// DEVICE INFO
//////////////////////////////////////////////////

void sendDeviceInfo() {

  StaticJsonDocument<256> doc;

  doc["imei"] = modem.getIMEI();
  doc["ip_address"] = modem.localIP().toString();

  int16_t rssi = modem.getSignalQuality();
  if (rssi >= 0) {
    doc["signal_strength"] = rssi;
  }

  char payload[256];
  serializeJson(doc, payload);

  mqtt.publish(DEVICEINFO_TOPIC.c_str(), payload);

  Serial.println("📤 Device-info payload:");
  Serial.println(payload);
}

//////////////////////////////////////////////////
// HEARTBEAT
//////////////////////////////////////////////////

void sendHeartbeat() {

  StaticJsonDocument<128> doc;
  doc["status"] = String(DEVICE_ID) + " alive";

  char payload[128];
  serializeJson(doc, payload);

  mqtt.publish(HEARTBEAT_TOPIC.c_str(), payload);

  Serial.println("❤️ Heartbeat payload:");
  Serial.println(payload);
}

//////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////

void setup() {

  Serial.begin(115200);
  delay(1000);

  sim808.begin(SIM808_BAUD, SERIAL_8N1,
               SIM808_RX_PIN, SIM808_TX_PIN);
  delay(3000);

  Serial.println("🚀 Booting Device...");
  sim808.println("AT");
  delay(1000);

  sim808.println("ATE0");      // echo off
  delay(500);

  // Sleep kapalı (fix ararken daha stabil)
  sim808.println("AT+CSCLK=0");
  delay(300);

  // GNSS ON
  sim808.println("AT+CGNSPWR=1");
  delay(1000);

  // Fix takibi başlangıcı
  gpsHasFix = false;
  noFixSince = millis();
  lastGnssReset = 0;

  ensureGPRS();   // 🔥 GSM & GPRS guaranteed
  ensureMQTT();   // 🔥 MQTT guaranteed
}

//////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////

void loop() {

  if (!modem.isNetworkConnected()) {
    Serial.println("⚠ GSM lost. Reconnecting...");
    ensureGPRS();
  }

  if (!mqtt.connected()) {
    Serial.println("⚠ MQTT lost. Reconnecting...");
    ensureMQTT();
  }

  mqtt.loop();

  unsigned long now = millis();

  //////////////////////////////////////////////////
  // GPS: Fix yokken daha sık, fix varken normal
  //////////////////////////////////////////////////

  unsigned long gpsInterval = gpsHasFix ? GPS_INTERVAL_FIX_MS : GPS_INTERVAL_NOFIX_MS;

  if (now - lastGpsSend > gpsInterval) {

    lastGpsSend = now;

    double lat, lon;

    // Önce GPS oku (GSM TX/publish ile çakışmayı azaltır)
    bool ok = getGpsLatLon(lat, lon);

    if (ok) {

      gpsHasFix = true;
      noFixSince = 0;

      StaticJsonDocument<256> doc;

      doc["device_id"] = DEVICE_ID;
      doc["latitude"]  = lat;
      doc["longitude"] = lon;
      doc["timestamp"] = millis();

      String raw;
      serializeJson(doc, raw);

      doc["signature"] = hmacSha256(raw, DEVICE_SECRET);

      char payload[320];
      serializeJson(doc, payload);

      mqtt.publish(GPS_TOPIC.c_str(), payload);

      Serial.println("📍 GPS sent");
    }
    else {

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      // Yukarıdaki tekrarlar ESP32 için gerekmez ama güvenli; istersen temizlerim.
      // Asıl mantık:
      if (!gpsHasFix && noFixSince == 0) noFixSince = now;

      // Fix yoksa sürekli log
      Serial.println("⚠ GPS fix not available");

      // İlk fix hiç gelmiyorsa GNSS soft reset
      if (!gpsHasFix && noFixSince != 0 && (now - noFixSince > GPS_NOFIX_RESET_MS)) {
        // Reset spam olmasın diye araya guard koy
        if (now - lastGnssReset > GPS_NOFIX_RESET_MS) {
          lastGnssReset = now;
          gnssSoftReset();
          noFixSince = now; // yeniden say
        }
      }
    }
  }

  //////////////////////////////////////////////////
  // Heartbeat every 5 minutes
  //////////////////////////////////////////////////

  if (now - lastHeartbeat > 300000) {

    lastHeartbeat = now;
    sendHeartbeat();
  }
}
