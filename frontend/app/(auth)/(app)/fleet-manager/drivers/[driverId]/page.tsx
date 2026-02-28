// app/(auth)/(app)/fleet-manager/drivers/[driverId]/page.tsx

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { driversApi, usersApi, vehiclesApi } from "../../../../../utils/api";
import "../../fleet-manager.css";

type DriverDetail = {
  id: string;
  vehicleId?: string | null;
  vehicleName?: string | null;
  licenseNumber: string;
  licenseType?: string | null;
  licenseExpiry?: string | null;
  dateOfBirth?: string | null;
  hireDate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isActive?: boolean | null;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  userCreatedAt?: string | null;
  lastLogin?: string | null;
};

type VehicleOption = {
  id: string;
  vehicleName: string;
  isActive?: boolean | null;
};

type DriverListItem = {
  id: string;
  vehicleId?: string | null;
};

const ORG_ID = "0310ed50-86f2-468c-901d-6b3fcb113914";

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes} - ${formatDate(value)}`;
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

export default function FleetManagerDriverEditPage() {
  const params = useParams();
  const driverId = String(params?.driverId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [busyVehicles, setBusyVehicles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userForm, setUserForm] = useState({
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

  const fetchDriver = async () => {
    if (!driverId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(driversApi.getById(driverId, ORG_ID, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load driver.");
      }
      const data = (await res.json()) as DriverDetail;
      setDriver(data);
      setUserForm({
        fullName: data.fullName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        avatarUrl: data.avatarUrl ?? "",
      });
      setDriverForm({
        vehicleId: data.vehicleId ?? "",
        licenseNumber: data.licenseNumber ?? "",
        licenseType: data.licenseType ?? "",
        licenseExpiry: toDateInput(data.licenseExpiry),
        dateOfBirth: toDateInput(data.dateOfBirth),
        hireDate: toDateInput(data.hireDate),
        emergencyContactName: data.emergencyContactName ?? "",
        emergencyContactPhone: data.emergencyContactPhone ?? "",
        isActive: data.isActive ?? true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load driver.";
      setError(message);
      setDriver(null);
    } finally {
      setIsLoading(false);
    }
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
          .filter((item) => item.vehicleId && item.id !== driverId)
          .map((item) => String(item.vehicleId))
      );
      setBusyVehicles(busy);
    } catch {
      setBusyVehicles(new Set());
    }
  };

  useEffect(() => {
    fetchDriver();
    fetchVehicles();
    fetchBusyVehicles();
  }, [driverId]);

  const handleSave = async () => {
    if (!driver) return;
    setSaving(true);
    setError(null);
    try {
      if (driver.userId) {
        const userRes = await fetch(usersApi.update(driver.userId, apiBase), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fullName: userForm.fullName.trim() || null,
            email: userForm.email.trim() || null,
            phone: userForm.phone.trim() || null,
            avatarUrl: userForm.avatarUrl.trim() || null,
          }),
        });
        if (!userRes.ok) {
          const detail = await userRes.text();
          throw new Error(detail || "User update failed.");
        }
      }

      const driverRes = await fetch(driversApi.update(driver.id, apiBase), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: ORG_ID,
          userId: driver.userId ?? null,
          vehicleId: driverForm.vehicleId.trim() || null,
          licenseNumber: driverForm.licenseNumber.trim(),
          licenseType: driverForm.licenseType.trim() || null,
          licenseExpiry: parseDateInput(driverForm.licenseExpiry),
          dateOfBirth: parseDateInput(driverForm.dateOfBirth),
          hireDate: parseDateInput(driverForm.hireDate),
          emergencyContactName: driverForm.emergencyContactName.trim() || null,
          emergencyContactPhone: driverForm.emergencyContactPhone.trim() || null,
          isActive: driverForm.isActive,
        }),
      });
      if (!driverRes.ok) {
        const detail = await driverRes.text();
        throw new Error(detail || "Driver update failed.");
      }

      await fetchDriver();
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="fm-edit-banner">
        <div>
          <strong>Editing Driver Profile</strong>
          <div className="fm-list-sub">
            Update user identity on the left, driver credentials on the right.
          </div>
        </div>
        <div className="fm-list-sub">Driver ID: {driverId}</div>
      </div>

      {isLoading && <div className="fm-note">Loading driver...</div>}
      {error && <div className="fm-note">{error}</div>}

      {driver && (
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
            <div className="fm-section-sub">This section updates the driver’s user profile.</div>
            <div className="fm-form">
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
            <div className="fm-note">
              Created: {formatDate(driver.userCreatedAt ?? null)} • Last login: {formatDateTime(driver.lastLogin ?? null)}
            </div>
          </section>

          <section className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">Driver Details</div>
            </div>
            <div className="fm-section-sub">Driver-specific credentials and assignments.</div>
            <div className="fm-form">
              <label className="fm-field">
                <div className="fm-field-label">Vehicle ID</div>
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
                    const isCurrent = vehicle.id === driverForm.vehicleId;
                    if (isBusy && !isCurrent) return null;
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
      )}
    </div>
  );
}
