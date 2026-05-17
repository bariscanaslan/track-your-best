// app/components/fleet-manager/mapview/FleetManagerMapView.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";

import FleetManagerMapFooter from "./FleetManagerMapFooter";
import MapCanvas from "../../MapCanvas";
import VehicleInformationSidecard from "../mapview/sidecards/VehicleInformationSidecard";
import TripsSidecard from "../mapview/sidecards/TripsSidecard";
import HistorySidecard from "../mapview/sidecards/HistorySidecard";

import { DeviceInfo } from "../mapview/data/deviceInfoData";
import { GpsRoutePoint, MapDeviceLocation } from "../mapview/data/gpsDataInfo";
import { VehicleInfo } from "../mapview/data/vehicleInfoData";
import { TripPlanPayload, TripSummary } from "../mapview/data/tripInfoData";
import { DriverInfo } from "../mapview/data/driverInfoData";
import { driversApi, devicesApi, driverScoresApi, etaApi, geocodingApi, gpsApi, tripsApi, vehiclesApi } from "../../../utils/api.js";
import { EtaPrediction } from "./data/tripInfoData";

import "../../../components/MapView.css";

// Single discriminated union replaces the previous four separate route-path states.
// Only one route is ever active at a time; setting a new kind automatically discards the old one.
type DisplayedRoute =
  | { kind: "active-trip"; path: [number, number][] }
  | { kind: "past-trip";   path: [number, number][] }
  | { kind: "planned";     path: [number, number][] }
  | { kind: "filtered";    path: [number, number][]; startPt: [number, number]; endPt: [number, number] }
  | null;

export default function FleetManagerMapView() {
  const ACTIVE_TRIP_REFRESH_MS = 5000;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";
  const API_URL = `${gpsApi.lastLocationByDeviceId(API_BASE)}?organizationId=${orgId}`;

  const [deviceLocations, setDeviceLocations] = useState<MapDeviceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapDeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"trips" | "vehicle" | "history" | null>(null);
  const [routeMode, setRouteMode] = useState(false);

  // --- Single route state ---
  const [displayedRoute, setDisplayedRoute] = useState<DisplayedRoute>(null);

  const [pendingTrip, setPendingTrip] = useState<TripPlanPayload | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [hasApprovedRoute, setHasApprovedRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [activeTrip, setActiveTrip] = useState<TripSummary | null>(null);
  const [activeTripError, setActiveTripError] = useState<string | null>(null);
  const [isLoadingActiveTrip, setIsLoadingActiveTrip] = useState(false);
  const [eta, setEta] = useState<EtaPrediction | null>(null);
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
  const [driverScore, setDriverScore] = useState<number | null>(null);

  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  const [mapStyle, setMapStyle] = useState<"satellite" | "light" | "colorful">("colorful");

  const selectedLocationRef = useRef<MapDeviceLocation | null>(null);
  // Ref (not state) — toggling it must not trigger re-renders; it only gates the activeTrip effect.
  const pinToActiveTripRef = useRef(false);

  // ── Error helpers ──────────────────────────────────────────────────────────
  type FetchErrorCode = "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" | "SERVER_ERROR" | "UNKNOWN";
  interface FetchError { code: FetchErrorCode; message: string; }

  const resolveHttpError = (status: number, context: string): FetchError => {
    switch (status) {
      case 401: return { code: "UNAUTHORIZED", message: `${context}: Session expired, please log in again.` };
      case 403: return { code: "FORBIDDEN",    message: `${context}: You do not have permission to access this resource.` };
      case 404: return { code: "NOT_FOUND",    message: `${context}: Record not found.` };
      case 500: case 502: case 503:
        return { code: "SERVER_ERROR", message: `${context}: Server error, please try again later.` };
      default:  return { code: "UNKNOWN",      message: `${context}: An unexpected error occurred (${status}).` };
    }
  };

  // ── Map style ──────────────────────────────────────────────────────────────
  const mapStyleKey = "tyb.mapStyle";
  const resolveStoredStyle = (value: string | null) => {
    if (value === "satellite" || value === "light" || value === "colorful") return value;
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

  // ── Sync selectedLocation ref ──────────────────────────────────────────────
  useEffect(() => {
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation]);

  // ── Trip name → pendingTrip sync ───────────────────────────────────────────
  useEffect(() => {
    if (!pendingTrip) return;
    const nextName = tripName.trim() || null;
    if (pendingTrip.tripName === nextName) return;
    setPendingTrip((prev) => (prev ? { ...prev, tripName: nextName } : prev));
  }, [tripName, pendingTrip]);

  // ── GPS polling ────────────────────────────────────────────────────────────
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
        if (res.status === 401) { setError("Session expired, please log in again."); return; }
        if (res.status === 403) { setError("You do not have permission to access GPS data."); return; }
        if (!res.ok) { const { message } = resolveHttpError(res.status, "GPS"); setError(message); return; }

        const data: MapDeviceLocation[] = await res.json();
        if (!isMounted || !Array.isArray(data)) return;

        const validLocations = data.filter((item) => {
          if (typeof item.latitude !== "number" || typeof item.longitude !== "number") return false;
          if (item.latitude === 0 && item.longitude === 0) return false;
          if (item.latitude < -90  || item.latitude > 90)  return false;
          if (item.longitude < -180 || item.longitude > 180) return false;
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
          if (updated) setSelectedLocation(updated);
        }
      } catch {
        setError("Connection error: Unable to reach the server.");
      } finally {
        inFlight = false;
      }
    };

    fetchGps();
    const interval = setInterval(fetchGps, 5000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [API_URL]);

  // ── Geocoding ──────────────────────────────────────────────────────────────
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
          { method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include" }
        );
        if (!res.ok) throw new Error("Start address lookup failed.");
        const data = (await res.json()) as GeocodeResult;
        if (isMounted) setStartAddressInput(data?.openAddress || data?.displayName || "");
      } catch {
        if (isMounted) setStartAddressInput("");
      } finally {
        if (isMounted) setIsResolvingStart(false);
      }
    };
    resolveStartAddress();
    return () => { isMounted = false; };
  }, [API_BASE, selectedLocation?.latitude, selectedLocation?.longitude]);

  const geocodeAddress = async (query: string): Promise<GeocodeResult> => {
    const res = await fetch(geocodingApi.forward(query, API_BASE), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (res.status === 404) throw new Error("Address not found.");
    if (!res.ok) throw new Error("Address lookup failed.");
    const data = (await res.json()) as GeocodeResult;
    if (typeof data?.latitude !== "number" || typeof data?.longitude !== "number")
      throw new Error("Address lookup failed.");
    return data;
  };

  // ── Trip planning ──────────────────────────────────────────────────────────
  const planTrip = async (options: {
    start: [number, number];
    end: [number, number];
    startAddress?: string | null;
    endAddress?: string | null;
  }) => {
    if (!selectedLocation?.vehicleId) { setRouteError("Select a device with a vehicle first."); return; }
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
      setPendingTrip(payload);
      const res = await fetch(tripsApi.plan(API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Route planning failed.");
      const data: { geometry: Array<[number, number]> } = await res.json();
      if (Array.isArray(data.geometry)) {
        pinToActiveTripRef.current = false;
        setDisplayedRoute({ kind: "planned", path: data.geometry });
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
      if (openAddress) setEndAddressInput(openAddress);
    } catch {
      // Ignore reverse-geocode failures for manual map clicks.
    } finally {
      setIsResolvingEnd(false);
    }
  };

  const handlePlanTrip = async (destination: [number, number]) => {
    if (!selectedLocation?.vehicleId) { setRouteError("Select a device with a vehicle first."); return; }
    const startPoint: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
    resolveEndAddress(destination);
    await planTrip({ start: startPoint, end: destination });
  };

  const handlePlanTripByAddress = async () => {
    if (!selectedLocation?.vehicleId) { setRouteError("Select a device with a vehicle first."); return; }
    const endQuery = endAddressInput.trim();
    if (!endQuery) { setGeocodeError("Enter the destination address."); return; }
    if (isGeocoding || isRouting) return;

    setIsGeocoding(true);
    setGeocodeError(null);
    setRouteError(null);
    setHasApprovedRoute(false);
    try {
      const endResult = await geocodeAddress(endQuery);
      const startPoint: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
      const endPoint: [number, number] = [endResult.latitude, endResult.longitude];
      await planTrip({ start: startPoint, end: endPoint, startAddress: startAddressInput || null, endAddress: null });
    } catch (err) {
      setGeocodeError(err instanceof Error ? err.message : "Address lookup failed.");
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Active trip ────────────────────────────────────────────────────────────
  const fetchActiveTrip = async (vehicleId: string | null | undefined) => {
    if (!vehicleId || !API_BASE) return;
    setIsLoadingActiveTrip(true);
    setActiveTripError(null);
    try {
      const res = await fetch(tripsApi.activeByVehicle(vehicleId, API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 404) {
        setActiveTrip(null);
        setHasApprovedRoute(false);
        if (pinToActiveTripRef.current) {
          pinToActiveTripRef.current = false;
          setDisplayedRoute(null);
        }
        return;
      }
      if (!res.ok) {
        const { message } = resolveHttpError(res.status, "Active trip");
        setActiveTripError(message);
        return;
      }
      const data: TripSummary | null = await res.json();
      if (data === null) {
        setActiveTrip(null);
        setHasApprovedRoute(false);
        if (pinToActiveTripRef.current) {
          pinToActiveTripRef.current = false;
          setDisplayedRoute(null);
        }
        return;
      }
      setActiveTrip(data);
      setHasApprovedRoute(true);
    } catch {
      setActiveTripError("Connection error: Unable to retrieve active trip.");
      setActiveTrip(null);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  // Keeps the "active-trip" display in sync as polling updates activeTrip.
  // The ref gate means past-trip / planned / filtered routes are never touched by this effect.
  useEffect(() => {
    if (!pinToActiveTripRef.current) return;
    if (!activeTrip?.geometry || activeTrip.geometry.length < 2) {
      setDisplayedRoute(null);
      return;
    }
    setDisplayedRoute({
      kind: "active-trip",
      path: activeTrip.geometry.map((point) => [point[0], point[1]] as [number, number]),
    });
  }, [activeTrip]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ETA ────────────────────────────────────────────────────────────────────
  const fetchEta = async (tripId: string) => {
    if (!API_BASE) return;
    try {
      const res = await fetch(etaApi.byTrip(tripId, API_BASE), { credentials: "include" });
      if (res.ok) setEta(await res.json());
      else setEta(null);
    } catch {
      setEta(null);
    }
  };

  useEffect(() => {
    if (!activeTrip?.id) { setEta(null); return; }
    fetchEta(activeTrip.id);
    const interval = setInterval(() => fetchEta(activeTrip.id), ACTIVE_TRIP_REFRESH_MS);
    return () => clearInterval(interval);
  }, [activeTrip?.id]);

  // ── Active trip polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLocation?.vehicleId || !API_BASE) return;
    fetchActiveTrip(selectedLocation.vehicleId);
    const interval = setInterval(() => {
      fetchActiveTrip(selectedLocation.vehicleId);
    }, ACTIVE_TRIP_REFRESH_MS);
    return () => clearInterval(interval);
  }, [API_BASE, selectedLocation?.vehicleId]);

  // ── Past trips ─────────────────────────────────────────────────────────────
  const fetchPastTrips = async (vehicleId: string | null | undefined) => {
    if (!vehicleId || !API_BASE) return;
    setIsLoadingPastTrips(true);
    setPastTripsError(null);
    try {
      const res = await fetch(tripsApi.historyByVehicle(vehicleId, API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 404) { setPastTrips([]); return; }
      if (!res.ok) {
        const { message } = resolveHttpError(res.status, "Past trips");
        setPastTripsError(message);
        return;
      }
      const data: TripSummary[] = await res.json();
      setPastTrips(Array.isArray(data) ? data : []);
    } catch {
      setPastTripsError("Connection error: Unable to retrieve past trips.");
      setPastTrips([]);
    } finally {
      setIsLoadingPastTrips(false);
    }
  };

  // ── Vehicle / device / driver info ─────────────────────────────────────────
  const fetchVehicleAndDeviceInformation = async (location: MapDeviceLocation) => {
    if (!API_BASE) return;
    setIsLoadingInformation(true);
    setInformationError(null);
    try {
      const deviceRequest = fetch(devicesApi.information(location.deviceId, API_BASE), {
        method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      const vehicleRequest = location.vehicleId
        ? fetch(vehiclesApi.information(location.vehicleId, API_BASE), {
            method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include",
          })
        : Promise.resolve(null);

      const [deviceRes, vehicleRes] = await Promise.all([deviceRequest, vehicleRequest]);

      if (deviceRes.status === 404) { setInformationError("Device not found."); return; }
      if (!deviceRes.ok) { const { message } = resolveHttpError(deviceRes.status, "Device information"); setInformationError(message); return; }

      if (vehicleRes) {
        if (vehicleRes.status === 404) {
          setDeviceInformation((await deviceRes.json()) ?? null);
          setVehicleInformation(null);
          return;
        }
        if (!vehicleRes.ok) { const { message } = resolveHttpError(vehicleRes.status, "Vehicle information"); setInformationError(message); return; }
      }

      const [deviceData, vehicleData] = await Promise.all([
        deviceRes.json(),
        vehicleRes ? vehicleRes.json() : Promise.resolve(null),
      ]);
      setDeviceInformation(deviceData ?? null);
      setVehicleInformation(vehicleData ?? null);
    } catch {
      setInformationError("Connection error: Unable to retrieve vehicle/device information.");
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
    setDriverScore(null);
    try {
      const res = await fetch(driversApi.infoByVehicle(vehicleId, API_BASE), {
        method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (res.status === 404) { setDriverInformation(null); return; }
      if (!res.ok) { const { message } = resolveHttpError(res.status, "Driver information"); setDriverError(message); return; }
      const data: DriverInfo | null = await res.json();
      setDriverInformation(data ?? null);
      if (data?.driverId) {
        try {
          const scoreRes = await fetch(driverScoresApi.byDriver(data.driverId, API_BASE), {
            method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include",
          });
          if (scoreRes.ok) {
            const scoreData = await scoreRes.json();
            setDriverScore(scoreData?.averageOverallScore ?? null);
          }
        } catch {
          // Score fetch failure is non-critical — silently ignore
        }
      }
    } catch {
      setDriverError("Connection error: Unable to retrieve driver information.");
      setDriverInformation(null);
    } finally {
      setIsLoadingDriver(false);
    }
  };

  // ── Route helpers ──────────────────────────────────────────────────────────
  const applyTripRouteToMap = (trip: TripSummary | null, pinToActiveTrip = false) => {
    if (!trip?.geometry || trip.geometry.length < 2) {
      setRouteError("Trip route geometry is not available.");
      return;
    }
    const path = trip.geometry.map((point) => [point[0], point[1]] as [number, number]);
    pinToActiveTripRef.current = pinToActiveTrip;
    setDisplayedRoute(pinToActiveTrip ? { kind: "active-trip", path } : { kind: "past-trip", path });
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
      const res = await fetch(gpsApi.routeByVehicle(vehicleId, startIso, endIso, API_BASE), {
        method: "GET", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (!res.ok) throw new Error("Filter route fetch failed.");
      const data: GpsRoutePoint[] = await res.json();
      const path = Array.isArray(data)
        ? data
            .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
            .map((p) => [p.latitude, p.longitude] as [number, number])
        : [];
      if (path.length > 1) {
        pinToActiveTripRef.current = false;
        setDisplayedRoute({ kind: "filtered", path, startPt: path[0], endPt: path[path.length - 1] });
      }
    } catch {
      setFilterError("Filter route fetch failed.");
    } finally {
      setIsFiltering(false);
    }
  };

  const handleClearFilter = () => {
    if (displayedRoute?.kind === "filtered") setDisplayedRoute(null);
    setFilterStart("");
    setFilterEnd("");
    setFilterError(null);
  };

  const handleCancelActiveTrip = async () => {
    if (!selectedLocation?.vehicleId || isLoadingActiveTrip) return;
    setIsLoadingActiveTrip(true);
    setActiveTripError(null);
    try {
      const res = await fetch(tripsApi.cancelByVehicle(selectedLocation.vehicleId, API_BASE), {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (!res.ok) throw new Error("Route cancel failed.");
      await res.json();
      setActiveTrip(null);
      setHasApprovedRoute(false);
      pinToActiveTripRef.current = false;
      setDisplayedRoute(null);
      setPendingTrip(null);
      fetchPastTrips(selectedLocation.vehicleId);
    } catch {
      setActiveTripError("Route cancel failed.");
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  const handleApproveTrip = async () => {
    if (!pendingTrip || displayedRoute?.kind !== "planned" || displayedRoute.path.length < 2) {
      setRouteError("Plan a route before approving.");
      return;
    }
    if (!tripName.trim()) { setRouteError("Trip name is required before approval."); return; }
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
      if (!res.ok) throw new Error("Route approval failed.");
      setHasApprovedRoute(true);
      pinToActiveTripRef.current = true;
      fetchActiveTrip(pendingTrip.vehicleId);
    } catch {
      setRouteError("Route approval failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleTogglePanel = (panel: "trips" | "vehicle" | "history") => {
    if (selectedLocation) {
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
    pinToActiveTripRef.current = false;
    setDisplayedRoute(null);
    setRouteMode(false);
    setPendingTrip(null);
    setHasApprovedRoute(false);
    setRouteError(null);
    setGeocodeError(null);
    setEndAddressInput("");
    setIsResolvingEnd(false);
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setActivePanel((prev) => (prev === "vehicle" ? null : prev));
    setActiveTrip(null);
    setActiveTripError(null);
    pinToActiveTripRef.current = false;
    setDisplayedRoute(null);
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
    setDriverScore(null);
    setFilterError(null);
    setStartAddressInput("");
    setEndAddressInput("");
    setGeocodeError(null);
  };

  // ── Derived render data (memoised) ─────────────────────────────────────────
  // GPS polling fires setDeviceLocations every 5 s. Without useMemo these would
  // rebuild and hand new array references to MapCanvas on every GPS tick, causing
  // all Polylines to re-diff even when no route changed.
  const renderedRoutePaths = useMemo<Array<[number, number][]>>(() => {
    if (!displayedRoute || displayedRoute.path.length < 2) return [];
    return [displayedRoute.path];
  }, [displayedRoute]);

  const filteredStartPoint = displayedRoute?.kind === "filtered" ? displayedRoute.startPt : null;
  const filteredEndPoint   = displayedRoute?.kind === "filtered" ? displayedRoute.endPt   : null;
  const routeStartPoint: [number, number] | null =
    displayedRoute?.kind === "past-trip" && displayedRoute.path.length > 0
      ? displayedRoute.path[0]
      : null;

  const renderedDestinationPoints = useMemo<Array<[number, number]>>(() => {
    if (!displayedRoute || displayedRoute.path.length < 2) return [];
    return [displayedRoute.path[displayedRoute.path.length - 1]];
  }, [displayedRoute]);

  return (
    <main className="map-page" style={{ height: "100vh", width: "100%" }}>

      <MapCanvas
        deviceLocations={deviceLocations}
        selectedVehicleId={selectedLocation?.vehicleId ?? selectedLocation?.deviceId ?? null}
        routePaths={renderedRoutePaths}
        routeDisplayKey={displayedRoute?.kind}
        destinationPoints={renderedDestinationPoints}
        filteredStartPoint={filteredStartPoint}
        filteredEndPoint={filteredEndPoint}
        routeStartPoint={routeStartPoint}
        tileStyle={mapStyle}
        routeMode={routeMode}
        markerTransitionMs={4200}
        shouldFollowSelected={false}
        onMarkerClick={(location) => {
          setSelectedLocation(location);
          setActivePanel("vehicle");
          pinToActiveTripRef.current = true;
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
        eta={eta}
        onToggleRouteMode={() => setRouteMode((prev) => !prev)}
        onApproveRoute={handleApproveTrip}
        onShowActiveTripRoute={() => applyTripRouteToMap(activeTrip, true)}
        onCancelActiveTrip={handleCancelActiveTrip}
        onClearRoute={clearAllVisibleRoutes}
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
        driverScore={driverScore}
        informationError={informationError}
        isLoadingInformation={isLoadingInformation}
        driverError={driverError}
        isLoadingDriver={isLoadingDriver}
        isOpen={activePanel === "vehicle"}
        onClose={() => setActivePanel(null)}
      />

      <FleetManagerMapFooter
        activePanel={activePanel}
        hasSelection={selectedLocation !== null}
        onTogglePanel={handleTogglePanel}
        onClearSelection={clearSelection}
      />

      {routeError && <div className="map-route-error">{routeError}</div>}
    </main>
  );
}
