#!/usr/bin/env python3
"""
TYB01 Route GPS Simulator
- PostgreSQL GEOMETRY (hex binary / WKB) route tanımı
- Sabit rota üzerinde hız kontrolü (km/h)
- Terminal input ile anlık hız ayarı (q = çıkış)
- 3 saniyede bir MQTT publish
"""

import os
from dotenv import load_dotenv
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

load_dotenv()

##################################################
# MQTT CONFIG
##################################################

MQTT_HOST = os.getenv("MQTT_HOST")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

##################################################
# DEVICE CONFIG
##################################################

DEVICE_ID = os.getenv("DEVICE_ID_1")
DEVICE_SECRET = os.getenv("DEVICE_SECRET_1")

PUBLISH_INTERVAL = int(os.getenv("PUBLISH_INTERVAL", "1"))
DEFAULT_SPEED_KMH = float(os.getenv("DEFAULT_SPEED_KMH", "60.0"))

##################################################
# ROUTE — PostgreSQL GEOMETRY hex binary (WKB)
##################################################

ROUTE_WKB_HEX = (
    "0102000020E6100000B30000000D17B9A7AB0B3D403DF19C2D20964440A7E9B303AE0B3D407EE02A4F209644401B9B1DA9BE0B3D4037001B1021964440DB300A82C70B3D40E3A59BC420964440E82FF488D10B3D404F5C8E572096444028D4D347E00B3D40917F66101F9644409E279EB3050C3D408BC22E8A1E9644405073F222130C3D40A3EA573A1F964440CDB1BCAB1E0C3D40C0CFB870209644404BAFCDC64A0C3D40D427B9C32696444064ADA1D45E0C3D40569E40D829964440524832AB770C3D408F34B8AD2D964440ABCDFFAB8E0C3D401D59F96530964440F1113125920C3D40B1A206D3309644407CB779E3A40C3D408C648F50339644403DD2E0B6B60C3D40DA01D71533964440D7A4DB12B90C3D40279F1EDB32964440C23577F4BF0C3D4081EA1F443296444089F02F82C60C3D401C25AFCE31964440BC95253ACB0C3D40BD1C76DF319644400D54C6BFCF0C3D407BF99D2633964440FAB48AFED00C3D402C280CCA34964440CAC2D7D7BA0C3D40E0DBF4673F9644408CA37213B50C3D40024A438D429644402E03CE52B20C3D40A20DC006449644407F87A2409F0C3D40E02C25CB49964440346953758F0C3D403ECDC98B4C9644404CA8E0F0820C3D400858AB764D964440DDB3AED1720C3D40EA3E00A94D9644402A00C633680C3D40DE9046054E964440A4349BC7610C3D40CC2555DB4D964440ADA415DF500C3D40C79C67EC4B96444004E621533E0C3D40221CB3EC49964440158C4AEA040C3D40C4AF58C345964440F9BD4D7FF60B3D40D74E948444964440EF8E8CD5E60B3D40EB55647440964440B2D7BB3FDE0B3D40E700C11C3D96444094A12AA6D20B3D409D67EC4B36964440DDB5847CD00B3D4080828B153596444038691A14CD0B3D40D41055F8339644405E0F26C5C70B3D40698EACFC3296444093FFC9DFBD0B3D40C896E5EB3296444075AC527AA60B3D4028D3687231964440CCED5EEE930B3D40E25AED612F9644404165FCFB8C0B3D40D6E07D552E964440F37684D3820B3D40AE81AD122C964440191D90847D0B3D40C7116BF129964440EAAF5758700B3D4088BEBB9525964440A56B26DF6C0B3D403B55BE67249644404A9BAA7B640B3D409B9141EE22964440A6B6D4415E0B3D40EF1F0BD121964440C34A0515550B3D405AD6FD63219644400ADAE4F0490B3D4078EFA83121964440E6E61BD13D0B3D402A52616C2196444036035C902D0B3D40BF9B6ED9219644402B6C06B8200B3D404837C2A222964440622CD32F110B3D400057B26323964440A0A9D72D020B3D40C4245CC82396444031D28BDAFD0A3D407787140324964440B5183C4CFB0A3D40B876A22424964440207EFE7BF00A3D400BD1217024964440AA6400A8E20A3D40F931E6AE25964440A8DF85ADD90A3D4022C50089269644405C76887FD80A3D403430F2B22696444096236420CF0A3D40CE3637A6279644407A5567B5C00A3D407974232C2A96444060747973B80A3D4049BC3C9D2B964440BEF73768AF0A3D4000A8E2C62D964440E59D4319AA0A3D4011DF89592F9644400F7C0C569C0A3D408C3045B93496444014B4C9E1930A3D40E3DF675C38964440D6FCF84B8B0A3D402FE1D05B3C9644402B3410CB660A3D4078465B954496444075931804560A3D40F9BCE2A9479644400E492D944C0A3D406FB9FAB14996444042D13C80450A3D40AAB706B64A964440685A6265340A3D4009C03FA54A964440361D01DC2C0A3D40C8D0B1834A9644403B38D89B180A3D405891D101499644400876FC17080A3D40B2101D0247964440B532E197FA093D4025ECDB49449644402AAA7EA5F3093D40F69B89E9429644405CAD1397E3093D40ECBDF8A23D9644404AD40B3ECD093D408C3045B934964440D53F8864C8093D404CA94BC6319644406FF25B74B2083D400D8CBCAC89954440C078060DFD073D401E8A027D2295444053E751F17F073D407BF7C77BD594444004A9143B1A073D406AFB57569A9444405D35CF11F9063D40C287122D799444409CFD8172DB063D40FDFA21365894444023F77475C7063D40C171193735944440E4D70FB1C1063D40F661BD512B94444005C1E3DBBB063D401D3C139A24944440AE450BD0B6063D408048BF7D1D9444404963B48EAA063D4051DB86511094444005871744A4063D4003ED0E290694444018096D3997063D4090D78349F193444059DB148F8B063D40E1270EA0DF934440063065E080063D4071FF91E9D0934440D9AF3BDD79063D40D673D2FBC6934440B01C210379063D402579AEEFC3934440D4F2035779063D40EAAEEC82C19344408BDEA9807B063D40B709F7CABC9344406808C72C7B063D401E6B4606B993444039B874CC79063D404F57772CB69344409FE5797077063D405C397B67B49344407D772B4B74063D40C2323674B39344406DA818E76F063D404B02D4D4B2934440B72407EC6A063D405D6DC5FEB29344402B3410CB66063D40D49D279EB3934440C119FCFD62063D4085CC9541B59344400A2E56D460063D40F5D72B2CB89344401CCD91955F063D4083FC6CE4BA934440B24AE9995E063D40452E3883BF9344406479573D60063D409BA9108FC493444003098A1F63063D4052616C21C893444030F1475167063D40DF516342CC934440581CCEFC6A063D408A8F4FC8CE9344404415FE0C6F063D40DDB5847CD0934440E8F9D34675063D4000581D39D29344407AA702EE79063D40B8770DFAD29344408081204086063D403B56293DD3934440ED0DBE3099063D40E82FF488D1934440D1798D5DA2063D406C425A63D09344400CC9C9C4AD063D40259694BBCF934440E4BA29E5B5063D404E29AF95D09344400B7E1B62BC063D40EEEC2B0FD29344404548DDCEBE063D40F37519FED3934440BB44F5D6C0063D40A5A487A1D5934440637E6E68CA063D40B1A371A8DF934440D0ED258DD1063D40D175E107E7934440E3A9471ADC063D4066101FD8F19344407C7C4276DE063D403524EEB1F4934440B5DE6FB4E3063D40A663CE33F69344409AB2D30FEA063D40884A2366F69344401AC1C6F5EF063D40419E5DBEF5934440D6011077F5063D4083C13577F493444019761893FE063D40024BAE62F1934440B98AC56F0A073D40E144F46BEB9344404C38F4160F073D403BC43F6CE993444027FA7C9411073D4012312592E89344402B4F20EC14073D40A7AE7C96E793444040F850A225073D400E10CCD1E3934440CA181F662F073D4021AF0793E293444095287B4B39073D4087A8C29FE193444048DC63E943073D4016359886E19344408DD5E6FF55073D405DE15D2EE2934440569A94826E073D40D9CEF753E393444090BB085394073D405B79C9FFE4934440944A7842AF073D40B49080D1E5934440A88B14CAC2073D408AC91B60E69344404D124BCADD073D408AC91B60E6934440E161DA37F7073D40785E2A36E693444059BF99982E083D407F4FAC53E593444063450DA661083D4056BC9179E493444099F4F75278083D40C72FBC92E4934440A053909F8D083D403D601E32E5934440E44C13B69F083D401399B9C0E5934440CEDDAE97A6083D402BC1E270E6934440209C4F1DAB083D4007B7B585E7934440AEF4DA6CAC083D405A1135D1E793444033C005D9B2083D40E2783E03EA934440DD611399B9083D40FF5D9F39EB9344406BD784B4C6083D4045D61A4AED93444019C748F608093D40FB592C45F2934440DBC4C9FD0E093D409C51F355F29344406090F46915093D407E384888F293444012DC48D922093D4066DCD440F39344400F0C207C28093D40183F8D7BF3934440555051F52B093D405A2E1B9DF39344404606B98B30093D400C91D3D7F39344402785798F33093D407D04FEF0F39344406DC9AA0837093D4000E31934F49344400C59DDEA39093D4006A051BAF493444088122D793C093D407DD0B359F59344405D177E703E093D40C47C7901F693444021E527D53E093D40FF7A8505F79344404D6551D845093D4029931ADA00944440"    
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