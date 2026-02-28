"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { devicesApi, vehiclesApi } from "../../../../../utils/api";
import "../../fleet-manager.css";

type DeviceOption = {
  id: string;
  deviceName: string;
  isActive?: boolean | null;
};

type VehicleListItem = {
  id: string;
  deviceId?: string | null;
};

const ORG_ID = "0310ed50-86f2-468c-901d-6b3fcb113914";

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

export default function FleetManagerVehicleCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();

  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [busyDevices, setBusyDevices] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchDevices = async () => {
    try {
      const res = await fetch(devicesApi.list(ORG_ID, apiBase, true), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load devices.");
      }
      const data = (await res.json()) as DeviceOption[];
      const safe = Array.isArray(data) ? data : [];
      setDevices(safe.filter((item) => item.isActive !== false));
    } catch {
      setDevices([]);
    }
  };

  const fetchBusyDevices = async () => {
    try {
      const res = await fetch(vehiclesApi.list(ORG_ID, apiBase), {
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
          .filter((item) => item.deviceId)
          .map((item) => String(item.deviceId))
      );
      setBusyDevices(busy);
    } catch {
      setBusyDevices(new Set());
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchBusyDevices();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const safeTrim = (value: string | undefined | null) => (value ?? "").trim();
      const selectedDeviceId = safeTrim(vehicleForm.deviceId);

      const vehicleRes = await fetch(vehiclesApi.create(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: ORG_ID,
          deviceId: selectedDeviceId || null,
          // KRİTİK EKLEME: Eğer bir cihaz seçilmişse onay bilgisini true gönder
          confirmDeviceReassignment: !!selectedDeviceId, 
          vehicleName: safeTrim(vehicleForm.vehicleName),
          plateNumber: safeTrim(vehicleForm.plateNumber),
          brand: safeTrim(vehicleForm.brand) || null,
          model: safeTrim(vehicleForm.model) || null,
          year: safeTrim(vehicleForm.year) ? Number(vehicleForm.year) : null,
          color: safeTrim(vehicleForm.color) || null,
          fuelType: safeTrim(vehicleForm.fuelType) || null,
          capacity: safeTrim(vehicleForm.capacity) ? Number(vehicleForm.capacity) : null,
          insuranceExpiry: parseDateInput(vehicleForm.insuranceExpiry),
          isActive: vehicleForm.isActive,
        }),
      });

      if (!vehicleRes.ok) {
        const detail = await vehicleRes.text();
        throw new Error(detail || "Vehicle create failed.");
      }

      router.push("/fleet-manager/vehicles");
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
          <button className="fm-button fm-button-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create Vehicle"}
          </button>
        </div>
      </div>

      <div className="fm-edit-banner">
        <div>
          <strong>New Vehicle Profile</strong>
          <div className="fm-list-sub">Fill vehicle identity, specs and device assignment.</div>
        </div>
        <div className="fm-list-sub">Organization: {ORG_ID}</div>
      </div>

      {error && <div className="fm-note">{error}</div>}

      <div className="fm-edit-grid">
        <section className="fm-card">
          <div className="fm-card-header">
            <div className="fm-card-title">Vehicle Details</div>
          </div>
          <div className="fm-form">
            <label className="fm-field">
              <div className="fm-field-label">Device</div>
              <select
                className="fm-select"
                value={vehicleForm.deviceId}
                onChange={(event) => setVehicleForm((prev) => ({ ...prev, deviceId: event.target.value }))}
              >
                <option value="">-- no device --</option>
                {devices.map((device) => {
                  const isBusy = device.id && busyDevices.has(device.id);
                  if (isBusy) return null;
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
          </div>
        </section>
      </div>
    </div>
  );
}
