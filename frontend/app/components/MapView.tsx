// app/components/MapView.tsx

"use client";

import { useEffect, useRef, useState } from "react";

import MapCanvas from "./mapview/MapCanvas";
import MapFooter from "./mapview/MapFooter";
import VehicleInformationSidecard from "./mapview/VehicleInformationSidecard";
import TripsSidecard from "./mapview/TripsSidecard";
import StatisticsSidecard from "./mapview/StatisticsSidecard";
import HistorySidecard from "./mapview/HistorySidecard";
import { DeviceInfo } from "./mapview/data/deviceInfoData";
import { GpsRoutePoint, MapDeviceLocation } from "./mapview/data/gpsDataInfo";
import { VehicleInfo } from "./mapview/data/vehicleInfoData";
import { TripPlanPayload, TripSummary } from "./mapview/data/tripInfoData";
import { DriverInfo } from "./mapview/data/driverInfoData";
import { driversApi, devicesApi, geocodingApi, gpsApi, tripsApi, vehiclesApi } from "../utils/api";

import "./MapView.css";

export default function MapView() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const ORG_ID = "0310ed50-86f2-468c-901d-6b3fcb113914";
  const API_URL = `${gpsApi.lastLocationByDeviceId(API_BASE)}?organizationId=${ORG_ID}`;

  const [deviceLocations, setDeviceLocations] = useState<MapDeviceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapDeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"trips" | "statistics" | "vehicle" | "history" | null>(null);
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
  const [startAddressInput, setStartAddressInput] = useState("");
  const [endAddressInput, setEndAddressInput] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isResolvingStart, setIsResolvingStart] = useState(false);
  const [isResolvingEnd, setIsResolvingEnd] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
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
  const [mapStyle, setMapStyle] = useState<"satellite" | "light" | "colorful">("colorful");
  const selectedLocationRef = useRef<MapDeviceLocation | null>(null);
  const routeKey = (path: Array<[number, number]>) =>
    `${path.length}-${path[0]?.[0]}-${path[0]?.[1]}-${path[path.length - 1]?.[0]}-${path[path.length - 1]?.[1]}`;
  const mapStyleKey = "tyb.mapStyle";

  const resolveStoredStyle = (value: string | null) => {
    if (value === "satellite" || value === "light" || value === "colorful") {
      return value;
    }
    return "colorful";
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = resolveStoredStyle(window.localStorage.getItem(mapStyleKey));
    setMapStyle(stored);

    const handleStyleEvent = (event: Event) => {
      const next = resolveStoredStyle((event as CustomEvent).detail as string | null);
      setMapStyle(next);
      window.localStorage.setItem(mapStyleKey, next);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== mapStyleKey) return;
      setMapStyle(resolveStoredStyle(event.newValue));
    };

    window.addEventListener("tyb:map-style", handleStyleEvent as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("tyb:map-style", handleStyleEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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

  type GeocodeResult = { displayName: string; openAddress: string; latitude: number; longitude: number };

  useEffect(() => {
    if (!API_BASE) return;
    if (!selectedLocation?.latitude || !selectedLocation?.longitude) {
      setStartAddressInput("");
      return;
    }

    let isMounted = true;
    const resolveStartAddress = async () => {
      setIsResolvingStart(true);
      try {
        const res = await fetch(
          geocodingApi.reverse(selectedLocation.latitude, selectedLocation.longitude, API_BASE),
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );

        if (!res.ok) {
          throw new Error("Start address lookup failed.");
        }

        const data = (await res.json()) as GeocodeResult;
        const openAddress = data?.openAddress || data?.displayName || "";
        if (isMounted) {
          setStartAddressInput(openAddress);
        }
      } catch {
        if (isMounted) {
          setStartAddressInput("");
        }
      } finally {
        if (isMounted) {
          setIsResolvingStart(false);
        }
      }
    };

    resolveStartAddress();
    return () => {
      isMounted = false;
    };
  }, [API_BASE, selectedLocation?.latitude, selectedLocation?.longitude]);

  const geocodeAddress = async (query: string): Promise<GeocodeResult> => {
    const res = await fetch(geocodingApi.forward(query, API_BASE), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (res.status === 404) {
      throw new Error("Address not found.");
    }
    if (!res.ok) {
      throw new Error("Address lookup failed.");
    }

    const data = (await res.json()) as GeocodeResult;
    if (typeof data?.latitude !== "number" || typeof data?.longitude !== "number") {
      throw new Error("Address lookup failed.");
    }

    return data;
  };

  const planTrip = async (options: {
    start: [number, number];
    end: [number, number];
    startAddress?: string | null;
    endAddress?: string | null;
  }) => {
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
      startLat: options.start[0],
      startLng: options.start[1],
      endLat: options.end[0],
      endLng: options.end[1],
      startAddress: options.startAddress ?? null,
      endAddress: options.endAddress ?? null,
    };

    try {
      setDestinationPoint(options.end);
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

  const resolveEndAddress = async (destination: [number, number]) => {
    if (!API_BASE) return;
    setIsResolvingEnd(true);
    try {
      const res = await fetch(geocodingApi.reverse(destination[0], destination[1], API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as GeocodeResult;
      const openAddress = data?.openAddress || data?.displayName || "";
      if (openAddress) {
        setEndAddressInput(openAddress);
      }
    } catch {
      // Ignore reverse-geocode failures for manual map clicks.
    } finally {
      setIsResolvingEnd(false);
    }
  };

  const handlePlanTrip = async (destination: [number, number]) => {
    if (!selectedLocation?.vehicleId) {
      setRouteError("Select a device with a vehicle first.");
      return;
    }

    const startPoint: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
    resolveEndAddress(destination);
    await planTrip({ start: startPoint, end: destination });
  };

  const handlePlanTripByAddress = async () => {
    if (!selectedLocation?.vehicleId) {
      setRouteError("Select a device with a vehicle first.");
      return;
    }

    const endQuery = endAddressInput.trim();
    if (!endQuery) {
      setGeocodeError("Enter the destination address.");
      return;
    }

    if (isGeocoding || isRouting) return;

    setIsGeocoding(true);
    setGeocodeError(null);
    setRouteError(null);
    setHasApprovedRoute(false);

    try {
      const endResult = await geocodeAddress(endQuery);

      const startPoint: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
      const endPoint: [number, number] = [endResult.latitude, endResult.longitude];

      await planTrip({
        start: startPoint,
        end: endPoint,
        startAddress: startAddressInput || null,
        endAddress: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Address lookup failed.";
      setGeocodeError(message);
    } finally {
      setIsGeocoding(false);
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

  const handleTogglePanel = (panel: "trips" | "statistics" | "vehicle" | "history") => {
    if (selectedLocation && (panel === "vehicle" || panel === "trips" || panel === "history")) {
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
    setGeocodeError(null);
    setEndAddressInput("");
    setIsResolvingEnd(false);
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
    setStartAddressInput("");
    setEndAddressInput("");
    setGeocodeError(null);
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
        tileStyle={mapStyle}
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
        isGeocoding={isGeocoding}
        isResolvingStart={isResolvingStart}
        isResolvingEnd={isResolvingEnd}
        isLoadingActiveTrip={isLoadingActiveTrip}
        routeMode={routeMode}
        hasRoute={renderedRoutePaths.length > 0}
        hasApprovedRoute={hasApprovedRoute}
        tripName={tripName}
        onTripNameChange={setTripName}
        startAddressInput={startAddressInput}
        endAddressInput={endAddressInput}
        onStartAddressChange={setStartAddressInput}
        onEndAddressChange={setEndAddressInput}
        onPlanTripByAddress={handlePlanTripByAddress}
        geocodeError={geocodeError}
        activeTrip={activeTrip}
        activeTripError={activeTripError}
        onToggleRouteMode={() => setRouteMode((prev) => !prev)}
        onApproveRoute={handleApproveTrip}
        onShowActiveTripRoute={() => applyTripRouteToMap(activeTrip)}
        onCancelActiveTrip={handleCancelActiveTrip}
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

      <HistorySidecard
        isOpen={activePanel === "history"}
        selectedVehicleId={selectedLocation?.vehicleId ?? null}
        hasSelection={Boolean(selectedLocation?.deviceId)}
        selectedDeviceLabel={selectedLocation?.deviceName ?? selectedLocation?.deviceId ?? "-"}
        isLoadingPastTrips={isLoadingPastTrips}
        pastTrips={pastTrips}
        pastTripsError={pastTripsError}
        onShowPastTripRoute={(tripId) => {
          const trip = pastTrips.find((item) => item.id === tripId) ?? null;
          applyTripRouteToMap(trip);
        }}
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
