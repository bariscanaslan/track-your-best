// app/components/MapView.tsx

"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from "react-leaflet";
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

function MapClickCloser({ onClose }: { onClose: () => void }) {
  useMapEvents({
    click: () => onClose(),
  });
  return null;
}
function formatToGMT3(timestamp: string) {
  const dateUTC = new Date(timestamp);

  // UTC +3 offset
  const gmt3 = new Date(dateUTC.getTime() + 6 * 60 * 60 * 1000);

  const year = gmt3.getUTCFullYear();
  const month = String(gmt3.getUTCMonth() + 1).padStart(2, "0");
  const day = String(gmt3.getUTCDate()).padStart(2, "0");

  const hours = String(gmt3.getUTCHours()).padStart(2, "0");
  const minutes = String(gmt3.getUTCMinutes()).padStart(2, "0");
  const seconds = String(gmt3.getUTCSeconds()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} (GMT+3)`;
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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
        <MapCenterUpdater position={position} />
        <MapClickCloser onClose={() => setIsPanelOpen(false)} />

        <ZoomControl position="bottomleft" />

        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

        <Marker
          key={`${position[0]}-${position[1]}`}
          position={position}
          icon={pulsingIcon}
          eventHandlers={{
            click: () => setIsPanelOpen(true),
          }}
        >
        </Marker>
      </MapContainer>

      <aside
        className={`map-sidecard ${isPanelOpen ? "is-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-sidecard-header">
          <div className="map-sidecard-title">Vehicle Information</div>
          <button className="map-sidecard-close" onClick={() => setIsPanelOpen(false)}>
            Close
          </button>
        </div>

        {gpsData ? (
          <div className="map-sidecard-content">
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Device Name</span>
              <span className="map-sidecard-value">{gpsData.device_name}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Device ID</span>
              <span className="map-sidecard-value">{gpsData.device_id}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Latitude</span>
              <span className="map-sidecard-value">{gpsData.latitude.toFixed(5)}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Longitude</span>
              <span className="map-sidecard-value">{gpsData.longitude.toFixed(5)}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Last Record Time</span>
              <span className="map-sidecard-value">{formatToGMT3(gpsData.timestamp)}</span>
            </div>
          </div>
        ) : (
          <div className="map-sidecard-empty">Waiting for data...</div>
        )}
      </aside>
    </main>
  );
}
