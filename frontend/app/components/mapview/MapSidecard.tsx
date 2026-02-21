// app/components/mapview/MapSidecard.tsx

"use client";

import { DeviceLocation } from "./types";
import { formatToGMT3 } from "./dateUtils";

type MapSidecardProps = {
  selectedLocation: DeviceLocation | null;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function MapSidecard({
  selectedLocation,
  error,
  isOpen,
  onClose,
}: MapSidecardProps) {
  return (
    <aside
      className={`map-sidecard ${isOpen ? "is-open" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">Vehicle Information</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      {selectedLocation ? (
        <div className="map-sidecard-content">
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Device Name</span>
            <span className="map-sidecard-value">{selectedLocation.deviceName ?? "Unknown"}</span>
          </div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Vehicle ID</span>
            <span className="map-sidecard-value">{selectedLocation.vehicleId}</span>
          </div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Device ID</span>
            <span className="map-sidecard-value">{selectedLocation.deviceId}</span>
          </div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Latitude</span>
            <span className="map-sidecard-value">{selectedLocation.latitude.toFixed(5)}</span>
          </div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Longitude</span>
            <span className="map-sidecard-value">{selectedLocation.longitude.toFixed(5)}</span>
          </div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Last Record Time</span>
            <span className="map-sidecard-value">
              {formatToGMT3(selectedLocation.gpsTimestamp ?? selectedLocation.receivedTimestamp)}
            </span>
          </div>
        </div>
      ) : (
        <div className="map-sidecard-empty">
          {error ? error : "Select a marker to see details."}
        </div>
      )}
    </aside>
  );
}
