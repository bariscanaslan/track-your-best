// app/components/mapview/TripsSidecard.tsx

"use client";

import { TripSummary } from "../data/tripInfoData";
import {
  FaBan,
  FaCheck,
  FaFlagCheckered,
  FaPause,
  FaGoogle,
  FaPlay,
  FaRoute,
  FaTimes,
} from "react-icons/fa";

type TripsSidecardProps = {
  isOpen: boolean;
  selectedVehicleId: string | null;
  isLoadingActiveTrip: boolean;
  activeTrip: TripSummary | null;
  activeTripError: string | null;
  isSubmittingDecision: boolean;
  decisionNotes: string;
  onDecisionNotesChange: (value: string) => void;
  onAcceptTrip: () => void;
  onRejectTrip: () => void;
  onPauseTrip: () => void;
  onContinueTrip: () => void;
  onFinishTrip: () => void;
  onCancelTrip: () => void;
  onShowActiveTripRoute: () => void;
  onClose: () => void;
};

export default function TripsSidecard({
  isOpen,
  selectedVehicleId,
  isLoadingActiveTrip,
  activeTrip,
  activeTripError,
  isSubmittingDecision,
  decisionNotes,
  onDecisionNotesChange,
  onAcceptTrip,
  onRejectTrip,
  onPauseTrip,
  onContinueTrip,
  onFinishTrip,
  onCancelTrip,
  onShowActiveTripRoute,
  onClose,
}: TripsSidecardProps) {
  const openGoogleMapsDirections = () => {
    if (!activeTrip) return;

    const destinationAddress = activeTrip.endAddress?.trim();
    const destinationCoords =
      activeTrip.geometry && activeTrip.geometry.length > 0
        ? activeTrip.geometry[activeTrip.geometry.length - 1]
        : null;

    const destination = destinationAddress
      ? destinationAddress
      : destinationCoords
        ? `${destinationCoords[0]},${destinationCoords[1]}`
        : "";

    if (!destination) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
    if (activeTrip?.durationSeconds && activeTrip?.startTime) {
      const startMs = new Date(activeTrip.startTime).getTime();
      return new Date(startMs + activeTrip.durationSeconds * 1000).toLocaleString();
    }
    return "-";
  };

  const normalizedStatus = (activeTrip?.status ?? "").toLowerCase();
  const isAwaitingDriverDecision =
    normalizedStatus === "driverapprove" || normalizedStatus === "driver_approve";
  const isOngoing = normalizedStatus === "ongoing";
  const isPaused = normalizedStatus === "paused";

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
          <div className="map-sidecard-section-title">Active Trip</div>
          {!selectedVehicleId && <div className="map-sidecard-empty">Select a vehicle first.</div>}
          {selectedVehicleId && activeTripError && <div className="map-sidecard-error">{activeTripError}</div>}
          {selectedVehicleId && !activeTripError && !activeTrip && (
            <div className="map-sidecard-empty">
              {isLoadingActiveTrip ? "Loading trip..." : "No active trip for this vehicle."}
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
                <span className="map-sidecard-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{activeTrip.endAddress ?? "-"}</span>
                  <button
                    type="button"
                    className="map-footer-action"
                    style={{ padding: "4px 8px", minHeight: 28 }}
                    onClick={openGoogleMapsDirections}
                    disabled={!activeTrip.endAddress && !activeTrip.geometry?.length}
                    title="Open in Google Maps"
                    aria-label="Open destination in Google Maps"
                  >
                    <FaGoogle size={12} />
                  </button>
                </span>
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
                <div className="map-sidecard-stat">
                  <span className="map-sidecard-label">Pause Count</span>
                  <span className="map-sidecard-value">{activeTrip.pauseCount ?? 0}</span>
                </div>
              </div>
              <div className="map-sidecard-actions">
                <button className="map-footer-action is-primary" onClick={onShowActiveTripRoute}>
                  <FaRoute size={12} />
                  Show Route
                </button>
              </div>
              {isAwaitingDriverDecision && (
                <>
                  <div className="map-sidecard-field">
                    <label className="map-sidecard-input-label" htmlFor="driver-notes">
                      Rejection Note (required only if reject)
                    </label>
                    <textarea
                      id="driver-notes"
                      className="map-sidecard-input"
                      placeholder="Type rejection reason"
                      value={decisionNotes}
                      onChange={(event) => onDecisionNotesChange(event.target.value)}
                    />
                  </div>
                  <div className="map-sidecard-actions">
                    <button
                      className="map-footer-action is-primary"
                      onClick={onAcceptTrip}
                      disabled={isSubmittingDecision}
                    >
                      <FaCheck size={12} />
                      {isSubmittingDecision ? "Submitting..." : "Accept Route"}
                    </button>
                    <button
                      className="map-footer-action-red is-secondary"
                      onClick={onRejectTrip}
                      disabled={isSubmittingDecision || !decisionNotes.trim()}
                    >
                      <FaTimes size={12} />
                      {isSubmittingDecision ? "Submitting..." : "Reject Route"}
                    </button>
                  </div>
                </>
              )}
              {(isOngoing || isPaused) && (
                <div className="map-sidecard-actions">
                  {isOngoing && (
                    <button
                      className="map-footer-action"
                      onClick={onPauseTrip}
                      disabled={isSubmittingDecision}
                    >
                      <FaPause size={12} />
                      {isSubmittingDecision ? "Submitting..." : "Pause Trip"}
                    </button>
                  )}
                  {isPaused && (
                    <button
                      className="map-footer-action"
                      onClick={onContinueTrip}
                      disabled={isSubmittingDecision}
                    >
                      <FaPlay size={12} />
                      {isSubmittingDecision ? "Submitting..." : "Continue Trip"}
                    </button>
                  )}
                  <button
                    className="map-footer-action is-primary"
                    onClick={onFinishTrip}
                    disabled={isSubmittingDecision}
                  >
                    <FaFlagCheckered size={12} />
                    {isSubmittingDecision ? "Submitting..." : "Finish Trip"}
                  </button>
                  <button
                    className="map-footer-action-red is-secondary"
                    onClick={onCancelTrip}
                    disabled={isSubmittingDecision}
                  >
                    <FaBan size={12} />
                    {isSubmittingDecision ? "Submitting..." : "Cancel Trip"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
