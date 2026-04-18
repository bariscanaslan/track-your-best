"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FiAlertTriangle, FiRefreshCw, FiCpu, FiUser } from "react-icons/fi";
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

// Human-readable labels and tooltips for raw ML flag codes
const FLAG_LABELS: Record<string, { label: string; tooltip: string }> = {
  GPS_SPIKE:                { label: "GPS Signal Jump",      tooltip: "The device logged an abrupt location change due to a signal dropout." },
  GPS_TELEPORT_ARTIFACT:    { label: "GPS Location Gap",     tooltip: "The GPS position jumped unrealistically, likely from a connectivity loss." },
  GPS_SIGNAL_NOISE:         { label: "Weak GPS Signal",      tooltip: "Erratic position readings indicate poor satellite reception." },
  CRASH_SUSPICION:          { label: "Possible Collision",   tooltip: "Extreme deceleration was recorded that may indicate a collision." },
  HARSH_DRIVING:            { label: "Aggressive Driving",   tooltip: "Sudden acceleration or hard braking was detected during the trip." },
  ABNORMAL_DRIVING_PATTERN: { label: "Unusual Driving",      tooltip: "The driving pattern on this trip was statistically out of the ordinary." },
};

function humanType(type: string | null): string {
  if (!type) return "Anomaly Detected";
  if (type === "device_health") return "Device Issue";
  if (type === "driver_behavior") return "Driver Behavior Alert";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeIcon({ type }: { type: string | null }) {
  if (type === "device_health") return <FiCpu size={15} />;
  if (type === "driver_behavior") return <FiUser size={15} />;
  return <FiAlertTriangle size={15} />;
}

function buildSummary(type: string | null, flags: string[]): string {
  if (type === "device_health") {
    if (flags.includes("GPS_TELEPORT_ARTIFACT") || flags.includes("GPS_SPIKE"))
      return "The vehicle's GPS device experienced a signal interruption, causing location gaps in the trip record.";
    if (flags.includes("GPS_SIGNAL_NOISE"))
      return "The GPS device showed poor signal quality during parts of this trip. Position data may be unreliable.";
    return "A technical issue was detected with the vehicle's tracking device during this trip.";
  }
  if (type === "driver_behavior") {
    if (flags.includes("CRASH_SUSPICION"))
      return "An extreme deceleration event was recorded. This may indicate a collision — please review the trip and contact the driver.";
    if (flags.includes("HARSH_DRIVING"))
      return "Sudden acceleration or hard braking maneuvers were detected. This could pose a safety risk and warrants a follow-up with the driver.";
    if (flags.includes("ABNORMAL_DRIVING_PATTERN"))
      return "The overall driving pattern on this trip was unusual compared to typical behavior for this route or driver.";
    return "An abnormal driving event was detected during this trip.";
  }
  return "An anomaly was detected during this trip. Please review the details below.";
}

function severityClass(severity: string | null) {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "fm-severity fm-severity-critical";
    case "high":     return "fm-severity fm-severity-high";
    case "medium":   return "fm-severity fm-severity-medium";
    case "low":      return "fm-severity fm-severity-low";
    default:         return "fm-severity fm-severity-low";
  }
}

function severityLabel(severity: string | null): string {
  switch ((severity ?? "").toLowerCase()) {
    case "critical": return "Critical";
    case "high":     return "High Priority";
    case "medium":   return "Medium Priority";
    case "low":      return "Low Priority";
    default:         return "Unknown";
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

function reliabilityLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.6)  return "Moderate";
  return "Low";
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
          <div>No anomalies found{severityFilter !== "all" ? ` for "${severityFilter}" priority` : ""}.</div>
        </div>
      ) : (
        <div className="fm-list">
          {pagedRows.map((anomaly) => {
            const summary = buildSummary(anomaly.anomalyType, anomaly.flags);
            const reliability = anomaly.confidenceScore != null
              ? reliabilityLabel(anomaly.confidenceScore)
              : null;

            return (
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
                          {severityLabel(anomaly.severity)}
                        </span>
                        <span className="fm-anomaly-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <TypeIcon type={anomaly.anomalyType} />
                          {humanType(anomaly.anomalyType)}
                        </span>
                      </div>
                      <div className="fm-anomaly-time">Detected on {formatDateTime(anomaly.detectedAt)}</div>
                    </div>
                  </div>

                  {/* Plain-language summary */}
                  <div className="fm-anomaly-desc">{summary}</div>

                  {/* Human-readable flag pills */}
                  {anomaly.flags.length > 0 && (
                    <div className="fm-anomaly-flags">
                      {anomaly.flags.map((flag) => {
                        const entry = FLAG_LABELS[flag];
                        return (
                          <span
                            key={flag}
                            className="fm-anomaly-flag"
                            title={entry?.tooltip ?? flag}
                          >
                            {entry?.label ?? flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Simplified meta */}
                  <div className="fm-anomaly-meta">
                    {reliability && (
                      <div className="fm-list-card">
                        <div className="fm-list-card-title">Detection Reliability</div>
                        <div className="fm-list-card-value">{reliability}</div>
                        <div className="fm-list-card-sub">
                          {(anomaly.confidenceScore! * 100).toFixed(0)}% confidence
                        </div>
                      </div>
                    )}
                    <div className="fm-list-card">
                      <div className="fm-list-card-title">Event Location</div>
                      <div className="fm-list-card-value">
                        {anomaly.latitude != null ? "Pinpointed" : "Unavailable"}
                      </div>
                      <div className="fm-list-card-sub">
                        {anomaly.latitude != null
                          ? `${anomaly.latitude.toFixed(4)}, ${anomaly.longitude?.toFixed(4)}`
                          : "No GPS coordinates"}
                      </div>
                    </div>
                    <div className="fm-list-card">
                      <div className="fm-list-card-title">Trip Reference</div>
                      <div className="fm-list-card-value" style={{ fontSize: 11, fontFamily: "monospace" }}>
                        {anomaly.tripId.slice(0, 8)}…
                      </div>
                      <div className="fm-list-card-sub">Trip ID</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
