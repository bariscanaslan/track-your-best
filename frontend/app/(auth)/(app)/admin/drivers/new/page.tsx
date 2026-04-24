"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AvatarUploadField from "@/app/components/forms/AvatarUploadField";
import { useStagedImage } from "@/app/hooks/useStagedImage";
import { uploadProfileImage } from "@/app/utils/media";
import { driversApi, vehiclesApi, organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

type VehicleOption = { id: string; vehicleName: string };
type OrgOption = { id: string; name: string };
type DriverListItem = { id: string; vehicleId?: string | null };

const parseDateInput = (value: string) => {
  if (!value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function AdminDriverCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [busyVehicles, setBusyVehicles] = useState<Set<string>>(new Set());
  const { file: avatarFile, previewUrl: avatarPreviewUrl, fileName: avatarFileName, hasStagedFile, stageFile, clearStagedFile } = useStagedImage();

  const [userForm, setUserForm] = useState({
    username: "",
    fullName: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });

  const [driverForm, setDriverForm] = useState({
    organizationId: "",
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

  const handleRemovePhoto = () => {
    clearStagedFile();
    setUserForm((prev) => ({ ...prev, avatarUrl: "" }));
  };

  const handleDriverChange = (field: keyof typeof driverForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setDriverForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehRes, orgRes, drvRes] = await Promise.allSettled([
          fetch(vehiclesApi.listAll(apiBase), { credentials: "include" }),
          fetch(organizationsApi.list(apiBase), { credentials: "include" }),
          fetch(driversApi.listAll(apiBase), { credentials: "include" }),
        ]);
        if (vehRes.status === "fulfilled" && vehRes.value.ok) {
          const data = await vehRes.value.json();
          setVehicles(Array.isArray(data) ? data : []);
        }
        if (orgRes.status === "fulfilled" && orgRes.value.ok) {
          const data = await orgRes.value.json();
          setOrgs(Array.isArray(data) ? data : []);
        }
        if (drvRes.status === "fulfilled" && drvRes.value.ok) {
          const data: DriverListItem[] = await drvRes.value.json();
          const busy = new Set((Array.isArray(data) ? data : []).filter((d) => d.vehicleId).map((d) => String(d.vehicleId)));
          setBusyVehicles(busy);
        }
      } catch { /* ignore */ }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const avatarUrl = avatarFile
        ? (await uploadProfileImage(avatarFile, apiBase)).relativeUrl
        : userForm.avatarUrl.trim();

      const res = await fetch(driversApi.create(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: driverForm.organizationId || null,
          username: userForm.username.trim(),
          fullName: userForm.fullName.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          avatarUrl,
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
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Create failed.");
      }
      router.push("/admin/drivers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
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
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create Driver"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>New Driver</strong>
          <div className="adm-list-sub">A user with role `driver` will be created automatically.</div>
        </div>
      </div>

      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      <div className="adm-edit-grid">
        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">User Details</div></div>
          <AvatarUploadField
            apiBase={apiBase}
            theme="adm"
            value={userForm.avatarUrl}
            stagedPreviewUrl={avatarPreviewUrl}
            stagedFileName={avatarFileName}
            hasStagedFile={hasStagedFile}
            onFileSelect={stageFile}
            onClearSelection={clearStagedFile}
            onRemovePhoto={handleRemovePhoto}
            previewAlt={userForm.fullName || "Driver avatar"}
            disabled={saving}
          />
          <div className="adm-section-sub">User will be created with role `driver`.</div>
          <div className="adm-form">
            <label className="adm-field">
              <div className="adm-field-label">Username</div>
              <input placeholder="Enter the username" value={userForm.username} onChange={handleUserChange("username")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Full name</div>
              <input placeholder="Enter the full name" value={userForm.fullName} onChange={handleUserChange("fullName")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Email</div>
              <input type="email" placeholder="Enter the email" value={userForm.email} onChange={handleUserChange("email")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Phone</div>
              <input placeholder="Enter the phone number" value={userForm.phone} onChange={handleUserChange("phone")} />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">Driver Details</div></div>
          <div className="adm-form">
            <label className="adm-field">
              <div className="adm-field-label">Organization</div>
              <select className="adm-select" value={driverForm.organizationId} onChange={handleDriverChange("organizationId")}>
                <option value="">-- none --</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Vehicle</div>
              <select className="adm-select" value={driverForm.vehicleId} onChange={handleDriverChange("vehicleId")}>
                <option value="">-- no vehicle --</option>
                {vehicles.map((v) => {
                  if (busyVehicles.has(v.id)) return null;
                  return <option key={v.id} value={v.id}>{v.vehicleName}</option>;
                })}
              </select>
            </label>
            <label className="adm-field">
              <div className="adm-field-label">License number</div>
              <input placeholder="Enter the license number" value={driverForm.licenseNumber} onChange={handleDriverChange("licenseNumber")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">License type</div>
              <input placeholder="Enter the license type" value={driverForm.licenseType} onChange={handleDriverChange("licenseType")} />
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
              <input placeholder="Enter the license number emergency contact name" value={driverForm.emergencyContactName} onChange={handleDriverChange("emergencyContactName")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Emergency phone</div>
              <input placeholder="Enter the emergency contact phone" value={driverForm.emergencyContactPhone} onChange={handleDriverChange("emergencyContactPhone")} />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
