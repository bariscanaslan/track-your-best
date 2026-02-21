// app/components/MapView.tsx

"use client";

import { useEffect, useRef, useState } from "react";

import MapCanvas from "./mapview/MapCanvas";
import MapSidecard from "./mapview/MapSidecard";
import MapFooter from "./mapview/MapFooter";
import RoutesSidecard from "./mapview/RoutesSidecard";
import StatisticsSidecard from "./mapview/StatisticsSidecard";
import { DeviceLocation } from "./mapview/types";

import "./MapView.css";

type TripPlanPayload = {
  vehicleId: string;
  driverId?: string | null;
  tripName?: string | null;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  plannedEndTime?: string | null;
  purpose?: string | null;
  notes?: string | null;
};

type TripSummary = {
  id: string;
  vehicleId?: string | null;
  driverId?: string | null;
  tripName?: string | null;
  status?: string | null;
  startTime: string;
  plannedEndTime?: string | null;
  endTime?: string | null;
  totalDistanceKm?: number | null;
  durationSeconds?: number | null;
  geometry?: Array<[number, number]> | null;
};

export default function MapView() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const API_URL = `${API_BASE}/api/gps-data/last`;

  const [deviceLocations, setDeviceLocations] = useState<DeviceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"routes" | "statistics" | "vehicle" | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [destinationPoint, setDestinationPoint] = useState<[number, number] | null>(null);
  const [pendingTrip, setPendingTrip] = useState<TripPlanPayload | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [hasApprovedRoute, setHasApprovedRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripSummary | null>(null);
  const [activeTripError, setActiveTripError] = useState<string | null>(null);
  const [isLoadingActiveTrip, setIsLoadingActiveTrip] = useState(false);
  const [pastTrips, setPastTrips] = useState<TripSummary[]>([]);
  const [pastTripsError, setPastTripsError] = useState<string | null>(null);
  const [isLoadingPastTrips, setIsLoadingPastTrips] = useState(false);
  const selectedLocationRef = useRef<DeviceLocation | null>(null);

  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;

    const fetchGps = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(API_URL, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) return;
        if (!res.ok) return;

        const data: DeviceLocation[] = await res.json();

        if (!isMounted || !Array.isArray(data)) return;

        const validLocations = data.filter((item) => {
          if (typeof item.latitude !== "number" || typeof item.longitude !== "number") {
            return false;
          }
          if (item.latitude === 0 && item.longitude === 0) {
            return false;
          }
          if (item.latitude < -90 || item.latitude > 90) {
            return false;
          }
          if (item.longitude < -180 || item.longitude > 180) {
            return false;
          }
          return true;
        });

        setDeviceLocations(validLocations);
        setError(null);

        const currentSelection = selectedLocationRef.current;
        if (currentSelection) {
          const updated = validLocations.find((item) => item.vehicleId === currentSelection.vehicleId);
          if (updated) {
            setSelectedLocation(updated);
          }
        }
      } catch {
        setError("Connection error");
      } finally {
        inFlight = false;
      }
    };

    fetchGps();
    const interval = setInterval(fetchGps, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [API_URL]);

  const handlePlanTrip = async (destination: [number, number]) => {
    if (!selectedLocation) {
      setRouteError("Select a device first.");
      return;
    }

    if (isRouting) return;

    setIsRouting(true);
    setRouteError(null);
    setHasApprovedRoute(false);

    const payload: TripPlanPayload = {
      vehicleId: selectedLocation.vehicleId,
      startLat: selectedLocation.latitude,
      startLng: selectedLocation.longitude,
      endLat: destination[0],
      endLng: destination[1],
    };

    try {
      setDestinationPoint(destination);
      setPendingTrip(payload);
      const res = await fetch(`${API_BASE}/api/trips/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Route planning failed.");
      }

      const data: {
        geometry: Array<[number, number]>;
      } = await res.json();

      if (Array.isArray(data.geometry)) {
        setRoutePath(data.geometry);
      }

      setRouteMode(false);
    } catch {
      setRouteError("Route planning failed.");
    } finally {
      setIsRouting(false);
    }
  };

  const fetchActiveTrip = async (vehicleId: string) => {
    if (!API_BASE) return;
    setIsLoadingActiveTrip(true);
    setActiveTripError(null);
    try {
      const res = await fetch(`${API_BASE}/api/trips/active/vehicle/${vehicleId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Active trip fetch failed.");
      }

      const data: TripSummary | null = await res.json();
      setActiveTrip(data ?? null);
      setHasApprovedRoute(Boolean(data));
      if (data?.geometry && data.geometry.length > 1) {
        setRoutePath(data.geometry);
        setDestinationPoint(data.geometry[data.geometry.length - 1]);
      }
    } catch {
      setActiveTripError("Active trip fetch failed.");
      setActiveTrip(null);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  const fetchPastTrips = async (vehicleId: string) => {
    if (!API_BASE) return;
    setIsLoadingPastTrips(true);
    setPastTripsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/trips/history/vehicle/${vehicleId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Past routes fetch failed.");
      }

      const data: TripSummary[] = await res.json();
      setPastTrips(Array.isArray(data) ? data : []);
    } catch {
      setPastTripsError("Past routes fetch failed.");
      setPastTrips([]);
    } finally {
      setIsLoadingPastTrips(false);
    }
  };

  const applyTripRouteToMap = (trip: TripSummary | null) => {
    if (!trip?.geometry || trip.geometry.length < 2) {
      setRouteError("Trip route geometry is not available.");
      return;
    }

    setRoutePath(trip.geometry);
    setDestinationPoint(trip.geometry[trip.geometry.length - 1]);
    setRouteMode(false);
    setRouteError(null);
  };

  const handleCancelActiveTrip = async () => {
    if (!selectedLocation) return;
    if (isLoadingActiveTrip) return;

    setIsLoadingActiveTrip(true);
    setActiveTripError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/trips/cancel/vehicle/${selectedLocation.vehicleId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Route cancel failed.");
      }
      await res.json();
      setActiveTrip(null);
      setHasApprovedRoute(false);
      setRoutePath([]);
      setDestinationPoint(null);
      fetchPastTrips(selectedLocation.vehicleId);
    } catch {
      setActiveTripError("Route cancel failed.");
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  const handleApproveTrip = async () => {
    if (!pendingTrip || routePath.length === 0) {
      setRouteError("Plan a route before approving.");
      return;
    }
    if (isApproving || hasApprovedRoute) return;

    setIsApproving(true);
    setRouteError(null);

    try {
      const res = await fetch(`${API_BASE}/api/trips/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pendingTrip),
      });

      if (!res.ok) {
        throw new Error("Route approval failed.");
      }

      setHasApprovedRoute(true);
    } catch {
      setRouteError("Route approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleTogglePanel = (panel: "routes" | "statistics" | "vehicle") => {
    if (selectedLocation && (panel === "vehicle" || panel === "routes")) {
      fetchActiveTrip(selectedLocation.vehicleId);
      fetchPastTrips(selectedLocation.vehicleId);
    }
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <main className="map-page" style={{ height: "100vh", width: "100%" }}>
      <MapCanvas
        deviceLocations={deviceLocations}
        routePath={routePath}
        destinationPoint={destinationPoint}
        routeMode={routeMode}
        onMarkerClick={(location) => {
          setSelectedLocation(location);
          setActivePanel("vehicle");
          fetchActiveTrip(location.vehicleId);
          fetchPastTrips(location.vehicleId);
        }}
        onClosePanel={() => setActivePanel(null)}
        onMapClick={handlePlanTrip}
      />

      <RoutesSidecard
        isOpen={activePanel === "routes"}
        selectedVehicleId={selectedLocation?.vehicleId ?? null}
        isRouting={isRouting}
        isApproving={isApproving}
        isLoadingActiveTrip={isLoadingActiveTrip}
        isLoadingPastTrips={isLoadingPastTrips}
        routeMode={routeMode}
        hasRoute={routePath.length > 1}
        hasApprovedRoute={hasApprovedRoute}
        activeTrip={activeTrip}
        activeTripError={activeTripError}
        pastTrips={pastTrips}
        pastTripsError={pastTripsError}
        onToggleRouteMode={() => setRouteMode((prev) => !prev)}
        onApproveRoute={handleApproveTrip}
        onShowActiveTripRoute={() => applyTripRouteToMap(activeTrip)}
        onCancelActiveTrip={handleCancelActiveTrip}
        onShowPastTripRoute={(tripId) => {
          const trip = pastTrips.find((item) => item.id === tripId) ?? null;
          applyTripRouteToMap(trip);
        }}
        onClearRoute={() => {
          setRoutePath([]);
          setDestinationPoint(null);
          setPendingTrip(null);
          setHasApprovedRoute(false);
          setRouteError(null);
        }}
        onClose={() => setActivePanel(null)}
      />

      <StatisticsSidecard
        isOpen={activePanel === "statistics"}
        routePointCount={routePath.length}
        hasApprovedRoute={hasApprovedRoute}
        activeTripStatus={activeTrip?.status ?? null}
        onClose={() => setActivePanel(null)}
      />

      <MapSidecard
        selectedLocation={selectedLocation}
        error={error}
        isOpen={activePanel === "vehicle"}
        onClose={() => setActivePanel(null)}
      />

      <MapFooter
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
      />

      {routeError && <div className="map-route-error">{routeError}</div>}
    </main>
  );
}
