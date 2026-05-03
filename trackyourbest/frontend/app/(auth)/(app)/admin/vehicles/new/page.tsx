"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { devicesApi, vehiclesApi, organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

type DeviceOption = { id: string; deviceName: string; isActive?: boolean | null; organizationId?: string | null };
type OrgOption = { id: string; name: string };

const parseDateInput = (value: string) => {
  if (!value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function AdminVehicleCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allDevices, setAllDevices] = useState<DeviceOption[]>([]);
  const [takenDeviceIds, setTakenDeviceIds] = useState<Set<string>>(new Set());
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  const [form, setForm] = useState({
    organizationId: "",
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
    inspectionExpiry: "",
    isActive: true,
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset device if org changes and current device no longer qualifies
      if (field === "organizationId" && prev.deviceId) {
        const device = allDevices.find((d) => d.id === prev.deviceId);
        if (device && value && device.organizationId !== value) {
          next.deviceId = "";
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [devRes, orgRes, vehRes] = await Promise.allSettled([
          fetch(devicesApi.listAll(apiBase), { credentials: "include" }),
          fetch(organizationsApi.list(apiBase), { credentials: "include" }),
          fetch(vehiclesApi.listAll(apiBase), { credentials: "include" }),
        ]);
        if (devRes.status === "fulfilled" && devRes.value.ok) {
          const data = await devRes.value.json();
          setAllDevices(Array.isArray(data) ? data : []);
        }
        if (orgRes.status === "fulfilled" && orgRes.value.ok) {
          const data = await orgRes.value.json();
          setOrgs(Array.isArray(data) ? data : []);
        }
        if (vehRes.status === "fulfilled" && vehRes.value.ok) {
          const data = await vehRes.value.json();
          const ids = new Set<string>(
            Array.isArray(data) ? data.filter((v: { deviceId?: string | null }) => v.deviceId).map((v: { deviceId: string }) => v.deviceId) : []
          );
          setTakenDeviceIds(ids);
        }
      } catch { /* ignore */ }
    };
    fetchData();
  }, []);

  const availableDevices = useMemo(() => {
    return allDevices.filter((d) => {
      if (d.isActive === false) return false;
      if (takenDeviceIds.has(d.id)) return false;
      if (form.organizationId && d.organizationId !== form.organizationId) return false;
      return true;
    });
  }, [allDevices, takenDeviceIds, form.organizationId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(vehiclesApi.create(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: form.organizationId || null,
          deviceId: form.deviceId || null,
          confirmDeviceReassignment: true,
          vehicleName: form.vehicleName.trim(),
          plateNumber: form.plateNumber.trim(),
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? Number(form.year) : null,
          color: form.color.trim() || null,
          fuelType: form.fuelType.trim() || null,
          capacity: form.capacity ? Number(form.capacity) : null,
          insuranceExpiry: parseDateInput(form.insuranceExpiry),
          inspectionExpiry: parseDateInput(form.inspectionExpiry),
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Create failed.");
      }
      router.push("/admin/vehicles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Vehicles</div>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/vehicles">Back to list</Link>
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create Vehicle"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>New Vehicle</strong>
          <div className="adm-list-sub">Register a new vehicle in the fleet.</div>
        </div>
      </div>

      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      <div className="adm-edit-grid">
        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">Vehicle Details</div></div>
          <div className="adm-form">
            <label className="adm-field">
              <div className="adm-field-label">Organization</div>
              <select className="adm-select" value={form.organizationId} onChange={handleChange("organizationId")}>
                <option value="">-- none --</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Device</div>
              <select className="adm-select" value={form.deviceId} onChange={handleChange("deviceId")}>
                <option value="">-- no device --</option>
                {availableDevices.map((d) => <option key={d.id} value={d.id}>{d.deviceName}</option>)}
              </select>
              {form.organizationId && availableDevices.length === 0 && (
                <div className="adm-list-sub" style={{ marginTop: 4, color: "var(--adm-muted, #888)" }}>
                  No available devices for this organization.
                </div>
              )}
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Vehicle name</div>
              <input placeholder="vehicle_name" value={form.vehicleName} onChange={handleChange("vehicleName")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Plate number</div>
              <input placeholder="plate_number" value={form.plateNumber} onChange={handleChange("plateNumber")} />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">Specs & Dates</div></div>
          <div className="adm-form">
            <div className="adm-form-row">
              <label className="adm-field">
                <div className="adm-field-label">Brand</div>
                <input placeholder="brand" value={form.brand} onChange={handleChange("brand")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Model</div>
                <input placeholder="model" value={form.model} onChange={handleChange("model")} />
              </label>
            </div>
            <div className="adm-form-row">
              <label className="adm-field">
                <div className="adm-field-label">Year</div>
                <input type="number" placeholder="year" value={form.year} onChange={handleChange("year")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Color</div>
                <input placeholder="color" value={form.color} onChange={handleChange("color")} />
              </label>
            </div>
            <div className="adm-form-row">
              <label className="adm-field">
                <div className="adm-field-label">Fuel type</div>
                <input placeholder="fuel_type" value={form.fuelType} onChange={handleChange("fuelType")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Capacity</div>
                <input type="number" placeholder="capacity" value={form.capacity} onChange={handleChange("capacity")} />
              </label>
            </div>
            <div className="adm-form-row">
              <label className="adm-field">
                <div className="adm-field-label">Insurance expiry</div>
                <input type="date" value={form.insuranceExpiry} onChange={handleChange("insuranceExpiry")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Inspection expiry</div>
                <input type="date" value={form.inspectionExpiry} onChange={handleChange("inspectionExpiry")} />
              </label>
            </div>
            <label className="adm-field">
              <div className="adm-field-label">Status</div>
              <div className="adm-toggle">
                <input id="veh-active" type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
                <label htmlFor="veh-active"><span>{form.isActive ? "Active" : "Inactive"}</span></label>
              </div>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
