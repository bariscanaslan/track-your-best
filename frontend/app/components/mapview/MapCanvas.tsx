// app/components/mapview/MapCanvas.tsx

"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { DivIcon } from "leaflet";

import { MapDeviceLocation } from "./data/gpsDataInfo";

const CENTER: [number, number] = [41.02496, 28.958999];

const pulsingIcon: DivIcon = L.divIcon({
  className: "pulsing-marker",
  iconSize: [28, 28],
  iconAnchor: [12, 12],
});

const selectedVehicleIcon: DivIcon = L.divIcon({
  className: "pulsing-marker is-selected",
  iconSize: [32, 32],
  iconAnchor: [14, 14],
});

const destinationIcon: DivIcon = L.divIcon({
  className: "route-destination-marker",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const filteredStartIcon: DivIcon = L.divIcon({
  className: "filtered-route-marker is-start",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const filteredEndIcon: DivIcon = L.divIcon({
  className: "filtered-route-marker is-end",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapClickCloser({
  onClose,
  routeMode,
  onMapClick,
  onMapBackgroundClick,
}: {
  onClose: () => void;
  routeMode: boolean;
  onMapClick: (point: [number, number]) => void;
  onMapBackgroundClick: () => void;
}) {
  useMapEvents({
    click: (event) => {
      if (routeMode) {
        onMapClick([event.latlng.lat, event.latlng.lng]);
        return;
      }
      onClose();
      onMapBackgroundClick();
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
  deviceLocations: MapDeviceLocation[];
  selectedVehicleId: string | null;
  routePaths: Array<Array<[number, number]>>;
  destinationPoints: Array<[number, number]>;
  filteredStartPoint: [number, number] | null;
  filteredEndPoint: [number, number] | null;
  routeMode: boolean;
  onMarkerClick: (location: MapDeviceLocation) => void;
  onClosePanel: () => void;
  onMapClick: (point: [number, number]) => void;
  onMapBackgroundClick: () => void;
};

export default function MapCanvas({
  deviceLocations,
  selectedVehicleId,
  routePaths,
  destinationPoints,
  filteredStartPoint,
  filteredEndPoint,
  routeMode,
  onMarkerClick,
  onClosePanel,
  onMapClick,
  onMapBackgroundClick,
}: MapCanvasProps) {
  const routeColors = ["#1b86ce", "#0ea5e9", "#22c55e", "#f97316", "#8b5cf6", "#ef4444"];

  return (
    <MapContainer
      center={CENTER}
      zoom={16}
      scrollWheelZoom={true}
      className="map-container"
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <MapClickCloser
        onClose={onClosePanel}
        routeMode={routeMode}
        onMapClick={onMapClick}
        onMapBackgroundClick={onMapBackgroundClick}
      />
      <MapInitialBounds
        points={[
          ...deviceLocations.map((location) => [location.latitude, location.longitude]),
          ...(filteredStartPoint ? [filteredStartPoint] : []),
          ...(filteredEndPoint ? [filteredEndPoint] : []),
        ]}
      />

      <ZoomControl position="bottomleft" />

      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

      {routePaths.map((path, index) => (
        <Polyline
          key={`route-${index}-${path.length}`}
          positions={path}
          pathOptions={{
            color: routeColors[index % routeColors.length],
            weight: 5,
            opacity: 0.95,
            dashArray: "6 14",
            lineCap: "round",
          }}
          className="route-line"
        />
      ))}

      {destinationPoints.map((point, index) => (
        <Marker key={`goal-${index}-${point[0]}-${point[1]}`} position={point} icon={destinationIcon} />
      ))}

      {filteredStartPoint && (
        <Marker
          key={`filtered-start-${filteredStartPoint[0]}-${filteredStartPoint[1]}`}
          position={filteredStartPoint}
          icon={filteredStartIcon}
        />
      )}

      {filteredEndPoint && (
        <Marker
          key={`filtered-end-${filteredEndPoint[0]}-${filteredEndPoint[1]}`}
          position={filteredEndPoint}
          icon={filteredEndIcon}
        />
      )}

      {deviceLocations.map((location) => {
        const locationKey = location.vehicleId ?? location.deviceId;
        return (
          <Marker
            key={locationKey}
            position={[location.latitude, location.longitude]}
            icon={selectedVehicleId === locationKey ? selectedVehicleIcon : pulsingIcon}
            eventHandlers={{
              click: () => onMarkerClick(location),
            }}
          />
        );
      })}
    </MapContainer>
  );
}
