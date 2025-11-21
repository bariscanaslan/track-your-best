"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { DivIcon } from "leaflet";

const CENTER: [number, number] = [41.02496400660838, 28.958999957452054];

const pulsingIcon: DivIcon = L.divIcon({
  className: "pulsing-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

type GpsLastResponse = {
  status: "success" | "error";
  data?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    device_id: string;
  };
};

const TEMP_IP = "172.16.15.197";

const GPS_ENDPOINT = `http://${TEMP_IP}:8000/gps/last`;

const TEMP_AUTH_HEADER = "Z3BzX2NsaWVudDpncHMxMjM0NTY="

const AUTH_HEADER = `Basic ${TEMP_AUTH_HEADER}`;

export default function MapView() {
  const [position, setPosition] = useState<[number, number]>(CENTER);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchGps = async () => {
      try {
        const res = await fetch(GPS_ENDPOINT, {
          method: "GET",
          headers: {
            accept: "application/json",
            Authorization: AUTH_HEADER,
          },
        });

        if (!res.ok) {
          console.error("GPS API error:", res.status, res.statusText);
          return;
        }

        const json: GpsLastResponse = await res.json();

        if (json.status === "success" && json.data && isMounted) {
          const { latitude, longitude, device_id, timestamp } = json.data;

          setPosition([latitude, longitude]);
          setDeviceId(device_id);
          setTimestamp(timestamp);
        }
      } catch (err) {
        console.error("GPS fetch failed:", err);
      }
    };

    fetchGps();

    const intervalId = setInterval(fetchGps, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="map-page">
      <MapContainer
        center={CENTER}
        zoom={16}
        scrollWheelZoom={true}
        className="map-container"
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

        <Marker position={position} icon={pulsingIcon}>
          <Popup>
            <div style={{ fontSize: "12px", lineHeight: 1.4 }}>
              <b>Canlı GPS</b>
              <br />
              {deviceId && (
                <>
                  <span>Device ID: {deviceId}</span>
                  <br />
                </>
              )}
              <span>
                Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
              </span>
              <br />
              {timestamp && <span>Zaman: {new Date(timestamp).toLocaleString()}</span>}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </main>
  );
}
