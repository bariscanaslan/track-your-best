// app/components/mapview/DriverMapFooter.tsx

"use client";

import { FiActivity, FiTruck, FiZap, FiClock, FiNavigation } from "react-icons/fi";
import { EtaPrediction } from "./data/tripInfoData";

type DriverMapFooterProps = {
  activePanel: "trips" | "vehicle" | null;
  hasSelection: boolean;
  currentSpeedKmh: number;
  eta: EtaPrediction | null;
  isOngoing: boolean;
  onTogglePanel: (panel: "trips" | "vehicle") => void;
  onClearSelection: () => void;
};

export default function DriverMapFooter({
  activePanel,
  hasSelection,
  currentSpeedKmh,
  eta,
  isOngoing,
  onTogglePanel,
  onClearSelection,
}: DriverMapFooterProps) {
  const formatHHmm = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const etaMinutes =
    isOngoing && eta?.etaMinutes != null ? Math.round(eta.etaMinutes) : null;

  const arrivalTime =
    isOngoing && eta?.predictedArrivalTime
      ? formatHHmm(eta.predictedArrivalTime)
      : isOngoing && eta?.etaMinutes != null
        ? formatHHmm(new Date(Date.now() + eta.etaMinutes * 60_000).toISOString())
        : null;

  return (
    <footer className="map-footer">
      <div className="map-footer-inner">
        <div className="map-footer-title">
          <div className="map-footer-title-text">Driver Features</div>
          <div className="driver-stats-row">
            <div className="driver-speed-card">
              <div className="driver-speed-card-icon">
                <FiZap size={14} />
              </div>
              <div className="driver-speed-card-content">
                <div className="driver-speed-card-label">Current Speed</div>
                <div className="driver-speed-card-value">
                  {currentSpeedKmh.toFixed(1)}
                  <span> km/h</span>
                </div>
              </div>
            </div>

            <div className="driver-speed-card">
              <div className="driver-speed-card-icon">
                <FiNavigation size={14} />
              </div>
              <div className="driver-speed-card-content">
                <div className="driver-speed-card-label">ETA</div>
                <div className="driver-speed-card-value">
                  {etaMinutes !== null ? (
                    <>{etaMinutes}<span> min</span></>
                  ) : (
                    <span className="driver-speed-card-empty">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="driver-speed-card">
              <div className="driver-speed-card-icon">
                <FiClock size={14} />
              </div>
              <div className="driver-speed-card-content">
                <div className="driver-speed-card-label">Arrival</div>
                <div className="driver-speed-card-value">
                  {arrivalTime ?? <span className="driver-speed-card-empty">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="map-footer-actions">
          <button
            className={`map-footer-action ${activePanel === "trips" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("trips")}
          >
            <FiActivity size={18} />
            Trips
          </button>
          <button
            className={`map-footer-action ${activePanel === "vehicle" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("vehicle")}
          >
            <FiTruck size={18} />
            Vehicle
          </button>
          <button
            className="map-footer-action-red is-secondary"
            onClick={onClearSelection}
            disabled={!hasSelection}
          >
            Clear Selection
          </button>
        </div>
      </div>
    </footer>
  );
}
