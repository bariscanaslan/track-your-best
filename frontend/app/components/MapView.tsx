// app/components/MapView.tsx

"use client";

import { useEffect, useRef, useState } from "react";

import MapCanvas from "./mapview/MapCanvas";
import MapFooter from "./mapview/MapFooter";
import VehicleInformationSidecard from "./mapview/VehicleInformationSidecard";
import TripsSidecard from "./mapview/TripsSidecard";
import StatisticsSidecard from "./mapview/StatisticsSidecard";
import FilterSidecard from "./mapview/FilterSidecard";
import { DeviceInfo } from "./mapview/data/deviceInfoData";
import { GpsRoutePoint, MapDeviceLocation } from "./mapview/data/gpsDataInfo";
import { VehicleInfo } from "./mapview/data/vehicleInfoData";
import { TripPlanPayload, TripSummary } from "./mapview/data/tripInfoData";
import { DriverInfo } from "./mapview/data/driverInfoData";
import { driversApi, devicesApi, gpsApi, tripsApi, vehiclesApi } from "../utils/api";

import "./MapView.css";

export default function MapView() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const API_URL = gpsApi.lastLocationByDeviceId(API_BASE);

  const [deviceLocations, setDeviceLocations] = useState<MapDeviceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapDeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"trips" | "statistics" | "vehicle" | "filter" | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [visibleTripRoutes, setVisibleTripRoutes] = useState<Array<Array<[number, number]>>>([]);
  const [filteredRoutePath, setFilteredRoutePath] = useState<Array<[number, number]>>([]);
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
  const [tripName, setTripName] = useState("");
  const [deviceInformation, setDeviceInformation] = useState<DeviceInfo | null>(null);
  const [vehicleInformation, setVehicleInformation] = useState<VehicleInfo | null>(null);
  const [driverInformation, setDriverInformation] = useState<DriverInfo | null>(null);
  const [informationError, setInformationError] = useState<string | null>(null);
  const [isLoadingInformation, setIsLoadingInformation] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(false);
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const selectedLocationRef = useRef<MapDeviceLocation | null>(null);
  const routeKey = (path: Array<[number, number]>) =>
    `${path.length}-${path[0]?.[0]}-${path[0]?.[1]}-${path[path.length - 1]?.[0]}-${path[path.length - 1]?.[1]}`;

  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  useEffect(() => {
    if (!pendingTrip) return;
    const nextName = tripName.trim() || null;
    if (pendingTrip.tripName === nextName) return;
    setPendingTrip((prev) => (prev ? { ...prev, tripName: nextName } : prev));
  }, [tripName, pendingTrip]);

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

        const data: MapDeviceLocation[] = await res.json();

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
          const selectionKey = currentSelection.vehicleId ?? currentSelection.deviceId;
          const updated = validLocations.find(
            (item) => (item.vehicleId ?? item.deviceId) === selectionKey
          );
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
    if (!selectedLocation?.vehicleId) {
      setRouteError("Select a device with a vehicle first.");
      return;
    }

    if (isRouting) return;

    setIsRouting(true);
    setRouteError(null);
    setHasApprovedRoute(false);

    const payload: TripPlanPayload = {
      vehicleId: selectedLocation.vehicleId,
      tripName: tripName.trim() || null,
      startLat: selectedLocation.latitude,
      startLng: selectedLocation.longitude,
      endLat: destination[0],
      endLng: destination[1],
    };

    try {
      setDestinationPoint(destination);
      setPendingTrip(payload);
      const res = await fetch(tripsApi.plan(API_BASE), {
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

  const fetchActiveTrip = async (vehicleId: string | null | undefined) => {
    if (!vehicleId) return;
    if (!API_BASE) return;
    setIsLoadingActiveTrip(true);
    setActiveTripError(null);
    try {
      const res = await fetch(tripsApi.activeByVehicle(vehicleId, API_BASE), {
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
    } catch {
      setActiveTripError("Active trip fetch failed.");
      setActiveTrip(null);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  const fetchPastTrips = async (vehicleId: string | null | undefined) => {
    if (!vehicleId) return;
    if (!API_BASE) return;
    setIsLoadingPastTrips(true);
    setPastTripsError(null);
    try {
      const res = await fetch(tripsApi.historyByVehicle(vehicleId, API_BASE), {
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

  const fetchVehicleAndDeviceInformation = async (location: MapDeviceLocation) => {
    if (!API_BASE) return;
    setIsLoadingInformation(true);
    setInformationError(null);
    try {
      const deviceRequest = fetch(devicesApi.information(location.deviceId, API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const vehicleRequest = location.vehicleId
        ? fetch(vehiclesApi.information(location.vehicleId, API_BASE), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          })
        : Promise.resolve(null);

      const [deviceRes, vehicleRes] = await Promise.all([deviceRequest, vehicleRequest]);

      if (!deviceRes || !deviceRes.ok) {
        throw new Error("Information fetch failed.");
      }

      if (vehicleRes && !vehicleRes.ok) {
        throw new Error("Information fetch failed.");
      }

      const [deviceData, vehicleData] = await Promise.all([
        deviceRes.json(),
        vehicleRes ? vehicleRes.json() : Promise.resolve(null),
      ]);

      setDeviceInformation(deviceData ?? null);
      setVehicleInformation(vehicleData ?? null);
    } catch {
      setInformationError("Vehicle/Device information fetch failed.");
      setDeviceInformation(null);
      setVehicleInformation(null);
    } finally {
      setIsLoadingInformation(false);
    }
  };

  const fetchDriverInformation = async (vehicleId: string | null | undefined) => {
    if (!API_BASE || !vehicleId) return;
    setIsLoadingDriver(true);
    setDriverError(null);
    try {
      const res = await fetch(driversApi.infoByVehicle(vehicleId, API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Driver information fetch failed.");
      }

      const data: DriverInfo | null = await res.json();
      setDriverInformation(data ?? null);
    } catch {
      setDriverError("Driver information fetch failed.");
      setDriverInformation(null);
    } finally {
      setIsLoadingDriver(false);
    }
  };

  const applyTripRouteToMap = (trip: TripSummary | null) => {
    if (!trip?.geometry || trip.geometry.length < 2) {
      setRouteError("Trip route geometry is not available.");
      return;
    }

    setVisibleTripRoutes((prev) => {
      const key = routeKey(trip.geometry!);
      const exists = prev.some((path) => routeKey(path) === key);
      return exists ? prev : [...prev, trip.geometry!];
    });
    setRouteMode(false);
    setRouteError(null);
  };

  const handleFilterRoute = async () => {
    if (!API_BASE) return;
    if (!selectedLocation?.vehicleId || !filterStart || !filterEnd) {
      setFilterError("Select a vehicle marker and date range to filter.");
      return;
    }
    setIsFiltering(true);
    setFilterError(null);
    try {
      const vehicleId = selectedLocation.vehicleId;
      const startIso = new Date(filterStart).toISOString();
      const endIso = new Date(filterEnd).toISOString();
      const res = await fetch(
        gpsApi.routeByVehicle(vehicleId, startIso, endIso, API_BASE),
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Filter route fetch failed.");
      }

      const data: GpsRoutePoint[] = await res.json();
      const path = Array.isArray(data)
        ? data
            .filter((point) => typeof point.latitude === "number" && typeof point.longitude === "number")
            .map((point) => [point.latitude, point.longitude] as [number, number])
        : [];
      setFilteredRoutePath(path);
    } catch {
      setFilterError("Filter route fetch failed.");
      setFilteredRoutePath([]);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleClearFilter = () => {
    setFilteredRoutePath([]);
    setFilterStart("");
    setFilterEnd("");
    setFilterError(null);
  };

  const handleCancelActiveTrip = async () => {
    if (!selectedLocation?.vehicleId) return;
    if (isLoadingActiveTrip) return;

    setIsLoadingActiveTrip(true);
    setActiveTripError(null);

    try {
      const res = await fetch(
        tripsApi.cancelByVehicle(selectedLocation.vehicleId, API_BASE),
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
      setVisibleTripRoutes([]);
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
    if (!tripName.trim()) {
      setRouteError("Trip name is required before approval.");
      return;
    }
    if (isApproving || hasApprovedRoute) return;

    setIsApproving(true);
    setRouteError(null);

    try {
      const res = await fetch(tripsApi.approve(API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pendingTrip),
      });

      if (!res.ok) {
        throw new Error("Route approval failed.");
      }

      setHasApprovedRoute(true);
      fetchActiveTrip(pendingTrip.vehicleId);
    } catch {
      setRouteError("Route approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleTogglePanel = (panel: "trips" | "statistics" | "vehicle" | "filter") => {
    if (selectedLocation && (panel === "vehicle" || panel === "trips")) {
      fetchActiveTrip(selectedLocation.vehicleId);
      fetchPastTrips(selectedLocation.vehicleId);
      if (panel === "vehicle") {
        fetchVehicleAndDeviceInformation(selectedLocation);
        fetchDriverInformation(selectedLocation.vehicleId);
      }
    }
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const clearAllVisibleRoutes = () => {
    setRoutePath([]);
    setVisibleTripRoutes([]);
    setDestinationPoint(null);
    setPendingTrip(null);
    setHasApprovedRoute(false);
    setRouteError(null);
    setFilteredRoutePath([]);
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setActivePanel((prev) => (prev === "vehicle" ? null : prev));
    setActiveTrip(null);
    setActiveTripError(null);
    setPastTrips([]);
    setPastTripsError(null);
    setIsLoadingActiveTrip(false);
    setIsLoadingPastTrips(false);
    setDeviceInformation(null);
    setVehicleInformation(null);
    setInformationError(null);
    setIsLoadingInformation(false);
    setDriverInformation(null);
    setDriverError(null);
    setIsLoadingDriver(false);
    setFilteredRoutePath([]);
    setFilterError(null);
  };

  const renderedRoutePaths = [
    ...visibleTripRoutes,
    ...(routePath.length > 1 ? [routePath] : []),
    ...(filteredRoutePath.length > 1 ? [filteredRoutePath] : []),
  ];

  const filteredStartPoint =
    filteredRoutePath.length > 1 ? filteredRoutePath[0] : null;
  const filteredEndPoint =
    filteredRoutePath.length > 1
      ? filteredRoutePath[filteredRoutePath.length - 1]
      : null;
  const renderedDestinationPoints = renderedRoutePaths
    .filter((path) => path.length > 1)
    .map((path) => path[path.length - 1])
    .filter((point, index, arr) => {
      const key = `${point[0]}-${point[1]}`;
      return arr.findIndex((p) => `${p[0]}-${p[1]}` === key) === index;
    });

  return (
    <main className="map-page" style={{ height: "100vh", width: "100%" }}>
      <MapCanvas
        deviceLocations={deviceLocations}
        selectedVehicleId={selectedLocation?.vehicleId ?? selectedLocation?.deviceId ?? null}
        routePaths={renderedRoutePaths}
        destinationPoints={renderedDestinationPoints}
        filteredStartPoint={filteredStartPoint}
        filteredEndPoint={filteredEndPoint}
        routeMode={routeMode}
        onMarkerClick={(location) => {
          setSelectedLocation(location);
          setActivePanel("vehicle");
          fetchActiveTrip(location.vehicleId);
          fetchPastTrips(location.vehicleId);
          fetchVehicleAndDeviceInformation(location);
          fetchDriverInformation(location.vehicleId);
        }}
        onClosePanel={() => setActivePanel(null)}
        onMapClick={handlePlanTrip}
        onMapBackgroundClick={clearAllVisibleRoutes}
      />

      <TripsSidecard
        isOpen={activePanel === "trips"}
        selectedVehicleId={selectedLocation?.vehicleId ?? null}
        isRouting={isRouting}
        isApproving={isApproving}
        isLoadingActiveTrip={isLoadingActiveTrip}
        isLoadingPastTrips={isLoadingPastTrips}
        routeMode={routeMode}
        hasRoute={renderedRoutePaths.length > 0}
        hasApprovedRoute={hasApprovedRoute}
        tripName={tripName}
        onTripNameChange={setTripName}
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
        onClearRoute={clearAllVisibleRoutes}
        onClose={() => setActivePanel(null)}
      />

      <StatisticsSidecard
        isOpen={activePanel === "statistics"}
        routePointCount={renderedRoutePaths.reduce((sum, path) => sum + path.length, 0)}
        hasApprovedRoute={hasApprovedRoute}
        activeTripStatus={activeTrip?.status ?? null}
        onClose={() => setActivePanel(null)}
      />

      <FilterSidecard
        isOpen={activePanel === "filter"}
        hasSelection={Boolean(selectedLocation?.deviceId)}
        selectedDeviceLabel={selectedLocation?.deviceName ?? selectedLocation?.deviceId ?? "-"}
        filterStart={filterStart}
        filterEnd={filterEnd}
        isFiltering={isFiltering}
        filterError={filterError}
        onFilterStartChange={setFilterStart}
        onFilterEndChange={setFilterEnd}
        onFilterRoute={handleFilterRoute}
        onClearFilter={handleClearFilter}
        onClose={() => setActivePanel(null)}
      />

      <VehicleInformationSidecard
        selectedLocation={selectedLocation}
        error={error}
        deviceInformation={deviceInformation}
        vehicleInformation={vehicleInformation}
        driverInformation={driverInformation}
        informationError={informationError}
        isLoadingInformation={isLoadingInformation}
        driverError={driverError}
        isLoadingDriver={isLoadingDriver}
        isOpen={activePanel === "vehicle"}
        onClose={() => setActivePanel(null)}
      />

      <MapFooter
        activePanel={activePanel}
        hasSelection={selectedLocation !== null}
        onTogglePanel={handleTogglePanel}
        onClearSelection={clearSelection}
      />

      {routeError && <div className="map-route-error">{routeError}</div>}
    </main>
  );
}
