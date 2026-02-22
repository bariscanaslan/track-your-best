// app/components/mapview/MapFooter.tsx

"use client";

import { FiActivity, FiBarChart2, FiFilter, FiTruck } from "react-icons/fi";

type MapFooterProps = {
  activePanel: "trips" | "statistics" | "vehicle" | "filter" | null;
  hasSelection: boolean;
  onTogglePanel: (panel: "trips" | "statistics" | "vehicle" | "filter") => void;
  onClearSelection: () => void;
};

export default function MapFooter({
  activePanel,
  hasSelection,
  onTogglePanel,
  onClearSelection,
}: MapFooterProps) {
  return (
    <footer className="map-footer">
      <div className="map-footer-inner">
        <div className="map-footer-title">
          <div className="map-footer-title-text">Fleet Features</div>
          <div className="map-footer-title-subtext">Open feature sidebars from here</div>
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
            Statistics
          </button>
          <button
            className={`map-footer-action ${activePanel === "vehicle" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("vehicle")}
          >
            <FiTruck size={18} />
            Vehicle Information
          </button>
          <button
            className={`map-footer-action ${activePanel === "filter" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("filter")}
          >
            <FiFilter size={18} />
            Filter Route
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
