// app/components/mapview/MapCanvas.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline, useMap, useMapEvents } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import L, { DivIcon } from "leaflet";

import { MapDeviceLocation } from "./driver/mapview/data/gpsDataInfo";

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

function MapFocusFollower({
  focusPoint,
  focusZoom,
}: {
  focusPoint: [number, number] | null;
  focusZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusPoint) return;
    map.setView(focusPoint, focusZoom, { animate: true });
  }, [map, focusPoint, focusZoom]);

  return null;
}

function easeInOut(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function AnimatedVehicleMarker({
  location,
  isSelected,
  animationDurationMs,
  onClick,
  onAnimatedPositionChange,
}: {
  location: MapDeviceLocation;
  isSelected: boolean;
  animationDurationMs: number;
  onClick: (location: MapDeviceLocation) => void;
  onAnimatedPositionChange?: (point: [number, number]) => void;
}) {
  const [position, setPosition] = useState<[number, number]>([location.latitude, location.longitude]);
  const latestPositionRef = useRef<[number, number]>([location.latitude, location.longitude]);
  const animatedPositionChangeRef = useRef<typeof onAnimatedPositionChange>(onAnimatedPositionChange);

  useEffect(() => {
    latestPositionRef.current = position;
  }, [position]);

  useEffect(() => {
    animatedPositionChangeRef.current = onAnimatedPositionChange;
  }, [onAnimatedPositionChange]);

  useEffect(() => {
    const target: [number, number] = [location.latitude, location.longitude];
    const start = latestPositionRef.current;
    const latDiff = Math.abs(target[0] - start[0]);
    const lngDiff = Math.abs(target[1] - start[1]);

    if (latDiff < 0.000001 && lngDiff < 0.000001) {
      animatedPositionChangeRef.current?.(target);
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / animationDurationMs, 1);
      const eased = easeInOut(progress);
      const next: [number, number] = [
        start[0] + (target[0] - start[0]) * eased,
        start[1] + (target[1] - start[1]) * eased,
      ];

      latestPositionRef.current = next;
      setPosition(next);
      animatedPositionChangeRef.current?.(next);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [animationDurationMs, location.latitude, location.longitude]);

  return (
    <Marker
      position={position}
      icon={isSelected ? selectedVehicleIcon : pulsingIcon}
      eventHandlers={{
        click: () => onClick(location),
      }}
    />
  );
}

function SelectedVehicleFollower({
  selectedVehicleId,
  trackedPoint,
  followZoom,
}: {
  selectedVehicleId: string | null;
  trackedPoint: [number, number] | null;
  followZoom: number;
}) {
  const map = useMap();
  const previousSelectedRef = useRef<string | null>(null);
  const lastPanAtRef = useRef(0);

  useEffect(() => {
    if (!selectedVehicleId || !trackedPoint) {
      previousSelectedRef.current = selectedVehicleId;
      return;
    }

    if (previousSelectedRef.current !== selectedVehicleId) {
      map.flyTo(trackedPoint, followZoom, {
        animate: true,
        duration: 0.9,
      });
      previousSelectedRef.current = selectedVehicleId;
      lastPanAtRef.current = Date.now();
      return;
    }

    const now = Date.now();
    if (now - lastPanAtRef.current < 450) return;

    const center = map.getCenter();
    const distanceFromCenterMeters = center.distanceTo(L.latLng(trackedPoint[0], trackedPoint[1]));
    if (distanceFromCenterMeters < 8) return;

    map.panTo(trackedPoint, {
      animate: true,
      duration: 0.8,
      easeLinearity: 0.25,
      noMoveStart: true,
    });
    lastPanAtRef.current = now;
  }, [map, selectedVehicleId, trackedPoint, followZoom]);

  return null;
}

type MapCanvasProps = {
  deviceLocations: MapDeviceLocation[];
  selectedVehicleId: string | null;
  routePaths: Array<Array<[number, number]>>;
  destinationPoints: Array<[number, number]>;
  filteredStartPoint: [number, number] | null;
  filteredEndPoint: [number, number] | null;
  tileStyle: "satellite" | "light" | "colorful";
  routeMode: boolean;
  focusPoint?: [number, number] | null;
  focusZoom?: number;
  markerTransitionMs?: number;
  shouldFollowSelected?: boolean;
  selectedFollowZoom?: number;
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
  tileStyle,
  routeMode,
  focusPoint = null,
  focusZoom = 16,
  markerTransitionMs = 4200,
  shouldFollowSelected = true,
  selectedFollowZoom = 18,
  onMarkerClick,
  onClosePanel,
  onMapClick,
  onMapBackgroundClick,
}: MapCanvasProps) {
  const [selectedAnimatedPoint, setSelectedAnimatedPoint] = useState<{
    vehicleId: string;
    point: [number, number];
  } | null>(null);
  const routeColors = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"];
  const tileLayers = {
    colorful: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    light: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution:
        'Tiles &copy; <a href="https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  } as const;
  const activeTile = tileLayers[tileStyle];
  const selectedFallbackPoint: [number, number] | null = selectedVehicleId
    ? (() => {
        const selectedLocation =
          deviceLocations.find((item) => (item.vehicleId ?? item.deviceId) === selectedVehicleId) ?? null;
        return selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : null;
      })()
    : null;
  const trackedSelectedPoint =
    selectedVehicleId && selectedAnimatedPoint?.vehicleId === selectedVehicleId
      ? selectedAnimatedPoint.point
      : selectedFallbackPoint;
  const initialBoundsPoints: Array<[number, number]> = [
    ...deviceLocations.map(
      (location): [number, number] => [location.latitude, location.longitude]
    ),
    ...(filteredStartPoint ? [filteredStartPoint] : []),
    ...(filteredEndPoint ? [filteredEndPoint] : []),
  ];

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
      <MapInitialBounds points={initialBoundsPoints} />
      <MapFocusFollower focusPoint={focusPoint} focusZoom={focusZoom} />
      {shouldFollowSelected && (
        <SelectedVehicleFollower
          selectedVehicleId={selectedVehicleId}
          trackedPoint={trackedSelectedPoint}
          followZoom={selectedFollowZoom}
        />
      )}

      <ZoomControl position="bottomleft" />

      <TileLayer url={activeTile.url} attribution={activeTile.attribution} />

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
          <AnimatedVehicleMarker
            key={locationKey}
            location={location}
            isSelected={selectedVehicleId === locationKey}
            animationDurationMs={markerTransitionMs}
            onClick={onMarkerClick}
            onAnimatedPositionChange={
              selectedVehicleId === locationKey
                ? (point) => setSelectedAnimatedPoint({ vehicleId: locationKey, point })
                : undefined
            }
          />
        );
      })}
    </MapContainer>
  );
}
