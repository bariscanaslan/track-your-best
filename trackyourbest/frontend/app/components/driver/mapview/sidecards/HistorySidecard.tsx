// app/components/mapview/HistorySidecard.tsx

"use client";

import { TripSummary } from "../data/tripInfoData";

type HistorySidecardProps = {
  isOpen: boolean;
  selectedVehicleId: string | null;
  hasSelection: boolean;
  selectedDeviceLabel: string;
  isLoadingPastTrips: boolean;
  pastTrips: TripSummary[];
  pastTripsError: string | null;
  onShowPastTripRoute: (tripId: string) => void;
  filterStart: string;
  filterEnd: string;
  isFiltering: boolean;
  filterError: string | null;
  onFilterStartChange: (value: string) => void;
  onFilterEndChange: (value: string) => void;
  onFilterRoute: () => void;
  onClearFilter: () => void;
  onClose: () => void;
};

export default function HistorySidecard({
  isOpen,
  selectedVehicleId,
  hasSelection,
  selectedDeviceLabel,
  isLoadingPastTrips,
  pastTrips,
  pastTripsError,
  onShowPastTripRoute,
  filterStart,
  filterEnd,
  isFiltering,
  filterError,
  onFilterStartChange,
  onFilterEndChange,
  onFilterRoute,
  onClearFilter,
  onClose,
}: HistorySidecardProps) {
  return (
    <aside
      className={`map-sidecard is-left ${isOpen ? "is-open" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">History & Filters</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="map-sidecard-content">
        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Filter Route</div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Device</span>
            <span className="map-sidecard-value">
              {hasSelection ? selectedDeviceLabel : "Select a marker first."}
            </span>
          </div>
          <div className="map-sidecard-field">
            <label className="map-sidecard-input-label" htmlFor="filter-start">
              Start
            </label>
            <input
              id="filter-start"
              className="map-sidecard-input"
              type="datetime-local"
              value={filterStart}
              onChange={(event) => onFilterStartChange(event.target.value)}
            />
          </div>
          <div className="map-sidecard-field">
            <label className="map-sidecard-input-label" htmlFor="filter-end">
              End
            </label>
            <input
              id="filter-end"
              className="map-sidecard-input"
              type="datetime-local"
              value={filterEnd}
              onChange={(event) => onFilterEndChange(event.target.value)}
            />
          </div>

          {filterError && <div className="map-sidecard-error">{filterError}</div>}

          <div className="map-sidecard-actions">
            <button
              className="map-footer-action is-primary"
              onClick={onFilterRoute}
              disabled={!hasSelection || !filterStart || !filterEnd || isFiltering}
            >
              {isFiltering ? "Filtering..." : "Filter Route"}
            </button>
            <button className="map-footer-action is-secondary" onClick={onClearFilter}>
              Clear Filter
            </button>
          </div>
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
            <div key={trip.id} className="map-sidecard-trip">
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">{trip.tripName ?? trip.id}</span>
                <span className="map-sidecard-value">
                  {(trip.status ?? "Unknown").toLowerCase()} · {new Date(trip.startTime).toLocaleDateString()}
                </span>
              </div>
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">From</span>
                <span className="map-sidecard-value">{trip.startAddress ?? "-"}</span>
              </div>
              <div className="map-sidecard-row is-tight">
                <span className="map-sidecard-label">To</span>
                <span className="map-sidecard-value">{trip.endAddress ?? "-"}</span>
              </div>
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
