"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { devicesApi } from "../../../../utils/api";
import "../admin.css";

type DeviceRow = {
  id: string;
  organizationId?: string | null;
  organizationName?: string | null;
  deviceName: string;
  deviceIdentifier: string;
  deviceModel?: string | null;
  mqttUsername?: string | null;
  mqttPassword?: string | null;
  secretKey?: string | null;
  installationDate?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  imei?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
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

function MaskedValue({ value, label }: { value?: string | null; label: string }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <span className="adm-list-card-value">-</span>;
  return (
    <div className="adm-list-card-value" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", lineHeight: 1.4 }}>
        {visible ? value : "••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--adm-muted, #888)", fontSize: 11, textAlign: "left", width: "fit-content" }}
        title={visible ? `Hide ${label}` : `Show ${label}`}
      >
        {visible ? "▲ hide" : "▼ show"}
      </button>
    </div>
  );
}

export default function AdminDevicesPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "deviceName" | "deviceIdentifier" | "imei" | "ipAddress" | "mqttUsername">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "deviceName" | "deviceIdentifier" | "imei" | "ipAddress" | "mqttUsername">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(devicesApi.listAll(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load devices.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.deviceName || "").toLowerCase().localeCompare((b.deviceName || "").toLowerCase())
    );
    const visible = showInactive ? sorted : sorted.filter((d) => d.isActive !== false);
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((d) => {
      const fv = (v?: string | null) => (v ?? "").toLowerCase();
      if (appliedField === "deviceName") return fv(d.deviceName).includes(q);
      if (appliedField === "deviceIdentifier") return fv(d.deviceIdentifier).includes(q);
      if (appliedField === "imei") return fv(d.imei).includes(q);
      if (appliedField === "ipAddress") return fv(d.ipAddress).includes(q);
      if (appliedField === "mqttUsername") return fv(d.mqttUsername).includes(q);
      return [d.deviceName, d.deviceIdentifier, d.imei, d.ipAddress, d.mqttUsername].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, appliedQuery, appliedField, showInactive]);

  useEffect(() => { setPage(1); }, [appliedQuery, appliedField, showInactive, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this device? This cannot be undone.")) return;
    try {
      const res = await fetch(devicesApi.remove(id, apiBase), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Devices</div>
        <div className="adm-actions">
          <label className="adm-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span style={{ fontSize: 11 }}>Show Inactive Devices</span>
          </label>
          <select
            className="adm-search-select"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as typeof searchField)}
          >
            <option value="all">All fields</option>
            <option value="deviceName">Device name</option>
            <option value="deviceIdentifier">Identifier</option>
            <option value="imei">IMEI</option>
            <option value="ipAddress">IP address</option>
            <option value="mqttUsername">MQTT user</option>
          </select>
          <input
            className="adm-search"
            placeholder="Search devices"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setAppliedField(searchField); setAppliedQuery(query); } }}
          />
          <button className="adm-button" type="button" onClick={() => { setAppliedField(searchField); setAppliedQuery(query); }} title="Search">
            <FaSearch size={13} />
          </button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); setSearchField("all"); setAppliedField("all"); }} title="Reset">
            <FaUndo size={13} />
          </button>
          <Link className="adm-button adm-button-primary" href="/admin/devices/new">
            Add Device
          </Link>
        </div>
      </div>

      <div className="adm-list">
        {pagedRows.map((device) => (
          <div key={device.id} className="adm-list-row">
            <div className="adm-list-top">
              <div className="adm-list-identity">
                <div className="adm-nav-card-icon" style={{ width: 40, height: 40, fontSize: 18, borderRadius: 10 }}>📡</div>
                <div>
                  <div className="adm-list-title-row">
                    <div className="adm-list-title">{device.deviceName || "-"}</div>
                    <span className={`adm-status${device.isActive === false ? " is-inactive" : ""}`}>
                      {device.isActive === false ? "inactive" : "active"}
                    </span>
                    {device.deviceModel && <span className="adm-list-pill">{device.deviceModel}</span>}
                  </div>
                  <div className="adm-list-sub">ID: {device.id}</div>
                  {(device.organizationName || device.organizationId) && (
                    <div className="adm-list-sub">Org: {device.organizationName || device.organizationId}</div>
                  )}
                </div>
              </div>
              <div className="adm-list-actions">
                <Link className="adm-link" href={`/admin/devices/${device.id}`}>Edit</Link>
                <button className="adm-link adm-link-danger" type="button" onClick={() => handleDelete(device.id)}>Delete</button>
              </div>
            </div>

            <div className="adm-list-details" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Identifier</div>
                <div className="adm-list-card-value" style={{ fontFamily: "monospace", fontSize: 12 }}>{device.deviceIdentifier || "-"}</div>
                <div className="adm-list-card-sub">IMEI: {device.imei || "-"}</div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">MQTT Username</div>
                <div className="adm-list-card-value" style={{ fontFamily: "monospace", fontSize: 12 }}>{device.mqttUsername || "-"}</div>
                <div className="adm-list-card-sub" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Password: <MaskedValue value={device.mqttPassword} label="password" />
                </div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Secret Key</div>
                <MaskedValue value={device.secretKey} label="secret key" />
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Network</div>
                <div className="adm-list-card-value">{device.ipAddress || "-"}</div>
                <div className="adm-list-card-sub">Signal: {device.signalStrength ?? "-"}</div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Battery / Last seen</div>
                <div className="adm-list-card-value">{device.batteryLevel != null ? `${device.batteryLevel}%` : "-"}</div>
                <div className="adm-list-card-sub">{formatDateTime(device.lastSeenAt)}</div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Installation</div>
                <div className="adm-list-card-value">{formatDate(device.installationDate)}</div>
                <div className="adm-list-card-sub">Last maint.: {formatDate(device.lastMaintenanceDate)}</div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Next Maintenance</div>
                <div className="adm-list-card-value">{formatDate(device.nextMaintenanceDate)}</div>
              </div>

              <div className="adm-list-card">
                <div className="adm-list-card-title">Audit</div>
                <div className="adm-list-card-value">Created: {formatDate(device.createdAt)}</div>
                <div className="adm-list-card-sub">Updated: {formatDate(device.updatedAt)}</div>
                {device.createdByName && <div className="adm-list-card-sub">By: {device.createdByName}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-pagination">
        <div className="adm-pagination-info">
          {filteredRows.length === 0 ? "No results" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length}`}
        </div>
        <div className="adm-pagination-controls">
          <button className="adm-button" type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>First</button>
          <button className="adm-button" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
          <span className="adm-pagination-page">Page {currentPage} / {pageCount}</span>
          <button className="adm-button" type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}>Next</button>
          <button className="adm-button" type="button" onClick={() => setPage(pageCount)} disabled={currentPage === pageCount}>Last</button>
        </div>
      </div>

      {isLoading && <div className="adm-note">Loading devices...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
