#!/usr/bin/env python3
"""
TYB01 Route GPS Simulator
- PostgreSQL GEOMETRY (hex binary / WKB) route tanımı
- Sabit rota üzerinde hız kontrolü (km/h)
- Terminal input ile anlık hız ayarı (q = çıkış)
- 3 saniyede bir MQTT publish
"""

import json
import time
import math
import hmac
import hashlib
import struct
import threading
import sys
import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion

##################################################
# MQTT CONFIG
##################################################

MQTT_HOST     = "51.20.118.85"
MQTT_PORT     = 1883
MQTT_USERNAME = "tyb-device"
MQTT_PASSWORD = "Tyb.1905"

##################################################
# DEVICE CONFIG
##################################################

DEVICE_ID     = "tyb01"
DEVICE_SECRET = "1fff2d3f2f1c2f164130518daf32191ba2f743d7b85ff8f27ba41287f4b80eb2"

PUBLISH_INTERVAL = 1        # saniye
DEFAULT_SPEED_KMH = 60.0    # km/h

##################################################
# ROUTE — PostgreSQL GEOMETRY hex binary (WKB)
#
# Buraya kendi LineString WKB hex'ini yapıştır.
# Örnek: PostGIS'ten  SELECT ST_AsEWKB(geom)::text  ile alabilirsin.
#
# Aşağıdaki örnek İstanbul Boğazı çevresinde küçük bir rotadır.
# Koordinatlar: LINESTRING(lon lat, lon lat, ...) formatında.
##################################################

ROUTE_WKB_HEX = (
    "0102000020E61000009E000000C05AB56B42023D40D594641D8E8644406B64575A46023D4022FE614B8F864440D47E6B274A023D40C2C1DEC490864440A81B28F04E023D400EF7915B93864440CA89761552023D407845F0BF958644409F8EC70C54023D4000ADF9F1978644408DEF8B4B55023D4016A1D80A9A864440B0C56E9F55023D40548CF337A1864440CEDE196D55023D4090DB2F9FAC8644407593180456023D40A9BC1DE1B48644409E2633DE56023D40A12FBDFDB9864440A9A0A2EA57023D40C826F911BF864440D333BDC458023D408A58C4B0C386444038F92D3A59023D406BD784B4C686444086CABF9657023D4004763579CA8644400DFE7E315B023D40F38FBE49D386444094313ECC5E023D401EDC9DB5DB864440847F113466023D400F7BA180ED864440FC00A43671023D40912BF52C08874440919BE1067C023D4030F5F3A6228744403750E09D7C023D40A034D4282487444084B9DDCB7D023D4010406A132787444063D009A183023D40276893C32787444003603C8386023D4062669FC7288744403D2AFEEF88023D4014950D6B2A8744408F5033A48A023D40A77686A92D8744406555849B8C023D40573D601E32874440CC07043A93023D408542041C42874440A661F88898023D40AF264F594D8744403BDF4F8D97023D40D2C8E7154F87444007D2C5A695023D40E9F010C64F87444055A3570394023D403C4B9011508744401C412AC58E023D403C4B9011508744403605323B8B023D408AE8D7D64F87444019541B9C88023D4054A703594F8744402FC37FBA81023D409C36E33444874440488787307E023D40335019FF3E8744400EBDC5C37B023D40D6E3BED53A874440F7C8E6AA79023D407F349C3237874440232C2AE274023D40F4DF83D72E8744403733FAD170023D40C993A46B26874440508F6D1970023D40E7E099D0248744409FC893A46B023D40287FF78E1A874440003961C268023D403DEE5BAD138744400E83F92B64023D4096E82CB308874440212235ED62023D402DCE18E6048744409B560A815C023D402F4D11E0F48644401AE0826C59023D40C2DD59BBED8644400C79043752023D4001C3F2E7DB86444097E4805D4D023D407D93A641D18644407289230F44023D40D1E7A38CB88644401D76DF313C023D4027F56569A7864440685A626534023D4065A6B4FE968644405AF3E32F2D023D400EDAAB8F878644401A6CEA3C2A023D4094BC3AC780864440427A8A1C22023D40AA0EB9196E8644405AD6FD6321023D403ACFD8976C86444067B8019F1F023D40E910381268864440BB29E5B512023D403F355EBA4986444057CC086F0F023D40E43098BF42864440B4E7323509023D4080B6D5AC3386444006F1811DFF013D40DA01D71533864440029CDEC5FB013D40F81A82E332864440DA70581AF8013D40CA32C4B12E864440C2F7FE06ED013D40FA997ADD2286444015E46723D7013D40469561DC0D864440583B8A73D4013D4079E9263108864440FED2A23EC9013D400B462575028644406B8313D1AF013D405A2E1B9DF385444017F549EEB0013D409C51F355F2854440ADDA3521AD013D40B5E1B034F085444063416150A6013D40D8666325E6854440C3499A3FA6013D4031B2648EE5854440B5E21B0A9F013D407F32C687D9854440CA51802898013D4067EDB60BCD85444013F241CF66013D40F8FE06EDD58544400A48FB1F60013D40C3F17C06D48544408F8EAB915D013D40A1832EE1D08544402844C02154013D40F6798CF2CC85444065DEAAEB50013D40F1F09E03CB854440E17A14AE47013D40062CB98AC5854440F581E49D43013D4008944DB9C28544401C28F04E3E013D403F7100FDBE8544403BA92F4B3B013D40F9F884ECBC8544408F1A13622E013D40D95A5F24B4854440695721E527013D4054C37E4FAC854440D1B2EE1F0B013D40E02EFB75A78544401825E82FF4003D400B5EF415A48544408847E2E5E9003D409B1E1494A28544404E603AADDB003D400DC68844A1854440A35698BED7003D40C93A1C5DA5854440AB7B6473D5003D40BC581822A7854440FD84B35BCB003D40A260C614AC8544409015FC36C4003D4011381268B0854440876BB587BD003D400F9C33A2B48544407077D66EBB003D40B41CE8A1B6854440ACA92C0ABB003D4000529B38B98544407CF1457BBC003D406F29E78BBD854440E4A3C519C3003D4060AB048BC3854440300DC347C4003D406534F279C5854440FA97A432C5003D40CF8250DEC78544404DBED9E6C6003D4071CB4752D2854440E23B31EBC5003D40CF9F36AAD38544409DF7FF71C2003D4091D10149D88544401DE90C8CBC003D4048895DDBDB8544407FC16ED8B6003D40BD512B4CDF85444017F2086EA4003D40BEA25BAFE98544401405FA449E003D40B058C345EE854440F4FE3F4E98003D407E384888F285444049F59D5F94003D40EBA7FFACF985444049F59D5F94003D4067614F3BFC854440EAEC647094003D401F813FFCFC8544400806103E94003D40520FD1E80E8644405182FE428F003D40C879FF1F27864440051901158E003D40BFD53A71398644409F77634161003D40F3AE7AC03C86444052F17F4754003D40B18BA2073E86444059164CFC51003D4063EE5A423E8644404AF086342A003D403D7C992842864440B9AAECBB22003D406743FE994186444073D53C47E4FF3C403ECDC98B4C864440B47405DB88FF3C406C06B8205B86444026FF93BF7BFF3C40DD79E2395B86444079EBFCDB65FF3C40EA5BE67459864440F44D9A0645FF3C407B849A21558644402BA6D24F38FF3C40700A2B1554864440F5D901D715FF3C40DD28B2D650864440A7EB89AE0BFF3C40139ED0EB4F8644401B6327BC04FF3C4093C3279D48864440137F1475E6FE3C40F450DB865186444030BC92E4B9FE3C401DC70F9546864440A5DC7D8E8FFE3C40F83768AF3E8644404E61A5828AFE3C405D3123BC3D8644404A0C022B87FE3C40D32D3BC43F864440319A95ED43FE3C400CE71A666886444046CF2D7425FE3C40D9AF3BDD79864440F20698F90EFE3C40C8957A1684864440B49080D1E5FD3C40DE3EABCC948644403735D07CCEFD3C402670EB6E9E864440548F34B8ADFD3C4031074147AB864440FDD98F1491FD3C404F0306499F864440588D25AC8DFD3C40503750E09D864440CC6262F371FD3C40855B3E929286444008043A9336FD3C409F02603C83864440B8567BD80BFD3C407D9411178086444076A8A624EBFC3C40E97E4E417E864440289D4830D5FC3C40B43D7AC37D8644401A36CAFACDFC3C40B43D7AC37D864440E4C0ABE5CEFC3C404819710168864440E97DE36BCFFC3C401F4C8A8F4F864440A88E554ACFFC3C403D997FF44D86444049861C5BCFFC3C405B9544F64186444061E28FA2CEFC3C4087A757CA328644405B25581CCEFC3C403BA6EECA2E864440A9F6E978CCFC3C40FC523F6F2A86444015E126A3CAFC3C40DAE4F04927864440EEB5A0F7C6FC3C40E82E89B32286444089B663EAAEFC3C408E75711B0D864440"    
)

##################################################
# WKB PARSER
##################################################

def parse_wkb_linestring(hex_str: str) -> list[tuple[float, float]]:
    """
    PostgreSQL WKB (little-endian) veya EWKB hex'ini parse eder.
    LINESTRING → [(lat, lon), ...] listesi döner.
    Desteklenen WKB type: 2 (LineString) ve 0x20000002 (EWKB with SRID).
    """
    data = bytes.fromhex(hex_str)
    idx = 0

    byte_order = data[idx]; idx += 1
    if byte_order != 1:
        raise ValueError("Sadece little-endian (byte order = 1) WKB destekleniyor.")

    wkb_type = struct.unpack_from('<I', data, idx)[0]; idx += 4
    geom_type = wkb_type & 0xFFFF

    # EWKB: SRID varsa atla
    has_srid = bool(wkb_type & 0x20000000)
    if has_srid:
        idx += 4  # SRID (4 byte)

    if geom_type != 2:
        raise ValueError(f"Beklenen geometry tipi: LineString (2), gelen: {geom_type}")

    num_points = struct.unpack_from('<I', data, idx)[0]; idx += 4

    points = []
    for _ in range(num_points):
        lon = struct.unpack_from('<d', data, idx)[0]; idx += 8
        lat = struct.unpack_from('<d', data, idx)[0]; idx += 8
        points.append((lat, lon))

    return points

##################################################
# GEO HELPERS
##################################################

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    """İki nokta arası mesafe (metre)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def interpolate(lat1, lon1, lat2, lon2, frac: float):
    """İki nokta arasında doğrusal interpolasyon."""
    return lat1 + (lat2 - lat1) * frac, lon1 + (lon2 - lon1) * frac

##################################################
# HMAC
##################################################

def hmac_sha256(message: str, secret: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()

##################################################
# ROUTE RUNNER
##################################################

class RouteRunner:
    """
    Verilen waypoint listesi üzerinde hıza göre pozisyon hesaplar.
    advance(dt_seconds) çağrıldığında güncel (lat, lon) döner.
    """
    def __init__(self, waypoints: list[tuple[float, float]]):
        self.waypoints = waypoints
        self.segments  = []  # (dist_m, cumulative_m)
        self.total_m   = 0.0
        self.traveled_m = 0.0
        self.finished  = False

        cumulative = 0.0
        for i in range(len(waypoints) - 1):
            la1, lo1 = waypoints[i]
            la2, lo2 = waypoints[i+1]
            d = haversine_m(la1, lo1, la2, lo2)
            cumulative += d
            self.segments.append((d, cumulative))
        self.total_m = cumulative

    def current_position(self) -> tuple[float, float]:
        if self.traveled_m >= self.total_m:
            return self.waypoints[-1]

        cum = 0.0
        for i, (seg_d, seg_cum) in enumerate(self.segments):
            prev_cum = seg_cum - seg_d
            if self.traveled_m <= seg_cum:
                frac = (self.traveled_m - prev_cum) / seg_d if seg_d > 0 else 0
                la1, lo1 = self.waypoints[i]
                la2, lo2 = self.waypoints[i+1]
                return interpolate(la1, lo1, la2, lo2, frac)
        return self.waypoints[-1]

    def advance(self, dt_seconds: float, speed_kmh: float) -> tuple[float, float]:
        if self.finished:
            return self.waypoints[-1]

        speed_ms = speed_kmh / 3.6
        self.traveled_m += speed_ms * dt_seconds

        if self.traveled_m >= self.total_m:
            self.traveled_m = self.total_m
            self.finished = True
            print("\n✅ Rota tamamlandı. Script sonlandırılıyor...\n")

        return self.current_position()

##################################################
# SHARED STATE
##################################################

class SharedState:
    def __init__(self, initial_speed: float):
        self._speed = initial_speed
        self._lock  = threading.Lock()
        self.running = True

    @property
    def speed(self) -> float:
        with self._lock:
            return self._speed

    @speed.setter
    def speed(self, val: float):
        with self._lock:
            self._speed = val

##################################################
# INPUT THREAD
##################################################

def input_thread(state: SharedState):
    print("💬 Hız girmek için sayı yaz (km/h), çıkmak için 'q' yaz:\n")
    while state.running:
        try:
            line = input().strip()
        except EOFError:
            break

        if line.lower() == 'q':
            print("🛑 Kullanıcı çıkışı.")
            state.running = False
            break
        try:
            new_speed = float(line)
            if new_speed < 0:
                print("⚠️  Negatif hız girilemez.")
            else:
                state.speed = new_speed
                print(f"🔄 Hız güncellendi: {new_speed:.1f} km/h")
        except ValueError:
            print("⚠️  Geçersiz giriş. Sayı veya 'q' gir.")

##################################################
# MQTT SIMULATOR
##################################################

class Simulator:
    def __init__(self, waypoints, state: SharedState):
        self.runner = RouteRunner(waypoints)
        self.state  = state

        self.client = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION2,
            client_id="sim-tyb01",
        )
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    def connect(self):
        self.client.connect(MQTT_HOST, MQTT_PORT, 60)
        self.client.loop_start()
        print(f"✅ MQTT bağlandı → {MQTT_HOST}:{MQTT_PORT}\n")

        info_payload = json.dumps({
            "device_id": DEVICE_ID,
            "mode": "route_simulation",
            "total_waypoints": len(self.runner.waypoints),
            "total_distance_m": round(self.runner.total_m, 2),
        })
        self.client.publish(f"device-info/{DEVICE_ID}", info_payload)
        print(f"📤 device-info/{DEVICE_ID}\n📦 {info_payload}\n")

    def gps_payload(self, lat: float, lon: float) -> str:
        data = {
            "device_id": DEVICE_ID,
            "latitude":  round(lat, 6),
            "longitude": round(lon, 6),
            "timestamp": int(time.time() * 1000),
        }
        raw = json.dumps(data, separators=(',', ':'))
        data["signature"] = hmac_sha256(raw, DEVICE_SECRET)
        return json.dumps(data)

    def run(self):
        print(f"🚀 Simülasyon başladı | Rota: {len(self.runner.waypoints)} nokta | "
              f"Toplam: {self.runner.total_m:.0f} m\n")

        last_tick = time.time()

        while self.state.running and not self.runner.finished:
            now = time.time()
            dt  = now - last_tick
            last_tick = now

            lat, lon = self.runner.advance(dt, self.state.speed)

            topic   = f"gps/{DEVICE_ID}"
            payload = self.gps_payload(lat, lon)
            self.client.publish(topic, payload)

            traveled_pct = (self.runner.traveled_m / self.runner.total_m * 100) if self.runner.total_m else 0
            print(f"📤 {topic} | {self.state.speed:.1f} km/h | "
                  f"{self.runner.traveled_m:.0f}/{self.runner.total_m:.0f} m "
                  f"({traveled_pct:.1f}%)\n📦 {payload}\n")

            time.sleep(PUBLISH_INTERVAL)

        self.client.loop_stop()
        self.client.disconnect()
        print("🔌 MQTT bağlantısı kapatıldı.")

##################################################
# MAIN
##################################################

if __name__ == "__main__":
    # 1. Geometry parse
    try:
        waypoints = parse_wkb_linestring(ROUTE_WKB_HEX)
        print(f"🗺️  Rota parse edildi: {len(waypoints)} waypoint")
        for i, (la, lo) in enumerate(waypoints):
            print(f"   [{i}] lat={la:.6f}, lon={lo:.6f}")
        print()
    except Exception as e:
        print(f"❌ WKB parse hatası: {e}")
        sys.exit(1)

    if len(waypoints) < 2:
        print("❌ Rota en az 2 noktadan oluşmalı.")
        sys.exit(1)

    # 2. Shared state
    state = SharedState(DEFAULT_SPEED_KMH)

    # 3. Input thread
    t = threading.Thread(target=input_thread, args=(state,), daemon=True)
    t.start()

    # 4. Simulator
    sim = Simulator(waypoints, state)
    sim.connect()
    sim.run()

    state.running = False
    print("👋 Çıkıldı.")