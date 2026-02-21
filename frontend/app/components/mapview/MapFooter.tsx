// app/components/mapview/MapFooter.tsx

"use client";

import { FiActivity, FiBarChart2, FiTruck } from "react-icons/fi";

type MapFooterProps = {
  activePanel: "routes" | "statistics" | "vehicle" | null;
  onTogglePanel: (panel: "routes" | "statistics" | "vehicle") => void;
};

export default function MapFooter({
  activePanel,
  onTogglePanel,
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
            className={`map-footer-action ${activePanel === "routes" ? "is-active" : ""}`}
            onClick={() => onTogglePanel("routes")}
          >
            <FiActivity size={18} />
            Routes
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
        </div>
      </div>
    </footer>
  );
}
