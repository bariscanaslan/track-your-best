// app/components/mapview/TripsSidecard.tsx

"use client";

import { TripSummary } from "./data/tripInfoData";

type TripsSidecardProps = {
  isOpen: boolean;
  selectedVehicleId: string | null;
  isRouting: boolean;
  isApproving: boolean;
  isGeocoding: boolean;
  isResolvingStart: boolean;
  isResolvingEnd: boolean;
  isLoadingActiveTrip: boolean;
  routeMode: boolean;
  hasRoute: boolean;
  hasApprovedRoute: boolean;
  tripName: string;
  onTripNameChange: (value: string) => void;
  startAddressInput: string;
  endAddressInput: string;
  onStartAddressChange: (value: string) => void;
  onEndAddressChange: (value: string) => void;
  onPlanTripByAddress: () => void;
  geocodeError: string | null;
  activeTrip: TripSummary | null;
  activeTripError: string | null;
  onToggleRouteMode: () => void;
  onApproveRoute: () => void;
  onShowActiveTripRoute: () => void;
  onCancelActiveTrip: () => void;
  onClearRoute: () => void;
  onClose: () => void;
};

export default function TripsSidecard({
  isOpen,
  selectedVehicleId,
  isRouting,
  isApproving,
  isGeocoding,
  isResolvingStart,
  isResolvingEnd,
  isLoadingActiveTrip,
  routeMode,
  hasRoute,
  hasApprovedRoute,
  tripName,
  onTripNameChange,
  startAddressInput,
  endAddressInput,
  onStartAddressChange,
  onEndAddressChange,
  onPlanTripByAddress,
  geocodeError,
  activeTrip,
  activeTripError,
  onToggleRouteMode,
  onApproveRoute,
  onShowActiveTripRoute,
  onCancelActiveTrip,
  onClearRoute,
  onClose,
}: TripsSidecardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined) return "-";
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (km?: number | null) => {
    if (km === null || km === undefined) return "-";
    return `${km.toFixed(2)} km`;
  };

  const getPlannedEnd = () => {
    if (activeTrip?.plannedEndTime) {
      return new Date(activeTrip.plannedEndTime).toLocaleString();
    }
    if (activeTrip?.durationSeconds) {
      return new Date(Date.now() + activeTrip.durationSeconds * 1000).toLocaleString();
    }
    return "-";
  };

  return (
    <aside className={`map-sidecard ${isOpen ? "is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">Trips</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="map-sidecard-content">
        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Plan Route</div>
          {!selectedVehicleId && <div className="map-sidecard-empty">Select a vehicle first.</div>}
          {selectedVehicleId && (
            <>
              <div className="map-sidecard-field">
                <label className="map-sidecard-input-label" htmlFor="trip-name">
                  Trip Name
                </label>
                <input
                  id="trip-name"
                  className="map-sidecard-input"
                  type="text"
                  placeholder="e.g. Downtown Delivery"
                  value={tripName}
                  onChange={(event) => onTripNameChange(event.target.value)}
                />
              </div>
              <div className="map-sidecard-field">
                <label className="map-sidecard-input-label" htmlFor="start-address">
                  Start Address (Device)
                </label>
                <input
                  id="start-address"
                  className="map-sidecard-input"
                  type="text"
                  placeholder={isResolvingStart ? "Resolving device location..." : "Auto-filled from device"}
                  value={startAddressInput}
                  onChange={(event) => onStartAddressChange(event.target.value)}
                  readOnly
                />
              </div>
              <div className="map-sidecard-field">
                <label className="map-sidecard-input-label" htmlFor="end-address">
                  End Address
                  {isResolvingEnd && <span className="map-sidecard-spinner" aria-hidden="true" />}
                </label>
                <input
                  id="end-address"
                  className="map-sidecard-input"
                  type="text"
                  placeholder={isResolvingEnd ? "Resolving destination..." : "e.g. Airport Terminal 1"}
                  value={endAddressInput}
                  onChange={(event) => onEndAddressChange(event.target.value)}
                />
              </div>
              {geocodeError && <div className="map-sidecard-error">{geocodeError}</div>}
              <div className="map-sidecard-actions">
                <button
                  className="map-footer-action"
                  onClick={onPlanTripByAddress}
                  disabled={isRouting || isGeocoding || isResolvingEnd}
                >
                  {isGeocoding ? "Finding Address..." : isResolvingEnd ? "Resolving Destination..." : "Find Route by Address"}
                </button>
                <button
                  className={`map-footer-action ${routeMode ? "is-active" : ""}`}
                  onClick={onToggleRouteMode}
                  disabled={isRouting}
                >
                  {routeMode ? "Pick Destination" : "Identify Route"}
                </button>
              </div>
              <div className="map-sidecard-actions">
                <button
                  className="map-footer-action is-primary"
                  onClick={onApproveRoute}
                  disabled={isRouting || isApproving || !hasRoute || hasApprovedRoute}
                >
                  {hasApprovedRoute ? "Route Approved" : isApproving ? "Approving..." : "Approve Route"}
                </button>
                <button className="map-footer-action is-secondary" onClick={onClearRoute} disabled={!hasRoute}>
                  Clear Route
                </button>
              </div>
            </>
          )}
        </div>

        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Approved Trip Summary</div>
          {!selectedVehicleId && <div className="map-sidecard-empty">Select a vehicle first.</div>}
          {selectedVehicleId && activeTripError && <div className="map-sidecard-error">{activeTripError}</div>}
          {selectedVehicleId && !activeTripError && !activeTrip && (
            <div className="map-sidecard-empty">
              {isLoadingActiveTrip ? "Loading approved trip..." : "No approved trip for this vehicle."}
            </div>
          )}
          {activeTrip && (
            <>
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">Trip</span>
                <span className="map-sidecard-value">{activeTrip.tripName ?? activeTrip.id}</span>
              </div>
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">Start</span>
                <span className="map-sidecard-value">{activeTrip.startAddress ?? "-"}</span>
              </div>
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">End</span>
                <span className="map-sidecard-value">{activeTrip.endAddress ?? "-"}</span>
              </div>
              <div className="map-sidecard-stats">
                <div className="map-sidecard-stat">
                  <span className="map-sidecard-label">Status</span>
                  <span className="map-sidecard-value">{activeTrip.status ?? "Unknown"}</span>
                </div>
                <div className="map-sidecard-stat">
                  <span className="map-sidecard-label">Duration</span>
                  <span className="map-sidecard-value">{formatDuration(activeTrip.durationSeconds)}</span>
                </div>
                <div className="map-sidecard-stat">
                  <span className="map-sidecard-label">Distance</span>
                  <span className="map-sidecard-value">{formatDistance(activeTrip.totalDistanceKm)}</span>
                </div>
                <div className="map-sidecard-stat">
                  <span className="map-sidecard-label">Planned End</span>
                  <span className="map-sidecard-value">{getPlannedEnd()}</span>
                </div>
              </div>
              <div className="map-sidecard-actions">
                <button className="map-footer-action is-primary" onClick={onShowActiveTripRoute}>
                  Show Approved Route
                </button>
                <button className="map-sidecard-action" onClick={onCancelActiveTrip} disabled={isLoadingActiveTrip}>
                  {isLoadingActiveTrip ? "Canceling..." : "Cancel Route"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
