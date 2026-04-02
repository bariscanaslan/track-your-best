// app/components/driver/mapview/DriverMapView.tsx

"use client";

import { useEffect, useRef, useState } from "react";

import DriverMapFooter from "./DriverMapFooter";
import MapCanvas from "../../MapCanvas";
import VehicleInformationSidecard from "./sidecards/VehicleInformationSidecard";
import TripsSidecard from "./sidecards/TripsSidecard";

import { DeviceInfo } from "./data/deviceInfoData";
import { MapDeviceLocation } from "./data/gpsDataInfo";
import { VehicleInfo } from "./data/vehicleInfoData";
import { TripSummary } from "./data/tripInfoData";
import { DriverInfo } from "./data/driverInfoData";
import { driversApi, devicesApi, gpsApi, tripsApi, vehiclesApi } from "../../../utils/api.js";

import "../../../components/MapView.css";

export default function DriverMapView() {
  const ACTIVE_TRIP_REFRESH_MS = 5000;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const USR_ID = "f45f1f3a-73ae-481c-8a65-5e359360d393";
  const API_URL = `${gpsApi.lastLocationByUserId(USR_ID, API_BASE)}`;

  const [deviceLocations, setDeviceLocations] = useState<MapDeviceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapDeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"trips" | "vehicle" | null>(null);
  const [visibleTripRoutes, setVisibleTripRoutes] = useState<Array<Array<[number, number]>>>([]);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [activeTrip, setActiveTrip] = useState<TripSummary | null>(null);
  const [activeTripError, setActiveTripError] = useState<string | null>(null);
  const [isLoadingActiveTrip, setIsLoadingActiveTrip] = useState(false);
  const [shouldShowActiveTripRoute, setShouldShowActiveTripRoute] = useState(true);

  const [deviceInformation, setDeviceInformation] = useState<DeviceInfo | null>(null);
  const [vehicleInformation, setVehicleInformation] = useState<VehicleInfo | null>(null);
  const [driverInformation, setDriverInformation] = useState<DriverInfo | null>(null);
  const [informationError, setInformationError] = useState<string | null>(null);
  const [isLoadingInformation, setIsLoadingInformation] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(false);

  const [decisionNotes, setDecisionNotes] = useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [actionModal, setActionModal] = useState<null | "pause" | "cancel" | "finish-warning">(null);
  const [cancelNote, setCancelNote] = useState("");
  const [finishWarningDistanceKm, setFinishWarningDistanceKm] = useState<number | null>(null);

  const [mapStyle, setMapStyle] = useState<"satellite" | "light" | "colorful">("colorful");
  const [shouldInitialFocus, setShouldInitialFocus] = useState(true);
  const mapStyleKey = "tyb.mapStyle";
  const selectedLocationRef = useRef<MapDeviceLocation | null>(null);

  type FetchErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

  interface FetchError {
    code: FetchErrorCode;
    message: string;
  }

  const resolveHttpError = (status: number, context: string): FetchError => {
    switch (status) {
      case 401:
        return { code: "UNAUTHORIZED", message: `${context}: Session expired, please log in again.` };
      case 403:
        return { code: "FORBIDDEN", message: `${context}: You do not have permission to access this resource.` };
      case 404:
        return { code: "NOT_FOUND", message: `${context}: Record not found.` };
      case 500:
      case 502:
      case 503:
        return { code: "SERVER_ERROR", message: `${context}: Server error, please try again later.` };
      default:
        return { code: "UNKNOWN", message: `${context}: An unexpected error occurred (${status}).` };
    }
  };

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
    if (shouldInitialFocus && selectedLocation) {
      setShouldInitialFocus(false);
    }
  }, [shouldInitialFocus, selectedLocation]);

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

        if (res.status === 401) {
          setError("Session expired, please log in again.");
          return;
        }
        if (res.status === 403) {
          setError("You do not have permission to access GPS data.");
          return;
        }
        if (!res.ok) {
          const { message } = resolveHttpError(res.status, "GPS");
          setError(message);
          return;
        }

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
        } else if (validLocations.length > 0) {
          const first = validLocations[0];
          setSelectedLocation(first);
          fetchActiveTrip(first.vehicleId);
          fetchVehicleAndDeviceInformation(first);
          fetchDriverInformation(first.vehicleId);
        }
      } catch {
        setError("Connection error: Unable to reach the server.");
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
        setActiveTripError(null);
        return;
      }

      if (res.status === 401) {
        setActiveTripError("Session expired, please log in again.");
        return;
      }

      if (res.status === 403) {
        setActiveTripError("You do not have permission to access trip data.");
        return;
      }

      if (!res.ok) {
        const { message } = resolveHttpError(res.status, "Active trip");
        setActiveTripError(message);
        return;
      }

      const data: TripSummary | null = await res.json();
      setActiveTrip(data ?? null);
    } catch {
      setActiveTripError("Connection error: Unable to retrieve active trip.");
      setActiveTrip(null);
    } finally {
      setIsLoadingActiveTrip(false);
    }
  };

  useEffect(() => {
    if (!selectedLocation?.vehicleId || !API_BASE) {
      return;
    }

    fetchActiveTrip(selectedLocation.vehicleId);

    const interval = setInterval(() => {
      fetchActiveTrip(selectedLocation.vehicleId);
    }, ACTIVE_TRIP_REFRESH_MS);

    return () => clearInterval(interval);
  }, [API_BASE, selectedLocation?.vehicleId]);

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

      // Device is required — all error codes are fatal
      if (deviceRes.status === 401) {
        setInformationError("Session expired, please log in again.");
        return;
      }
      if (deviceRes.status === 403) {
        setInformationError("You do not have permission to access device information.");
        return;
      }
      if (deviceRes.status === 404) {
        setInformationError("Device not found.");
        return;
      }
      if (!deviceRes.ok) {
        const { message } = resolveHttpError(deviceRes.status, "Device information");
        setInformationError(message);
        return;
      }

      // Vehicle is optional — 404 means not assigned yet, not an error
      if (vehicleRes) {
        if (vehicleRes.status === 401) {
          setInformationError("Session expired, please log in again.");
          return;
        }
        if (vehicleRes.status === 403) {
          setInformationError("You do not have permission to access vehicle information.");
          return;
        }
        if (vehicleRes.status === 404) {
          // No vehicle assigned — parse device only and continue
          const deviceData = await deviceRes.json();
          setDeviceInformation(deviceData ?? null);
          setVehicleInformation(null);
          return;
        }
        if (!vehicleRes.ok) {
          const { message } = resolveHttpError(vehicleRes.status, "Vehicle information");
          setInformationError(message);
          return;
        }
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
    try {
      const res = await fetch(driversApi.infoByVehicle(vehicleId, API_BASE), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.status === 404) {
        setDriverInformation(null);
        setDriverError(null);
        return;
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

    const nextPath = trip.geometry.map((point) => [point[0], point[1]] as [number, number]);
    setVisibleTripRoutes([nextPath]);
    setRouteError(null);
  };

  useEffect(() => {
    if (!shouldShowActiveTripRoute) {
      return;
    }

    if (!activeTrip?.geometry || activeTrip.geometry.length < 2) {
      setVisibleTripRoutes([]);
      return;
    }

    applyTripRouteToMap(activeTrip);
  }, [activeTrip, shouldShowActiveTripRoute]);

  const handleDriverDecision = async (decision: "accepted" | "rejected") => {
    if (!activeTrip?.id || !API_BASE) {
      setRouteError("Active trip is required.");
      return;
    }

    if (decision === "rejected" && !decisionNotes.trim()) {
      setRouteError("Rejection note is required.");
      return;
    }

    setIsSubmittingDecision(true);
    setRouteError(null);

    try {
      const res = await fetch(tripsApi.driverDecision(activeTrip.id, API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decision,
          notes: decision === "rejected" ? decisionNotes.trim() : null,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Trip decision failed.");
      }

      const updatedTrip: TripSummary | null = await res.json();
      setActiveTrip(updatedTrip ?? null);
      if (decision === "accepted") {
        setDecisionNotes("");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trip decision failed.";
      setRouteError(message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const performDriverAction = async (
    action: "pause" | "continue" | "finish" | "cancel",
    notes: string | null = null
  ) => {
    if (!activeTrip?.id || !API_BASE) {
      setRouteError("Active trip is required.");
      return;
    }

    setIsSubmittingDecision(true);
    setRouteError(null);

    try {
      const res = await fetch(tripsApi.driverAction(activeTrip.id, API_BASE), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, notes }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Trip action failed.");
      }

      const updatedTrip: TripSummary | null = await res.json();
      setActiveTrip(updatedTrip ?? null);
      setActionModal(null);
      setCancelNote("");
      setFinishWarningDistanceKm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trip action failed.";
      setRouteError(message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleDriverAction = async (action: "pause" | "continue" | "finish" | "cancel") => {
    if (!activeTrip?.id || !API_BASE) {
      setRouteError("Active trip is required.");
      return;
    }

    if (action === "continue") {
      await performDriverAction("continue");
      return;
    }

    if (action === "pause") {
      setActionModal("pause");
      return;
    }

    if (action === "cancel") {
      setCancelNote("");
      setActionModal("cancel");
      return;
    }

    if (action === "finish") {
      if (!selectedLocation) {
        setRouteError("Current location is required to finish trip.");
        return;
      }

      const checkRes = await fetch(
        tripsApi.driverFinishCheck(
          activeTrip.id,
          selectedLocation.latitude,
          selectedLocation.longitude,
          API_BASE
        ),
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!checkRes.ok) {
        setRouteError("Finish check failed.");
        return;
      }

      const finishCheck: { distanceKm: number; shouldWarn: boolean } = await checkRes.json();
      if (finishCheck.shouldWarn) {
        setFinishWarningDistanceKm(finishCheck.distanceKm);
        setActionModal("finish-warning");
        return;
      }

      await performDriverAction("finish");
    }
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setActivePanel((prev) => (prev === "vehicle" ? null : prev));
    setActiveTrip(null);
    setActiveTripError(null);
    setDeviceInformation(null);
    setVehicleInformation(null);
    setInformationError(null);
    setIsLoadingInformation(false);
    setDriverInformation(null);
    setDriverError(null);
    setIsLoadingDriver(false);
    setVisibleTripRoutes([]);
    setShouldShowActiveTripRoute(true);
    setDecisionNotes("");
  };

  const currentSpeedKmh = selectedLocation?.speed ? Number(selectedLocation.speed) : 0;
  const renderedDestinationPoints = visibleTripRoutes
    .filter((path) => path.length > 1)
    .map((path) => path[path.length - 1]);

  return (
    <main className="map-page" style={{ height: "100vh", width: "100%" }}>
      <MapCanvas
        deviceLocations={deviceLocations}
        selectedVehicleId={selectedLocation?.vehicleId ?? selectedLocation?.deviceId ?? null}
        routePaths={visibleTripRoutes}
        destinationPoints={renderedDestinationPoints}
        filteredStartPoint={null}
        filteredEndPoint={null}
        tileStyle={mapStyle}
        routeMode={false}
        markerTransitionMs={4200}
        shouldFollowSelected={Boolean(selectedLocation)}
        selectedFollowZoom={18}
        focusPoint={
          shouldInitialFocus && selectedLocation
            ? [selectedLocation.latitude, selectedLocation.longitude]
            : null
        }
        focusZoom={18}
        onMarkerClick={(location) => {
          setSelectedLocation(location);
          setActivePanel("vehicle");
          setShouldShowActiveTripRoute(true);
          fetchActiveTrip(location.vehicleId);
          fetchVehicleAndDeviceInformation(location);
          fetchDriverInformation(location.vehicleId);
        }}
        onClosePanel={() => setActivePanel(null)}
        onMapClick={() => {}}
        onMapBackgroundClick={() => setVisibleTripRoutes([])}
      />

      <TripsSidecard
        isOpen={activePanel === "trips"}
        selectedVehicleId={selectedLocation?.vehicleId ?? null}
        isLoadingActiveTrip={isLoadingActiveTrip}
        activeTrip={activeTrip}
        activeTripError={activeTripError}
        isSubmittingDecision={isSubmittingDecision}
        decisionNotes={decisionNotes}
        onDecisionNotesChange={setDecisionNotes}
        onAcceptTrip={() => handleDriverDecision("accepted")}
        onRejectTrip={() => handleDriverDecision("rejected")}
        onPauseTrip={() => handleDriverAction("pause")}
        onContinueTrip={() => handleDriverAction("continue")}
        onFinishTrip={() => handleDriverAction("finish")}
        onCancelTrip={() => handleDriverAction("cancel")}
        onShowActiveTripRoute={() => {
          setShouldShowActiveTripRoute(true);
          applyTripRouteToMap(activeTrip);
        }}
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

      <DriverMapFooter
        activePanel={activePanel}
        hasSelection={selectedLocation !== null}
        currentSpeedKmh={currentSpeedKmh}
        onTogglePanel={(panel) => {
          if (selectedLocation && (panel === "vehicle" || panel === "trips")) {
            fetchActiveTrip(selectedLocation.vehicleId);
            if (panel === "vehicle") {
              fetchVehicleAndDeviceInformation(selectedLocation);
              fetchDriverInformation(selectedLocation.vehicleId);
            }
          }
          setActivePanel((prev) => (prev === panel ? null : panel));
        }}
        onClearSelection={clearSelection}
      />

      {actionModal && (
        <div className="map-modal-overlay" role="dialog" aria-modal="true">
          <div className="map-modal">
            {actionModal === "pause" && (
              <>
                <div className="map-modal-title">Pause Trip</div>
                <div className="map-modal-text">Are you sure you want to pause this trip?</div>
                <div className="map-modal-actions">
                  <button
                    className="map-footer-action is-secondary"
                    onClick={() => setActionModal(null)}
                    disabled={isSubmittingDecision}
                  >
                    No
                  </button>
                  <button
                    className="map-footer-action is-primary"
                    onClick={() => performDriverAction("pause")}
                    disabled={isSubmittingDecision}
                  >
                    {isSubmittingDecision ? "Submitting..." : "Yes, Pause"}
                  </button>
                </div>
              </>
            )}

            {actionModal === "cancel" && (
              <>
                <div className="map-modal-title">Cancel Trip</div>
                <div className="map-modal-text">
                  Are you sure you want to cancel this trip? Cancellation note is required.
                </div>
                <textarea
                  className="map-sidecard-input"
                  placeholder="Type cancellation note"
                  value={cancelNote}
                  onChange={(event) => setCancelNote(event.target.value)}
                />
                <div className="map-modal-actions">
                  <button
                    className="map-footer-action is-secondary"
                    onClick={() => setActionModal(null)}
                    disabled={isSubmittingDecision}
                  >
                    No
                  </button>
                  <button
                    className="map-footer-action-red is-secondary"
                    onClick={() => {
                      if (!cancelNote.trim()) {
                        setRouteError("Cancellation note is required.");
                        return;
                      }
                      performDriverAction("cancel", cancelNote.trim());
                    }}
                    disabled={isSubmittingDecision}
                  >
                    {isSubmittingDecision ? "Submitting..." : "Yes, Cancel"}
                  </button>
                </div>
              </>
            )}

            {actionModal === "finish-warning" && (
              <>
                <div className="map-modal-title">Finish Trip Warning</div>
                <div className="map-modal-text">
                  Remaining distance is {finishWarningDistanceKm?.toFixed(2)} km.
                  Finish anyway?
                </div>
                <div className="map-modal-actions">
                  <button
                    className="map-footer-action is-secondary"
                    onClick={() => setActionModal(null)}
                    disabled={isSubmittingDecision}
                  >
                    No
                  </button>
                  <button
                    className="map-footer-action is-primary"
                    onClick={() => performDriverAction("finish")}
                    disabled={isSubmittingDecision}
                  >
                    {isSubmittingDecision ? "Submitting..." : "Yes, Finish"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {routeError && <div className="map-route-error">{routeError}</div>}
    </main>
  );
}
