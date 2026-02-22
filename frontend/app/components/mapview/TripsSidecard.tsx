// app/components/mapview/TripsSidecard.tsx

"use client";

import { TripSummary } from "./data/tripInfoData";

type TripsSidecardProps = {
  isOpen: boolean;
  selectedVehicleId: string | null;
  isRouting: boolean;
  isApproving: boolean;
  isLoadingActiveTrip: boolean;
  isLoadingPastTrips: boolean;
  routeMode: boolean;
  hasRoute: boolean;
  hasApprovedRoute: boolean;
  tripName: string;
  onTripNameChange: (value: string) => void;
  activeTrip: TripSummary | null;
  activeTripError: string | null;
  pastTrips: TripSummary[];
  pastTripsError: string | null;
  onToggleRouteMode: () => void;
  onApproveRoute: () => void;
  onShowActiveTripRoute: () => void;
  onCancelActiveTrip: () => void;
  onShowPastTripRoute: (tripId: string) => void;
  onClearRoute: () => void;
  onClose: () => void;
};

export default function TripsSidecard({
  isOpen,
  selectedVehicleId,
  isRouting,
  isApproving,
  isLoadingActiveTrip,
  isLoadingPastTrips,
  routeMode,
  hasRoute,
  hasApprovedRoute,
  tripName,
  onTripNameChange,
  activeTrip,
  activeTripError,
  pastTrips,
  pastTripsError,
  onToggleRouteMode,
  onApproveRoute,
  onShowActiveTripRoute,
  onCancelActiveTrip,
  onShowPastTripRoute,
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
              <button
                className={`map-footer-action ${routeMode ? "is-active" : ""}`}
                onClick={onToggleRouteMode}
                disabled={isRouting}
              >
                {routeMode ? "Pick Destination" : "Identify Route"}
              </button>
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
              <div className="map-sidecard-row">
                <span className="map-sidecard-label">Trip</span>
                <span className="map-sidecard-value">{activeTrip.tripName ?? activeTrip.id}</span>
              </div>
              <div className="map-sidecard-row">
                <span className="map-sidecard-label">Status</span>
                <span className="map-sidecard-value">{activeTrip.status ?? "Unknown"}</span>
              </div>
              <div className="map-sidecard-row">
                <span className="map-sidecard-label">Duration</span>
                <span className="map-sidecard-value">{formatDuration(activeTrip.durationSeconds)}</span>
              </div>
              <div className="map-sidecard-row">
                <span className="map-sidecard-label">Distance</span>
                <span className="map-sidecard-value">{formatDistance(activeTrip.totalDistanceKm)}</span>
              </div>
              <div className="map-sidecard-row">
                <span className="map-sidecard-label">Planned End</span>
                <span className="map-sidecard-value">{getPlannedEnd()}</span>
              </div>
              <button className="map-footer-action is-primary" onClick={onShowActiveTripRoute}>
                Show Approved Route
              </button>
              <button className="map-sidecard-action" onClick={onCancelActiveTrip} disabled={isLoadingActiveTrip}>
                {isLoadingActiveTrip ? "Canceling..." : "Cancel Route"}
              </button>
            </>
          )}
        </div>

        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Past Trips</div>
          {!selectedVehicleId && <div className="map-sidecard-empty">Select a vehicle first.</div>}
          {selectedVehicleId && pastTripsError && <div className="map-sidecard-error">{pastTripsError}</div>}
          {selectedVehicleId && !pastTripsError && pastTrips.length === 0 && (
            <div className="map-sidecard-empty">
              {isLoadingPastTrips ? "Loading past routes..." : "No past routes found."}
            </div>
          )}
          {pastTrips.map((trip) => (
            <div key={trip.id} className="map-sidecard-row">
              <span className="map-sidecard-label">{trip.tripName ?? trip.id}</span>
              <span className="map-sidecard-value">
                {(trip.status ?? "Unknown").toLowerCase()} - {new Date(trip.startTime).toLocaleDateString()}
              </span>
              <button className="map-footer-action" onClick={() => onShowPastTripRoute(trip.id)}>
                Show Trip
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
