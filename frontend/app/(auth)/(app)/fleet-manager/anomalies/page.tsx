"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { anomaliesApi } from "../../../../utils/api";
import { useAuth } from "../../../../context/AuthContext";
import "../fleet-manager.css";

const AnomalyMiniMap = dynamic(
  () => import("../../../../components/fleet-manager/AnomalyMiniMap"),
  { ssr: false, loading: () => <div className="fm-anomaly-map-placeholder">Loading map…</div> }
);

type AnomalyRow = {
  id: string;
  tripId: string;
  deviceId: string;
  anomalyType: string | null;
  severity: string | null;
  description: string | null;
  confidenceScore: number | null;
  algorithmUsed: string | null;
  detectedAt: string;
  latitude: number | null;
  longitude: number | null;
  flags: string[];
  anomalyScore: number | null;
};

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function severityClass(severity: string | null) {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "fm-severity fm-severity-critical";
    case "high":     return "fm-severity fm-severity-high";
    case "medium":   return "fm-severity fm-severity-medium";
    case "low":      return "fm-severity fm-severity-low";
    default:         return "fm-severity fm-severity-low";
  }
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatFlag(flag: string) {
  return flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE = 6;

export default function AnomalyAnalysisPage() {
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [page, setPage] = useState(1);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";

  const fetchAnomalies = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(anomaliesApi.list(orgId, apiBase), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load anomalies.");
      const data = (await res.json()) as AnomalyRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load anomalies.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [orgId]);

  const filteredRows = useMemo(() => {
    const base =
      severityFilter === "all"
        ? [...rows]
        : rows.filter((r) => (r.severity ?? "").toLowerCase() === severityFilter);

    return base.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity?.toLowerCase() ?? ""] ?? 99) -
        (SEVERITY_ORDER[b.severity?.toLowerCase() ?? ""] ?? 99)
    );
  }, [rows, severityFilter]);

  useEffect(() => { setPage(1); }, [severityFilter, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    rows.forEach((r) => { const s = (r.severity ?? "").toLowerCase(); if (s in c) c[s]++; });
    return c;
  }, [rows]);

  return (
    <div className="fm-page">
      {/* Header */}
      <div className="fm-header">
        <div className="fm-title">Anomaly Analysis</div>
        <div className="fm-actions fm-anomaly-filter-bar">
          <div className="fm-severity-filter">
            {(["all", "critical", "high", "medium", "low"] as SeverityFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`fm-severity-btn is-${s} ${severityFilter === s ? "is-active" : ""}`}
                onClick={() => setSeverityFilter(s)}
              >
                {s === "all"
                  ? `All (${rows.length})`
                  : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s] ?? 0})`}
              </button>
            ))}
          </div>
          <button
            className="fm-button"
            type="button"
            onClick={fetchAnomalies}
            disabled={isLoading}
            title="Refresh"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      {!isLoading && !error && filteredRows.length === 0 ? (
        <div className="fm-anomaly-empty">
          <div className="fm-anomaly-empty-icon">
            <FiAlertTriangle />
          </div>
          <div>No anomalies found{severityFilter !== "all" ? ` for severity "${severityFilter}"` : ""}.</div>
        </div>
      ) : (
        <div className="fm-list">
          {pagedRows.map((anomaly) => (
            <div key={anomaly.id} className="fm-anomaly-row">
              {/* Mini-map */}
              <div className="fm-anomaly-map">
                {anomaly.latitude != null && anomaly.longitude != null ? (
                  <AnomalyMiniMap lat={anomaly.latitude} lon={anomaly.longitude} />
                ) : (
                  <div className="fm-anomaly-map-placeholder">No location data</div>
                )}
              </div>

              {/* Details */}
              <div className="fm-anomaly-body">
                <div className="fm-anomaly-top">
                  <div>
                    <div className="fm-anomaly-title-row">
                      <span className={severityClass(anomaly.severity)}>
                        {(anomaly.severity ?? "unknown").toUpperCase()}
                      </span>
                      <span className="fm-anomaly-title">
                        {anomaly.anomalyType?.replace(/_/g, " ") ?? "Anomaly Detected"}
                      </span>
                    </div>
                    <div className="fm-anomaly-time">{formatDateTime(anomaly.detectedAt)}</div>
                  </div>
                </div>

                {anomaly.description && (
                  <div className="fm-anomaly-desc">{anomaly.description}</div>
                )}

                {anomaly.flags.length > 0 && (
                  <div className="fm-anomaly-flags">
                    {anomaly.flags.map((flag) => (
                      <span key={flag} className="fm-anomaly-flag">
                        {formatFlag(flag)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="fm-anomaly-meta">
                  <div className="fm-list-card">
                    <div className="fm-list-card-title">Confidence</div>
                    <div className="fm-list-card-value">
                      {anomaly.confidenceScore != null
                        ? `${(anomaly.confidenceScore * 100).toFixed(0)}%`
                        : "—"}
                    </div>
                    <div className="fm-list-card-sub">
                      Score: {anomaly.anomalyScore?.toFixed(1) ?? "—"}
                    </div>
                  </div>
                  <div className="fm-list-card">
                    <div className="fm-list-card-title">Trip</div>
                    <div className="fm-list-card-value" style={{ fontSize: 11, fontFamily: "monospace" }}>
                      {anomaly.tripId.slice(0, 8)}…
                    </div>
                    <div className="fm-list-card-sub">{anomaly.algorithmUsed ?? "—"}</div>
                  </div>
                  <div className="fm-list-card">
                    <div className="fm-list-card-title">Location</div>
                    <div className="fm-list-card-value">
                      {anomaly.latitude != null ? anomaly.latitude.toFixed(4) : "—"}
                    </div>
                    <div className="fm-list-card-sub">
                      {anomaly.longitude != null ? anomaly.longitude.toFixed(4) : "No coords"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredRows.length > PAGE_SIZE && (
        <div className="fm-pagination">
          <div className="fm-pagination-info">
            Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </div>
          <div className="fm-pagination-controls">
            <button className="fm-button" type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>First</button>
            <button className="fm-button" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
            <span className="fm-pagination-page">Page {currentPage} / {pageCount}</span>
            <button className="fm-button" type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}>Next</button>
            <button className="fm-button" type="button" onClick={() => setPage(pageCount)} disabled={currentPage === pageCount}>Last</button>
          </div>
        </div>
      )}

      {isLoading && <div className="fm-note">Loading anomalies…</div>}
      {error && <div className="fm-note fm-warning-danger">{error}</div>}
    </div>
  );
}
