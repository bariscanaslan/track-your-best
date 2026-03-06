// app/components/mapview/AdminMapFooter.tsx

"use client";

import { FiActivity, FiBarChart2, FiClock, FiTruck } from "react-icons/fi";

type AdminMapFooterProps = {
  activePanel: "trips" | "statistics" | "vehicle" | "history" | null;
  hasSelection: boolean;
  onTogglePanel: (panel: "trips" | "statistics" | "vehicle" | "history") => void;
  onClearSelection: () => void;
};

export default function AdminMapFooter({
  activePanel,
  hasSelection,
  onTogglePanel,
  onClearSelection,
}: AdminMapFooterProps) {
  return (
    <footer className="map-footer">
      <div className="map-footer-inner">
        <div className="map-footer-title">
          <div className="map-footer-title-text">Admin Features</div>
          <div className="map-footer-title-subtext">Manage operations and monitor the fleet</div>
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
            className={`map-footer-action ${activePanel === "statistics" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("statistics")}
          >
            <FiBarChart2 size={18} />
            Analytics
          </button>
          <button
            className={`map-footer-action ${activePanel === "vehicle" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("vehicle")}
          >
            <FiTruck size={18} />
            Vehicles
          </button>
          <button
            className={`map-footer-action ${activePanel === "history" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("history")}
          >
            <FiClock size={18} />
            History
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
