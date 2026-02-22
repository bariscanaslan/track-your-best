// app/components/mapview/MapSidecard.tsx

"use client";

import { DeviceInfo } from "./data/deviceInfoData";
import { DriverInfo } from "./data/driverInfoData";
import { MapDeviceLocation } from "./data/gpsDataInfo";
import { VehicleInfo } from "./data/vehicleInfoData";
import { formatToGMT3 } from "./dateUtils";

type MapSidecardProps = {
  selectedLocation: MapDeviceLocation | null;
  error: string | null;
  deviceInformation: DeviceInfo | null;
  vehicleInformation: VehicleInfo | null;
  driverInformation: DriverInfo | null;
  informationError: string | null;
  isLoadingInformation: boolean;
  driverError: string | null;
  isLoadingDriver: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export default function MapSidecard({
  selectedLocation,
  error,
  deviceInformation,
  vehicleInformation,
  driverInformation,
  informationError,
  isLoadingInformation,
  driverError,
  isLoadingDriver,
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
          {informationError && (
            <div className="map-sidecard-error">{informationError}</div>
          )}

          <div className="map-sidecard-section">
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Vehicle Name</span>
              <span className="map-sidecard-value">
                {vehicleInformation?.vehicleName ?? deviceInformation?.deviceName ?? "Unknown"}
              </span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Plate Number</span>
              <span className="map-sidecard-value">{vehicleInformation?.plateNumber ?? "-"}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Brand / Model</span>
              <span className="map-sidecard-value">
                {vehicleInformation?.brand ?? "-"} / {vehicleInformation?.model ?? "-"}
              </span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Year</span>
              <span className="map-sidecard-value">{vehicleInformation?.year ?? "-"}</span>
            </div>
          </div>

          <div className="map-sidecard-section">
            <div className="map-sidecard-section-title">Driver Information</div>
            {driverError && (
              <div className="map-sidecard-error">{driverError}</div>
            )}
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Name</span>
              <span className="map-sidecard-value">{driverInformation?.fullName ?? "-"}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Phone</span>
              <span className="map-sidecard-value">{driverInformation?.phone ?? "-"}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Image</span>
              {driverInformation?.avatarUrl ? (
                <img
                  src={driverInformation.avatarUrl}
                  alt={driverInformation.fullName ?? "Driver"}
                  className="map-sidecard-avatar"
                />
              ) : (
                <span className="map-sidecard-value">-</span>
              )}
            </div>
            {isLoadingDriver && (
              <div className="map-sidecard-empty">Loading driver information...</div>
            )}
          </div>

          <div className="map-sidecard-section">
            <div className="map-sidecard-section-title">Connected Device</div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Device Identifier</span>
              <span className="map-sidecard-value">
                {deviceInformation?.deviceIdentifier ?? selectedLocation.deviceId}
              </span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">IMEI</span>
              <span className="map-sidecard-value">{deviceInformation?.imei ?? "-"}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">IP Address</span>
              <span className="map-sidecard-value">{deviceInformation?.ipAddress ?? "-"}</span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Signal Strength</span>
              <span className="map-sidecard-value">
                {deviceInformation?.signalStrength ?? "-"}
              </span>
            </div>
            <div className="map-sidecard-row">
              <span className="map-sidecard-label">Last Seen</span>
              <span className="map-sidecard-value">
                {deviceInformation?.lastSeenAt ? formatToGMT3(deviceInformation.lastSeenAt) : "-"}
              </span>
            </div>
          </div>

          {isLoadingInformation && (
            <div className="map-sidecard-empty">Loading vehicle/device information...</div>
          )}
        </div>
      ) : (
        <div className="map-sidecard-empty">
          {error ? error : "Select a marker to see details."}
        </div>
      )}
    </aside>
  );
}