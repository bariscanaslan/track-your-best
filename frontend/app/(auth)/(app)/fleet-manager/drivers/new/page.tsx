// app/(auth)/(app)/fleet-manager/drivers/new/page.tsx

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { driversApi, vehiclesApi } from "../../../../../utils/api";
import "../../fleet-manager.css";

type VehicleOption = {
  id: string;
  vehicleName: string;
};

type DriverListItem = {
  id: string;
  vehicleId?: string | null;
};

const ORG_ID = "0310ed50-86f2-468c-901d-6b3fcb113914";

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

export default function FleetManagerDriverCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [busyVehicles, setBusyVehicles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });

  const [driverForm, setDriverForm] = useState({
    vehicleId: "",
    licenseNumber: "",
    licenseType: "",
    licenseExpiry: "",
    dateOfBirth: "",
    hireDate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    isActive: true,
  });

  const handleUserChange = (field: keyof typeof userForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleDriverChange = (field: keyof typeof driverForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDriverForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch(vehiclesApi.list(ORG_ID, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load vehicles.");
      }
      const data = (await res.json()) as VehicleOption[];
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
    }
  };

  const fetchBusyVehicles = async () => {
    try {
      const res = await fetch(driversApi.list(ORG_ID, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load drivers.");
      }
      const data = (await res.json()) as DriverListItem[];
      const busy = new Set(
        (Array.isArray(data) ? data : [])
          .filter((item) => item.vehicleId)
          .map((item) => String(item.vehicleId))
      );
      setBusyVehicles(busy);
    } catch {
      setBusyVehicles(new Set());
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchBusyVehicles();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const safeTrim = (value: string | undefined | null) => (value ?? "").trim();

      const driverRes = await fetch(driversApi.create(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: ORG_ID,
          username: safeTrim(userForm.username),
          fullName: safeTrim(userForm.fullName),
          email: safeTrim(userForm.email),
          phone: safeTrim(userForm.phone) || null,
          avatarUrl: safeTrim(userForm.avatarUrl) || null,
          vehicleId: safeTrim(driverForm.vehicleId) || null,
          licenseNumber: safeTrim(driverForm.licenseNumber),
          licenseType: safeTrim(driverForm.licenseType) || null,
          licenseExpiry: parseDateInput(driverForm.licenseExpiry),
          dateOfBirth: parseDateInput(driverForm.dateOfBirth),
          hireDate: parseDateInput(driverForm.hireDate),
          emergencyContactName: safeTrim(driverForm.emergencyContactName) || null,
          emergencyContactPhone: safeTrim(driverForm.emergencyContactPhone) || null,
          isActive: driverForm.isActive,
        }),
      });
      if (!driverRes.ok) {
        const detail = await driverRes.text();
        throw new Error(detail || "Driver create failed.");
      }

      router.push("/fleet-manager/drivers");
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
        <div className="fm-title">Drivers</div>
        <div className="fm-actions">
          <Link className="fm-button" href="/fleet-manager/drivers">
            Back to list
          </Link>
          <button className="fm-button fm-button-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create Driver"}
          </button>
        </div>
      </div>

      <div className="fm-edit-banner">
        <div>
          <strong>New Driver Profile</strong>
          <div className="fm-list-sub">
            A user with role `driver` will be created automatically.
          </div>
        </div>
        <div className="fm-list-sub">Organization: {ORG_ID}</div>
      </div>

      {error && <div className="fm-note">{error}</div>}

      <div className="fm-edit-grid">
        <section className="fm-card">
          <div className="fm-card-header">
            <div className="fm-card-title">User Details</div>
          </div>
          <div className="fm-edit-avatar">
            <img
              src={userForm.avatarUrl || "/tyb-logo.png"}
              alt={userForm.fullName || "User avatar"}
              className="fm-avatar-lg"
            />
          </div>
          <div className="fm-section-sub">
            User will be created with password `Tyb.1905.` and role `driver`.
          </div>
          <div className="fm-form">
            <label className="fm-field">
              <div className="fm-field-label">Username</div>
              <input placeholder="username" value={userForm.username} onChange={handleUserChange("username")} />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">Full name</div>
              <input placeholder="full_name" value={userForm.fullName} onChange={handleUserChange("fullName")} />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">Email</div>
              <input placeholder="email" value={userForm.email} onChange={handleUserChange("email")} />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">Phone</div>
              <input placeholder="phone" value={userForm.phone} onChange={handleUserChange("phone")} />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">Avatar URL</div>
              <input placeholder="avatar_url" value={userForm.avatarUrl} onChange={handleUserChange("avatarUrl")} />
            </label>
          </div>
        </section>

        <section className="fm-card">
          <div className="fm-card-header">
            <div className="fm-card-title">Driver Details</div>
          </div>
          <div className="fm-section-sub">Driver-specific credentials and assignments.</div>
          <div className="fm-form">
            <label className="fm-field">
              <div className="fm-field-label">Vehicle</div>
              <select
                className="fm-select"
                value={driverForm.vehicleId}
                onChange={(event) =>
                  setDriverForm((prev) => ({ ...prev, vehicleId: event.target.value }))
                }
              >
                <option value="">-- no vehicle --</option>
                {vehicles.map((vehicle) => {
                  const isBusy = vehicle.id && busyVehicles.has(vehicle.id);
                  if (isBusy) return null;
                  return (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicleName}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="fm-field">
              <div className="fm-field-label">License number</div>
              <input
                placeholder="license_number"
                value={driverForm.licenseNumber}
                onChange={handleDriverChange("licenseNumber")}
              />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">License type</div>
              <input
                placeholder="license_type"
                value={driverForm.licenseType}
                onChange={handleDriverChange("licenseType")}
              />
            </label>
            <div className="fm-form-row">
              <label className="fm-field">
                <div className="fm-field-label">License expiry</div>
                <input
                  type="date"
                  value={driverForm.licenseExpiry}
                  onChange={handleDriverChange("licenseExpiry")}
                />
              </label>
              <label className="fm-field">
                <div className="fm-field-label">Date of birth</div>
                <input
                  type="date"
                  value={driverForm.dateOfBirth}
                  onChange={handleDriverChange("dateOfBirth")}
                />
              </label>
            </div>
            <div className="fm-form-row">
              <label className="fm-field">
                <div className="fm-field-label">Hire date</div>
                <input
                  type="date"
                  value={driverForm.hireDate}
                  onChange={handleDriverChange("hireDate")}
                />
              </label>
              <label className="fm-field">
                <div className="fm-field-label">Status</div>
                <div className="fm-toggle">
                  <input
                    id="driver-active"
                    type="checkbox"
                    checked={driverForm.isActive}
                    onChange={handleDriverChange("isActive")}
                  />
                  <label htmlFor="driver-active">
                    <span>{driverForm.isActive ? "Active" : "Inactive"}</span>
                  </label>
                </div>
              </label>
            </div>
            <label className="fm-field">
              <div className="fm-field-label">Emergency contact name</div>
              <input
                placeholder="emergency_contact_name"
                value={driverForm.emergencyContactName}
                onChange={handleDriverChange("emergencyContactName")}
              />
            </label>
            <label className="fm-field">
              <div className="fm-field-label">Emergency contact phone</div>
              <input
                placeholder="emergency_contact_phone"
                value={driverForm.emergencyContactPhone}
                onChange={handleDriverChange("emergencyContactPhone")}
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
