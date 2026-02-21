// app/components/mapview/RoutesSidecard.tsx

"use client";

type RoutesSidecardProps = {
  isOpen: boolean;
  selectedVehicleId: string | null;
  isRouting: boolean;
  isApproving: boolean;
  isLoadingActiveTrip: boolean;
  isLoadingPastTrips: boolean;
  routeMode: boolean;
  hasRoute: boolean;
  hasApprovedRoute: boolean;
  activeTrip: {
    id: string;
    status?: string | null;
    tripName?: string | null;
    startTime: string;
    geometry?: Array<[number, number]> | null;
  } | null;
  activeTripError: string | null;
  pastTrips: Array<{
    id: string;
    status?: string | null;
    tripName?: string | null;
    startTime: string;
    geometry?: Array<[number, number]> | null;
  }>;
  pastTripsError: string | null;
  onToggleRouteMode: () => void;
  onApproveRoute: () => void;
  onShowActiveTripRoute: () => void;
  onCancelActiveTrip: () => void;
  onShowPastTripRoute: (tripId: string) => void;
  onClearRoute: () => void;
  onClose: () => void;
};

export default function RoutesSidecard({
  isOpen,
  selectedVehicleId,
  isRouting,
  isApproving,
  isLoadingActiveTrip,
  isLoadingPastTrips,
  routeMode,
  hasRoute,
  hasApprovedRoute,
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
}: RoutesSidecardProps) {
  return (
    <aside className={`map-sidecard ${isOpen ? "is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">Routes</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="map-sidecard-content">
        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Active Trip</div>
          {!selectedVehicleId && <div className="map-sidecard-empty">Select a vehicle first.</div>}
          {selectedVehicleId && activeTripError && <div className="map-sidecard-error">{activeTripError}</div>}
          {selectedVehicleId && !activeTripError && !activeTrip && (
            <div className="map-sidecard-empty">
              {isLoadingActiveTrip ? "Loading active trip..." : "No active trip for this vehicle."}
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
                <span className="map-sidecard-label">Started</span>
                <span className="map-sidecard-value">{new Date(activeTrip.startTime).toLocaleString()}</span>
              </div>
              <button className="map-footer-action is-primary" onClick={onShowActiveTripRoute}>
                Show Active Route
              </button>
              <button className="map-sidecard-action" onClick={onCancelActiveTrip} disabled={isLoadingActiveTrip}>
                {isLoadingActiveTrip ? "Canceling..." : "Cancel Route"}
              </button>
            </>
          )}
        </div>

        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Planning Controls</div>
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
        </div>

        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Past Routes</div>
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
                Show Route
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
