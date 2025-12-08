// app/components/MapView.tsx

"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { DivIcon } from "leaflet";

import './MapView.css';

const CENTER: [number, number] = [41.02496, 28.958999];

const pulsingIcon: DivIcon = L.divIcon({
  className: "pulsing-marker",
  iconSize: [28, 28],
  iconAnchor: [12, 12],
});

function MapCenterUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  map.setView(position, map.getZoom());
  return null;
}

type GPSData = {
  latitude: number;
  longitude: number;
  timestamp: string;
  device_id: string;
  device_name: string;
  id?: number;
};

export default function MapView() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const DEVICE_NAME = process.env.NEXT_PUBLIC_DEFAULT_DEVICE ?? "unknown";
  const API_URL = `${API_BASE}/gps/last?device_name=${DEVICE_NAME}`;

  const [position, setPosition] = useState<[number, number]>(CENTER);
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchGps = async () => {
      try {
        const res = await fetch(API_URL, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) return;

        if (!res.ok) return;

        const data: GPSData = await res.json();

        if (isMounted && data?.latitude && data?.longitude) {
          const newPos: [number, number] = [data.latitude, data.longitude];
          setPosition(newPos);
          setGpsData(data);
          setError(null);
        }
      } catch (err) {
        setError("Bağlantı hatası");
      }
    };

    fetchGps();
    const interval = setInterval(fetchGps, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [API_URL]);

  return (
    <main className="map-page" style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={true}
        className="map-container"
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Map center updater */}
        <MapCenterUpdater position={position} />

        <ZoomControl position="bottomleft" />

        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

        <Marker key={`${position[0]}-${position[1]}`} position={position} icon={pulsingIcon}>
          <Popup>
            <div className="popup-container">

              {gpsData ? (
                <>
                  <div className="popup-row">
                    <span className="popup-label">Device ID: </span>
                    <span className="popup-value">{" " + gpsData.device_id}</span>
                  </div>

                  <div className="popup-row">
                    <span className="popup-label">Device Name: </span>
                    <span className="popup-value">{" " + gpsData.device_name}</span>
                  </div>

                  <div className="popup-row">
                    <span className="popup-label">Latitude: </span>
                    <span className="popup-value">{" " + gpsData.latitude.toFixed(6)}</span>
                  </div>

                  <div className="popup-row">
                    <span className="popup-label">Longtitude: </span>
                    <span className="popup-value">{" " + gpsData.longitude.toFixed(6)}</span>
                  </div>

                  <div className="popup-row">
                    <span className="popup-label">Last Record Time: </span>
                  </div>
                  <div className="popup-time">
                    {new Date(gpsData.timestamp).toLocaleString("tr-TR")}
                  </div>
                </>
              ) : (
                <span className="popup-loading">Waiting for data...</span>
              )}
            </div>
          </Popup>

        </Marker>
      </MapContainer>
    </main>
  );
}
