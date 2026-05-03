"use client";

import { useEffect, useMemo, useState } from "react";
import { devicesApi } from "../../../../utils/api";
import { useAuth } from "../../../../context/AuthContext";
import "../fleet-manager.css";

type DeviceRow = {
  id: string;
  deviceName: string;
  deviceIdentifier: string;
  installationDate?: string | null;
  signalStrength?: number | null;
  imei?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
  isActive?: boolean | null;
};

const fields = [
  { key: "id", label: "id" },
  { key: "deviceName", label: "device_name" },
  { key: "deviceIdentifier", label: "device_identifier" },
  { key: "installationDate", label: "installation_date" },
  { key: "signalStrength", label: "signal_strength" },
  { key: "imei", label: "imei" },
  { key: "ipAddress", label: "ip_address" },
  { key: "lastSeenAt", label: "last_seen_at" },
] as const;

const formatDate = (value?: string | null) => {
  if (!value) return "-";
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
  const parts = trimmed.split("/").map((part) => part.trim());
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
      return new Date(year, month - 1, day).toISOString();
    }
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

const parseDateTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [timePart, datePart] = trimmed.split("-").map((part) => part.trim());
  if (timePart && datePart) {
    const [hh, mm] = timePart.split(":").map((part) => Number(part.trim()));
    const [dd, mo, yyyy] = datePart.split("/").map((part) => Number(part.trim()));
    if (
      !Number.isNaN(hh) &&
      !Number.isNaN(mm) &&
      !Number.isNaN(dd) &&
      !Number.isNaN(mo) &&
      !Number.isNaN(yyyy)
    ) {
      return new Date(yyyy, mo - 1, dd, hh, mm).toISOString();
    }
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
};

export default function FleetManagerDevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "deviceName" | "deviceIdentifier" | "imei" | "ipAddress">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "deviceName" | "deviceIdentifier" | "imei" | "ipAddress">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(devicesApi.list(orgId, apiBase, true), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load devices.");
      }
      const data = (await res.json()) as DeviceRow[];
      const safe = Array.isArray(data) ? data : [];
      setRows(safe.filter((item) => item.isActive !== false));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load devices.";
      setError(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aName = (a.deviceName || "").toLowerCase();
      const bName = (b.deviceName || "").toLowerCase();
      if (aName && bName) return aName.localeCompare(bName);
      if (aName) return -1;
      if (bName) return 1;
      return (a.deviceIdentifier || "").localeCompare(b.deviceIdentifier || "");
    });

    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;

    const fieldValue = (field?: string | null) => (field ?? "").toLowerCase();

    return sorted.filter((device) => {
      if (appliedField === "deviceName") return fieldValue(device.deviceName).includes(q);
      if (appliedField === "deviceIdentifier") return fieldValue(device.deviceIdentifier).includes(q);
      if (appliedField === "imei") return fieldValue(device.imei).includes(q);
      if (appliedField === "ipAddress") return fieldValue(device.ipAddress).includes(q);

      const haystack = [
        device.deviceName,
        device.deviceIdentifier,
        device.imei,
        device.ipAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, appliedQuery, appliedField]);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, appliedField, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Devices</div>
        <div className="fm-actions">
          <select
            className="fm-search-select"
            value={searchField}
            onChange={(event) =>
              setSearchField(event.target.value as "all" | "deviceName" | "deviceIdentifier" | "imei" | "ipAddress")
            }
          >
            <option value="all">All fields</option>
            <option value="deviceName">Device name</option>
            <option value="deviceIdentifier">Identifier</option>
            <option value="imei">IMEI</option>
            <option value="ipAddress">IP address</option>
          </select>
          <input
            className="fm-search"
            placeholder="Search devices"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="fm-button"
            type="button"
            onClick={() => {
              setAppliedField(searchField);
              setAppliedQuery(query);
            }}
          >
            Search
          </button>
          <button
            className="fm-button"
            type="button"
            onClick={() => {
              setQuery("");
              setAppliedQuery("");
              setSearchField("all");
              setAppliedField("all");
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="fm-grid">
        {pagedRows.map((device, idx) => (
          <div key={idx} className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">{device.deviceName || "-"}</div>
            </div>

            {fields.map((field) => (
              <div key={field.key} className="fm-field">
                <div className="fm-field-label">{field.label}</div>
                <div>
                  {field.key === "installationDate"
                    ? formatDate(device.installationDate ?? null)
                    : field.key === "lastSeenAt"
                      ? formatDateTime(device.lastSeenAt ?? null)
                      : device[field.key] ?? "-"}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="fm-pagination">
        <div className="fm-pagination-info">
          Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
        </div>
        <div className="fm-pagination-controls">
          <button
            className="fm-button"
            type="button"
            onClick={() => setPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            className="fm-button"
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="fm-pagination-page">
            Page {currentPage} / {pageCount}
          </span>
          <button
            className="fm-button"
            type="button"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={currentPage === pageCount}
          >
            Next
          </button>
          <button
            className="fm-button"
            type="button"
            onClick={() => setPage(pageCount)}
            disabled={currentPage === pageCount}
          >
            Last
          </button>
        </div>
      </div>

      {isLoading && <div className="fm-note">Loading devices...</div>}
      {error && <div className="fm-note">{error}</div>}
    </div>
  );
}
