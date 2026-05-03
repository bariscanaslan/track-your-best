"use client";

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo, FaSync } from "react-icons/fa";
import { systemEventsApi } from "../../../../utils/api";
import "../admin.css";

type SystemEventRow = {
  id?: string;
  eventType?: string | null;
  severity?: string | null;
  message?: string | null;
  source?: string | null;
  userId?: string | null;
  userName?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const severityClass = (severity?: string | null) => {
  if (severity === "error" || severity === "critical") return "adm-list-pill adm-list-pill-red";
  if (severity === "warning") return "adm-list-pill adm-list-pill-yellow";
  if (severity === "info") return "adm-list-pill adm-list-pill-green";
  return "adm-list-pill";
};

export default function AdminSystemEventsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<SystemEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(systemEventsApi.list(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load system events.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system events.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime()
    );
    return sorted.filter((row) => {
      const matchSeverity = severityFilter === "all" || row.severity === severityFilter;
      const q = appliedQuery.trim().toLowerCase();
      const matchQuery = !q || [row.eventType, row.message, row.source, row.userName]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchSeverity && matchQuery;
    });
  }, [rows, appliedQuery, severityFilter]);

  useEffect(() => { setPage(1); }, [appliedQuery, severityFilter, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">System Events</div>
        <div className="adm-actions">
          <select className="adm-search-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <input
            className="adm-search"
            placeholder="Search event type, message, source..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setAppliedQuery(query); }}
          />
          <button className="adm-button" type="button" onClick={() => setAppliedQuery(query)} title="Search"><FaSearch size={13} /></button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); setSeverityFilter("all"); }} title="Reset"><FaUndo size={13} /></button>
          <button className="adm-button" type="button" onClick={fetchEvents} title="Refresh"><FaSync size={13} /></button>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Occurred At</th>
              <th>Severity</th>
              <th>Event Type</th>
              <th>Message</th>
              <th>Source</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, idx) => (
              <tr key={row.id ?? idx}>
                <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>{formatDateTime(row.occurredAt)}</td>
                <td><span className={severityClass(row.severity)}>{row.severity || "-"}</span></td>
                <td style={{ fontWeight: 600 }}>{row.eventType || "-"}</td>
                <td style={{ maxWidth: 320 }}>{row.message || "-"}</td>
                <td>{row.source || "-"}</td>
                <td>{row.userName || (row.userId ? row.userId.slice(0, 8) + "..." : "-")}</td>
              </tr>
            ))}
            {pagedRows.length === 0 && !isLoading && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>No events found.</td></tr>
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

      {isLoading && <div className="adm-note">Loading system events...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
