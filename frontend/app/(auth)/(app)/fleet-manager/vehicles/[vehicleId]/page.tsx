"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { devicesApi, vehiclesApi } from "../../../../../utils/api";
import { useAuth } from "../../../../../context/AuthContext";
import "../../fleet-manager.css";

type VehicleDetail = {
  id: string;
  deviceId?: string | null;
  deviceName?: string | null;
  vehicleName: string;
  plateNumber: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  fuelType?: string | null;
  capacity?: number | null;
  insuranceExpiry?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type DeviceOption = {
  id: string;
  deviceName: string;
  isActive?: boolean | null;
};

type VehicleListItem = {
  id: string;
  deviceId?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

export default function FleetManagerVehicleEditPage() {
  const params = useParams();
  const vehicleId = String(params?.vehicleId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [busyDevices, setBusyDevices] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeviceChange, setConfirmDeviceChange] = useState(false);

  const [vehicleForm, setVehicleForm] = useState({
    deviceId: "",
    vehicleName: "",
    plateNumber: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    fuelType: "",
    capacity: "",
    insuranceExpiry: "",
    isActive: true,
  });

  const handleVehicleChange =
    (field: keyof typeof vehicleForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setVehicleForm((prev) => ({ ...prev, [field]: value }));
    };

  const originalDeviceId = vehicle?.deviceId ?? "";
  const selectedDeviceId = vehicleForm.deviceId ?? "";
  const isDeviceChanged = !!vehicle && selectedDeviceId !== (originalDeviceId || "");

  const fetchVehicle = async () => {
    if (!vehicleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(vehiclesApi.getById(vehicleId, orgId, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load vehicle.");
      }
      const data = (await res.json()) as VehicleDetail;
      setVehicle(data);
      setVehicleForm({
        deviceId: data.deviceId ?? "",
        vehicleName: data.vehicleName ?? "",
        plateNumber: data.plateNumber ?? "",
        brand: data.brand ?? "",
        model: data.model ?? "",
        year: data.year ? String(data.year) : "",
        color: data.color ?? "",
        fuelType: data.fuelType ?? "",
        capacity: data.capacity ? String(data.capacity) : "",
        insuranceExpiry: toDateInput(data.insuranceExpiry),
        isActive: data.isActive ?? true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load vehicle.";
      setError(message);
      setVehicle(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(devicesApi.list(orgId, apiBase, true), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load devices.");
      }
      const data = (await res.json()) as DeviceOption[];
      const safe = Array.isArray(data) ? data : [];
      setDevices(
        safe.filter((item) => item.isActive !== false || item.id === selectedDeviceId || item.id === originalDeviceId)
      );
    } catch {
      setDevices([]);
    }
  };

  const fetchBusyDevices = async () => {
    try {
      const res = await fetch(vehiclesApi.list(orgId, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load vehicles.");
      }
      const data = (await res.json()) as VehicleListItem[];
      const busy = new Set(
        (Array.isArray(data) ? data : [])
          .filter((item) => item.deviceId && item.id !== vehicleId)
          .map((item) => String(item.deviceId))
      );
      setBusyDevices(busy);
    } catch {
      setBusyDevices(new Set());
    }
  };

  useEffect(() => {
    fetchVehicle();
    fetchBusyDevices();
  }, [vehicleId]);

  useEffect(() => {
    fetchDevices();
  }, [vehicleId, originalDeviceId, selectedDeviceId]);

  useEffect(() => {
    if (!isDeviceChanged) {
      setConfirmDeviceChange(false);
    }
  }, [isDeviceChanged]);

  const handleSave = async () => {
    if (!vehicle) return;
    if (isDeviceChanged && !confirmDeviceChange) {
      setError("Please acknowledge the device-change warning before saving.");
      return;
    }

    if (isDeviceChanged) {
      const accepted = window.confirm(
        "Changing device will clone the selected device with a new ID, attach it to this vehicle, and deactivate the current connected device. Continue?"
      );
      if (!accepted) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const vehicleRes = await fetch(vehiclesApi.update(vehicle.id, apiBase), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: orgId,
          deviceId: vehicleForm.deviceId.trim() || null,
          confirmDeviceReassignment: isDeviceChanged,
          vehicleName: vehicleForm.vehicleName.trim(),
          plateNumber: vehicleForm.plateNumber.trim(),
          brand: vehicleForm.brand.trim() || null,
          model: vehicleForm.model.trim() || null,
          year: vehicleForm.year.trim() ? Number(vehicleForm.year) : null,
          color: vehicleForm.color.trim() || null,
          fuelType: vehicleForm.fuelType.trim() || null,
          capacity: vehicleForm.capacity.trim() ? Number(vehicleForm.capacity) : null,
          insuranceExpiry: parseDateInput(vehicleForm.insuranceExpiry),
          isActive: vehicleForm.isActive,
        }),
      });
      if (!vehicleRes.ok) {
        const detail = await vehicleRes.text();
        throw new Error(detail || "Vehicle update failed.");
      }

      await fetchVehicle();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Vehicles</div>
        <div className="fm-actions">
          <Link className="fm-button" href="/fleet-manager/vehicles">
            Back to list
          </Link>
          <button
            className="fm-button fm-button-primary"
            onClick={handleSave}
            disabled={saving || (isDeviceChanged && !confirmDeviceChange)}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="fm-edit-banner">
        <div>
          <strong>Editing Vehicle Profile</strong>
          <div className="fm-list-sub">Update vehicle details and device assignment.</div>
        </div>
        <div className="fm-list-sub">Vehicle ID: {vehicleId}</div>
      </div>

      {isLoading && <div className="fm-note">Loading vehicle...</div>}
      {error && <div className="fm-note">{error}</div>}

      {vehicle && (
        <div className="fm-edit-grid">
          <section className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">Vehicle Details</div>
            </div>
            <div className="fm-section-sub">Created: {formatDate(vehicle.createdAt ?? null)}</div>
            {isDeviceChanged && (
              <div className="fm-note fm-warning-danger">
                Device reassignment is protected. Saving will clone the selected device with a new UUID, connect the
                cloned device to this vehicle, and set the previous connected device to inactive.
              </div>
            )}
            <div className="fm-form">
              <label className="fm-field">
                <div className="fm-field-label">Device</div>
                <select
                  className="fm-select"
                  value={vehicleForm.deviceId || ""}
                  onChange={(event) => {
                    const val = event.target.value;
                    setVehicleForm((prev) => ({ ...prev, deviceId: val }));
                  }}
                >
                  <option value="">-- no device --</option>
                  {devices.map((device) => {
                    const isBusy = device.id && busyDevices.has(device.id);
                    const isCurrent = device.id === vehicle?.deviceId;
                    
                    if (isBusy && !isCurrent) return null;
                    return (
                      <option key={device.id} value={device.id}>
                        {device.deviceName}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="fm-field">
                <div className="fm-field-label">Vehicle name</div>
                <input
                  placeholder="vehicle_name"
                  value={vehicleForm.vehicleName}
                  onChange={handleVehicleChange("vehicleName")}
                />
              </label>
              <label className="fm-field">
                <div className="fm-field-label">Plate number</div>
                <input
                  placeholder="plate_number"
                  value={vehicleForm.plateNumber}
                  onChange={handleVehicleChange("plateNumber")}
                />
              </label>
              <div className="fm-form-row">
                <label className="fm-field">
                  <div className="fm-field-label">Brand</div>
                  <input placeholder="brand" value={vehicleForm.brand} onChange={handleVehicleChange("brand")} />
                </label>
                <label className="fm-field">
                  <div className="fm-field-label">Model</div>
                  <input placeholder="model" value={vehicleForm.model} onChange={handleVehicleChange("model")} />
                </label>
              </div>
              <div className="fm-form-row">
                <label className="fm-field">
                  <div className="fm-field-label">Year</div>
                  <input placeholder="year" value={vehicleForm.year} onChange={handleVehicleChange("year")} />
                </label>
                <label className="fm-field">
                  <div className="fm-field-label">Color</div>
                  <input placeholder="color" value={vehicleForm.color} onChange={handleVehicleChange("color")} />
                </label>
              </div>
              <div className="fm-form-row">
                <label className="fm-field">
                  <div className="fm-field-label">Fuel type</div>
                  <input
                    placeholder="fuel_type"
                    value={vehicleForm.fuelType}
                    onChange={handleVehicleChange("fuelType")}
                  />
                </label>
                <label className="fm-field">
                  <div className="fm-field-label">Capacity</div>
                  <input
                    placeholder="capacity"
                    value={vehicleForm.capacity}
                    onChange={handleVehicleChange("capacity")}
                  />
                </label>
              </div>
              <div className="fm-form-row">
                <label className="fm-field">
                  <div className="fm-field-label">Insurance expiry</div>
                  <input
                    type="date"
                    value={vehicleForm.insuranceExpiry}
                    onChange={handleVehicleChange("insuranceExpiry")}
                  />
                </label>
                <label className="fm-field">
                  <div className="fm-field-label">Status</div>
                  <div className="fm-toggle">
                    <input
                      id="vehicle-active"
                      type="checkbox"
                      checked={vehicleForm.isActive}
                      onChange={handleVehicleChange("isActive")}
                    />
                    <label htmlFor="vehicle-active">
                      <span>{vehicleForm.isActive ? "Active" : "Inactive"}</span>
                    </label>
                  </div>
                </label>
              </div>
              {isDeviceChanged && (
                <label className="fm-field">
                  <div className="fm-field-label">Confirm reassignment</div>
                  <div className="fm-toggle">
                    <input
                      id="confirm-device-change"
                      type="checkbox"
                    checked={confirmDeviceChange}
                    onChange={(event) => setConfirmDeviceChange(event.target.checked)}
                  />
                  <label htmlFor="confirm-device-change">
                      <span className="fm-warning-danger">I understand this creates a new device ID and deactivates the old one.</span>
                    </label>
                  </div>
                </label>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
