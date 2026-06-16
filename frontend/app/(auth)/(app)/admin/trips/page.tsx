"use client";

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo, FaSync } from "react-icons/fa";
import { tripsApi } from "../../../../utils/api";
import "../admin.css";

type TripRow = {
  id: string;
  vehicleId?: string | null;
  vehicleName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  tripName?: string | null;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  distanceKm?: number | null;
  createdAt?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const STATUS_OPTIONS = [
  { value: "completed",        label: "Completed" },
  { value: "driver_approve",   label: "Waiting for Driver Approve" },
  { value: "cancelled_fm",     label: "Fleet Manager Cancelled" },
  { value: "cancelled_driver", label: "Driver Cancelled" },
] as const;

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;

const statusClass = (status: string) => {
  if (status === "completed") return "adm-list-pill adm-list-pill-green";
  if (status === "driver_approve") return "adm-list-pill adm-list-pill-yellow";
  if (status === "cancelled_fm" || status === "cancelled_driver") return "adm-list-pill adm-list-pill-red";
  return "adm-list-pill";
};

type SortKey = "tripName" | "organizationName" | "vehicleName" | "driverName" | "status" | "startedAt" | "endedAt" | "distanceKm";
type SortDir = "asc" | "desc";

export default function AdminTripsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<TripRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchTrips = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(tripsApi.listAll(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load trips.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      const q = appliedQuery.trim().toLowerCase();
      const matchQuery = !q || [row.tripName, row.vehicleName, row.driverName, row.organizationName, row.id]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "startedAt" || sortKey === "endedAt") {
        cmp = new Date(a[sortKey] ?? 0).getTime() - new Date(b[sortKey] ?? 0).getTime();
      } else if (sortKey === "distanceKm") {
        cmp = (a.distanceKm ?? -1) - (b.distanceKm ?? -1);
      } else {
        cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [rows, appliedQuery, statusFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [appliedQuery, statusFilter, sortKey, sortDir, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const thStyle: React.CSSProperties = { cursor: "pointer", userSelect: "none" };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Trips</div>
        <div className="adm-actions">
          <select className="adm-search-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            className="adm-search"
            placeholder="Search trip, vehicle, driver, org..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setAppliedQuery(query); }}
          />
          <button className="adm-button" type="button" onClick={() => setAppliedQuery(query)} title="Search"><FaSearch size={13} /></button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); setStatusFilter("all"); }} title="Reset"><FaUndo size={13} /></button>
          <button className="adm-button" type="button" onClick={fetchTrips} title="Refresh"><FaSync size={13} /></button>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort("organizationName")}>Organization{sortIndicator("organizationName")}</th>
              <th style={thStyle} onClick={() => handleSort("vehicleName")}>Vehicle{sortIndicator("vehicleName")}</th>
              <th style={thStyle} onClick={() => handleSort("driverName")}>Driver{sortIndicator("driverName")}</th>
              <th style={thStyle} onClick={() => handleSort("status")}>Status{sortIndicator("status")}</th>
              <th style={thStyle} onClick={() => handleSort("startedAt")}>Started{sortIndicator("startedAt")}</th>
              <th style={thStyle} onClick={() => handleSort("endedAt")}>Ended{sortIndicator("endedAt")}</th>
              <th style={thStyle} onClick={() => handleSort("distanceKm")}>Distance{sortIndicator("distanceKm")}</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={row.id}>
                <td>{row.organizationName || "-"}</td>
                <td>{row.vehicleName || "-"}</td>
                <td>{row.driverName || "-"}</td>
                <td><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.startedAt)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.endedAt)}</td>
                <td>{row.distanceKm != null ? `${row.distanceKm.toFixed(1)} km` : "-"}</td>
              </tr>
            ))}
            {pagedRows.length === 0 && !isLoading && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>No trips found.</td></tr>
            )}
          </tbody>
        </table>
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

      {isLoading && <div className="adm-note">Loading trips...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
