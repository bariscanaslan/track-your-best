"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { driversApi, usersApi, vehiclesApi } from "../../../../../utils/api";
import "../../admin.css";

type DriverDetail = {
  id: string;
  organizationId?: string | null;
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

type VehicleOption = { id: string; vehicleName: string };

const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const parseDateInput = (value: string) => {
  if (!value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} - ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminDriverEditPage() {
  const params = useParams();
  const driverId = String(params?.driverId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({ fullName: "", email: "", phone: "", avatarUrl: "" });
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

  const handleUserChange = (field: keyof typeof userForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleDriverChange = (field: keyof typeof driverForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setDriverForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchDriver = async () => {
    if (!driverId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(driversApi.getByIdAdmin(driverId, apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load driver.");
      const data: DriverDetail = await res.json();
      setDriver(data);
      setUserForm({ fullName: data.fullName ?? "", email: data.email ?? "", phone: data.phone ?? "", avatarUrl: data.avatarUrl ?? "" });
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
      setError(err instanceof Error ? err.message : "Failed to load driver.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDriver();
    const fetchVehicles = async () => {
      try {
        const res = await fetch(vehiclesApi.listAll(apiBase), { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setVehicles(Array.isArray(data) ? data : []);
      } catch { setVehicles([]); }
    };
    fetchVehicles();
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
          organizationId: driver.organizationId ?? null,
          userId: driver.userId ?? null,
          vehicleId: driverForm.vehicleId || null,
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
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Drivers</div>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/drivers">Back to list</Link>
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>Editing Driver</strong>
          <div className="adm-list-sub">Update user identity on the left, driver credentials on the right.</div>
        </div>
        <div className="adm-list-sub">Driver ID: {driverId}</div>
      </div>

      {isLoading && <div className="adm-note">Loading driver...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      {driver && (
        <div className="adm-edit-grid">
          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">User Details</div></div>
            <div className="adm-edit-avatar">
              <img src={userForm.avatarUrl || "/tyb-logo.png"} alt="Avatar" className="adm-avatar-lg" />
            </div>
            <div className="adm-section-sub">
              Created: {driver.userCreatedAt ? new Date(driver.userCreatedAt).toLocaleDateString() : "-"} • Last login: {formatDateTime(driver.lastLogin)}
            </div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Full name</div>
                <input placeholder="full_name" value={userForm.fullName} onChange={handleUserChange("fullName")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Email</div>
                <input type="email" placeholder="email" value={userForm.email} onChange={handleUserChange("email")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Phone</div>
                <input placeholder="phone" value={userForm.phone} onChange={handleUserChange("phone")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Avatar URL</div>
                <input placeholder="avatar_url" value={userForm.avatarUrl} onChange={handleUserChange("avatarUrl")} />
              </label>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Driver Details</div></div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Vehicle</div>
                <select className="adm-select" value={driverForm.vehicleId} onChange={handleDriverChange("vehicleId")}>
                  <option value="">-- no vehicle --</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleName}</option>)}
                </select>
              </label>
              <label className="adm-field">
                <div className="adm-field-label">License number</div>
                <input placeholder="license_number" value={driverForm.licenseNumber} onChange={handleDriverChange("licenseNumber")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">License type</div>
                <input placeholder="license_type" value={driverForm.licenseType} onChange={handleDriverChange("licenseType")} />
              </label>
              <div className="adm-form-row">
                <label className="adm-field">
                  <div className="adm-field-label">License expiry</div>
                  <input type="date" value={driverForm.licenseExpiry} onChange={handleDriverChange("licenseExpiry")} />
                </label>
                <label className="adm-field">
                  <div className="adm-field-label">Date of birth</div>
                  <input type="date" value={driverForm.dateOfBirth} onChange={handleDriverChange("dateOfBirth")} />
                </label>
              </div>
              <div className="adm-form-row">
                <label className="adm-field">
                  <div className="adm-field-label">Hire date</div>
                  <input type="date" value={driverForm.hireDate} onChange={handleDriverChange("hireDate")} />
                </label>
                <label className="adm-field">
                  <div className="adm-field-label">Status</div>
                  <div className="adm-toggle">
                    <input id="drv-active" type="checkbox" checked={driverForm.isActive} onChange={handleDriverChange("isActive")} />
                    <label htmlFor="drv-active"><span>{driverForm.isActive ? "Active" : "Inactive"}</span></label>
                  </div>
                </label>
              </div>
              <label className="adm-field">
                <div className="adm-field-label">Emergency contact</div>
                <input placeholder="emergency_contact_name" value={driverForm.emergencyContactName} onChange={handleDriverChange("emergencyContactName")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Emergency phone</div>
                <input placeholder="emergency_contact_phone" value={driverForm.emergencyContactPhone} onChange={handleDriverChange("emergencyContactPhone")} />
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
