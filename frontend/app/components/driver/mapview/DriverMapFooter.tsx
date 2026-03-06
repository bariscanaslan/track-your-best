// app/components/mapview/DriverMapFooter.tsx

"use client";

import { FiActivity, FiTruck, FiZap } from "react-icons/fi";

type DriverMapFooterProps = {
  activePanel: "trips" | "vehicle" | null;
  hasSelection: boolean;
  currentSpeedKmh: number;
  onTogglePanel: (panel: "trips" | "vehicle") => void;
  onClearSelection: () => void;
};

export default function DriverMapFooter({
  activePanel,
  hasSelection,
  currentSpeedKmh,
  onTogglePanel,
  onClearSelection,
}: DriverMapFooterProps) {
  return (
    <footer className="map-footer">
      <div className="map-footer-inner">
        <div className="map-footer-title">
          <div className="map-footer-title-text">Driver Features</div>
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
