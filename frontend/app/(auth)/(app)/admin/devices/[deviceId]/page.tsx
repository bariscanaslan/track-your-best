"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { devicesApi, organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

/** Generates a cryptographically secure random HMAC key (32 bytes = 256 bits) encoded as hex. */
function generateHmacKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type DeviceDetail = {
  id: string;
  organizationId?: string | null;
  organizationName?: string | null;
  deviceName: string;
  deviceIdentifier: string;
  deviceModel?: string | null;
  mqttUsername?: string | null;
  mqttPassword?: string | null;
  secretKey?: string | null;
  imei?: string | null;
  ipAddress?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  installationDate?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  lastSeenAt?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

type OrgOption = { id: string; name: string };

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

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${formatDate(value)}`;
};

export default function AdminDeviceEditPage() {
  const params = useParams();
  const deviceId = String(params?.deviceId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    organizationId: "",
    deviceName: "",
    deviceIdentifier: "",
    deviceModel: "",
    mqttUsername: "",
    mqttPassword: "",
    secretKey: "",
    imei: "",
    ipAddress: "",
    installationDate: "",
    lastMaintenanceDate: "",
    nextMaintenanceDate: "",
    isActive: true,
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchDevice = async () => {
    if (!deviceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(devicesApi.getById(deviceId, apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load device.");
      const data: DeviceDetail = await res.json();
      setDevice(data);
      setForm({
        organizationId: data.organizationId ?? "",
        deviceName: data.deviceName ?? "",
        deviceIdentifier: data.deviceIdentifier ?? "",
        deviceModel: data.deviceModel ?? "",
        mqttUsername: data.mqttUsername ?? "",
        mqttPassword: data.mqttPassword ?? "",
        secretKey: data.secretKey ?? "",
        imei: data.imei ?? "",
        ipAddress: data.ipAddress ?? "",
        installationDate: toDateInput(data.installationDate),
        lastMaintenanceDate: toDateInput(data.lastMaintenanceDate),
        nextMaintenanceDate: toDateInput(data.nextMaintenanceDate),
        isActive: data.isActive ?? true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await fetch(organizationsApi.list(apiBase), { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setOrgs(Array.isArray(data) ? data : []);
    } catch { setOrgs([]); }
  };

  useEffect(() => { fetchDevice(); fetchOrgs(); }, [deviceId]);

  const handleSave = async () => {
    if (!device) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(devicesApi.update(device.id, apiBase), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: form.organizationId || null,
          deviceName: form.deviceName.trim(),
          deviceIdentifier: form.deviceIdentifier.trim(),
          deviceModel: form.deviceModel.trim() || null,
          mqttUsername: form.mqttUsername.trim() || null,
          mqttPassword: form.mqttPassword.trim() || null,
          secretKey: form.secretKey.trim() || null,
          imei: form.imei.trim() || null,
          ipAddress: form.ipAddress.trim() || null,
          installationDate: parseDateInput(form.installationDate),
          lastMaintenanceDate: parseDateInput(form.lastMaintenanceDate),
          nextMaintenanceDate: parseDateInput(form.nextMaintenanceDate),
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Update failed.");
      }
      await fetchDevice();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Devices</div>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/devices">Back to list</Link>
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>Editing Device</strong>
          <div className="adm-list-sub">Update device identity, MQTT credentials and maintenance info.</div>
        </div>
        <div className="adm-list-sub">Device ID: {deviceId}</div>
      </div>

      {isLoading && <div className="adm-note">Loading device...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      {device && (
        <div className="adm-edit-grid">
          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Device Identity</div></div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Organization</div>
                <select className="adm-select" value={form.organizationId} onChange={handleChange("organizationId")}>
                  <option value="">-- none --</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Device name</div>
                <input placeholder="device_name" value={form.deviceName} onChange={handleChange("deviceName")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Identifier</div>
                <input placeholder="device_identifier" value={form.deviceIdentifier} onChange={handleChange("deviceIdentifier")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Model</div>
                <input placeholder="device_model" value={form.deviceModel} onChange={handleChange("deviceModel")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">IMEI</div>
                <input placeholder="imei" value={form.imei} onChange={handleChange("imei")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">IP address</div>
                <input placeholder="ip_address" value={form.ipAddress} onChange={handleChange("ipAddress")} />
              </label>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">MQTT Credentials</div></div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">MQTT username</div>
                <input placeholder="mqtt_username" value={form.mqttUsername} onChange={handleChange("mqttUsername")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">MQTT password</div>
                <input type="text" placeholder="mqtt_password" value={form.mqttPassword} onChange={handleChange("mqttPassword")} autoComplete="off" />
              </label>
              <div className="adm-field">
                <div className="adm-field-label">Secret key</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    placeholder="secret_key"
                    value={form.secretKey}
                    onChange={handleChange("secretKey")}
                    autoComplete="off"
                    style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <button
                    type="button"
                    className="adm-button"
                    onClick={() => setForm((prev) => ({ ...prev, secretKey: generateHmacKey() }))}
                    title="Generate a secure random HMAC-SHA256 key (256-bit hex)"
                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    Generate
                  </button>
                </div>
                <div className="adm-list-sub" style={{ marginTop: 4 }}>
                  Auto-generates a 256-bit (32-byte) hex key for HMAC-SHA256.
                </div>
              </div>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Maintenance & Status</div></div>
            <div className="adm-form">
              <div className="adm-form-row">
                <label className="adm-field">
                  <div className="adm-field-label">Installation date</div>
                  <input type="date" value={form.installationDate} onChange={handleChange("installationDate")} />
                </label>
                <label className="adm-field">
                  <div className="adm-field-label">Last maintenance</div>
                  <input type="date" value={form.lastMaintenanceDate} onChange={handleChange("lastMaintenanceDate")} />
                </label>
              </div>
              <label className="adm-field">
                <div className="adm-field-label">Next maintenance</div>
                <input type="date" value={form.nextMaintenanceDate} onChange={handleChange("nextMaintenanceDate")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Status</div>
                <div className="adm-toggle">
                  <input id="dev-active" type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
                  <label htmlFor="dev-active"><span>{form.isActive ? "Active" : "Inactive"}</span></label>
                </div>
              </label>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Read-only Info</div></div>
            <div className="adm-form">
              <div className="adm-form-row">
                <label className="adm-field">
                  <div className="adm-field-label">Battery level</div>
                  <input readOnly disabled value={device.batteryLevel != null ? `${device.batteryLevel}%` : "-"} />
                </label>
                <label className="adm-field">
                  <div className="adm-field-label">Signal strength</div>
                  <input readOnly disabled value={device.signalStrength != null ? String(device.signalStrength) : "-"} />
                </label>
              </div>
              <label className="adm-field">
                <div className="adm-field-label">Last seen</div>
                <input readOnly disabled value={formatDateTime(device.lastSeenAt)} />
              </label>
              <div className="adm-form-row">
                <label className="adm-field">
                  <div className="adm-field-label">Created at</div>
                  <input readOnly disabled value={formatDateTime(device.createdAt)} />
                </label>
                <label className="adm-field">
                  <div className="adm-field-label">Updated at</div>
                  <input readOnly disabled value={formatDateTime(device.updatedAt)} />
                </label>
              </div>
              <label className="adm-field">
                <div className="adm-field-label">Created by</div>
                <input readOnly disabled value={device.createdByName ?? device.createdBy ?? "-"} />
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
