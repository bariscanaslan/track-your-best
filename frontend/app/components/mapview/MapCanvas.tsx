// app/components/mapview/MapCanvas.tsx

"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { DivIcon } from "leaflet";

import { DeviceLocation } from "./types";

const CENTER: [number, number] = [41.02496, 28.958999];

const pulsingIcon: DivIcon = L.divIcon({
  className: "pulsing-marker",
  iconSize: [28, 28],
  iconAnchor: [12, 12],
});

const destinationIcon: DivIcon = L.divIcon({
  className: "route-destination-marker",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapClickCloser({
  onClose,
  routeMode,
  onMapClick,
}: {
  onClose: () => void;
  routeMode: boolean;
  onMapClick: (point: [number, number]) => void;
}) {
  useMapEvents({
    click: (event) => {
      onClose();
      if (routeMode) {
        onMapClick([event.latlng.lat, event.latlng.lng]);
      }
    },
  });
  return null;
}

function MapInitialBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    hasFit.current = true;
  }, [map, points]);

  return null;
}

type MapCanvasProps = {
  deviceLocations: DeviceLocation[];
  routePath: Array<[number, number]>;
  destinationPoint: [number, number] | null;
  routeMode: boolean;
  onMarkerClick: (location: DeviceLocation) => void;
  onClosePanel: () => void;
  onMapClick: (point: [number, number]) => void;
};

export default function MapCanvas({
  deviceLocations,
  routePath,
  destinationPoint,
  routeMode,
  onMarkerClick,
  onClosePanel,
  onMapClick,
}: MapCanvasProps) {
  return (
    <MapContainer
      center={CENTER}
      zoom={16}
      scrollWheelZoom={true}
      className="map-container"
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <MapClickCloser onClose={onClosePanel} routeMode={routeMode} onMapClick={onMapClick} />
      <MapInitialBounds
        points={deviceLocations.map((location) => [location.latitude, location.longitude])}
      />

      <ZoomControl position="bottomleft" />

      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

      {routePath.length > 1 && (
        <Polyline
          positions={routePath}
          pathOptions={{
            color: "#1b86ce",
            weight: 5,
            opacity: 0.95,
            dashArray: "6 14",
            lineCap: "round",
          }}
          className="route-line"
        />
      )}

      {destinationPoint && <Marker position={destinationPoint} icon={destinationIcon} />}

      {deviceLocations.map((location) => (
        <Marker
          key={location.vehicleId}
          position={[location.latitude, location.longitude]}
          icon={pulsingIcon}
          eventHandlers={{
            click: () => onMarkerClick(location),
          }}
        />
      ))}
    </MapContainer>
  );
}
