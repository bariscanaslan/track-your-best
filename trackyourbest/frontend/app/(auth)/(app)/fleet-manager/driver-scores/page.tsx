"use client";

import { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiStar } from "react-icons/fi";
import { FaSearch, FaUndo } from "react-icons/fa";
import { driverScoresApi } from "../../../../utils/api";
import { resolveMediaUrl } from "@/app/utils/media";
import { useAuth } from "../../../../context/AuthContext";
import "../fleet-manager.css";

type DriverTripScore = {
  scoreId: string;
  driverId: string;
  driverName: string | null;
  avatarUrl: string | null;
  tripId: string;
  tripName: string | null;
  overallScore: number;
  speedScore: number | null;
  accelerationScore: number | null;
  brakingScore: number | null;
  corneringScore: number | null;
  idleTimeScore: number | null;
  calculatedAt: string;
};

type GradeFilter = "all" | "excellent" | "good" | "poor";

const PAGE_SIZE = 8;

const formatGrade = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(1);
};

const getGradeClassName = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "fm-grade is-empty";
  if (value >= 80) return "fm-grade is-good";
  if (value >= 60) return "fm-grade is-medium";
  return "fm-grade is-bad";
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DriverScoresPage() {
  const [rows, setRows] = useState<DriverTripScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";

  const fetchScores = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(driverScoresApi.byOrganization(orgId, apiBase), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load driver scores.");
      const data = (await res.json()) as DriverTripScore[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load driver scores.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [orgId]);

  const filteredRows = useMemo(() => {
    let base = [...rows];

    if (gradeFilter === "excellent") base = base.filter((r) => r.overallScore >= 80);
    else if (gradeFilter === "good") base = base.filter((r) => r.overallScore >= 60 && r.overallScore < 80);
    else if (gradeFilter === "poor") base = base.filter((r) => r.overallScore < 60);

    const q = appliedQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        [r.driverName, r.tripName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return base;
  }, [rows, gradeFilter, appliedQuery]);

  useEffect(() => {
    setPage(1);
  }, [gradeFilter, appliedQuery, rows.length]);

  const counts = useMemo(() => {
    return {
      excellent: rows.filter((r) => r.overallScore >= 80).length,
      good: rows.filter((r) => r.overallScore >= 60 && r.overallScore < 80).length,
      poor: rows.filter((r) => r.overallScore < 60).length,
    };
  }, [rows]);

  const fleetAvg = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.overallScore, 0) / rows.length;
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="fm-page">
      {/* Header */}
      <div className="fm-header">
        <div className="fm-title">Driver Scores</div>
        <div className="fm-actions fm-anomaly-filter-bar">
          <div className="fm-severity-filter">
            {(["all", "excellent", "good", "poor"] as GradeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`fm-severity-btn is-${f === "excellent" ? "low" : f === "good" ? "medium" : f === "poor" ? "critical" : "all"} ${gradeFilter === f ? "is-active" : ""}`}
                onClick={() => setGradeFilter(f)}
              >
                {f === "all"
                  ? `All (${rows.length})`
                  : f === "excellent"
                  ? `Excellent (${counts.excellent})`
                  : f === "good"
                  ? `Good (${counts.good})`
                  : `Poor (${counts.poor})`}
              </button>
            ))}
          </div>
          <select
            className="fm-search-select"
            style={{ display: "none" }}
            aria-hidden
          />
          <input
            className="fm-search"
            placeholder="Search driver or trip…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setAppliedQuery(query); }}
          />
          <button
            className="fm-button"
            type="button"
            onClick={() => setAppliedQuery(query)}
            title="Search"
          >
            <FaSearch size={14} />
          </button>
          <button
            className="fm-button"
            type="button"
            onClick={() => { setQuery(""); setAppliedQuery(""); }}
            title="Reset search"
          >
            <FaUndo size={14} />
          </button>
          <button
            className="fm-button"
            type="button"
            onClick={fetchScores}
            disabled={isLoading}
            title="Refresh"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Fleet average banner */}
      {fleetAvg != null && (
        <div className="fm-driver-fleet-summary">
          <span className="fm-driver-fleet-summary-label">Fleet average score</span>
          <span className={getGradeClassName(fleetAvg)}>{fleetAvg.toFixed(1)} / 100</span>
          <span className="fm-driver-fleet-summary-sub">
            based on {rows.length} scored trip{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredRows.length === 0 && (
        <div className="fm-anomaly-empty">
          <div className="fm-anomaly-empty-icon">
            <FiStar />
          </div>
          <div>
            No driver scores found
            {gradeFilter !== "all" ? ` for "${gradeFilter}" range` : ""}
            {appliedQuery ? ` matching "${appliedQuery}"` : ""}.
          </div>
        </div>
      )}

      {/* Score rows */}
      {filteredRows.length > 0 && (
        <div className="fm-list">
          {pagedRows.map((score) => (
            <div key={score.scoreId} className="fm-list-row">
              {/* Top: driver identity + overall badge */}
              <div className="fm-list-top">
                <div className="fm-list-identity">
                  <img
                    src={resolveMediaUrl(score.avatarUrl, apiBase) || "/tyb-logo.png"}
                    alt={score.driverName || "Driver"}
                    className="fm-avatar"
                  />
                  <div>
                    <div className="fm-list-title-row">
                      <div className="fm-list-title">
                        {score.driverName || "Unknown Driver"}
                      </div>
                    </div>
                    <div className="fm-list-sub">
                      {score.tripName || "Unnamed Trip"} &middot; {formatDateTime(score.calculatedAt)}
                    </div>
                  </div>
                </div>
                <div className="fm-list-actions">
                  <span className={getGradeClassName(score.overallScore)}>
                    {score.overallScore.toFixed(1)} / 100
                  </span>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="fm-score-grid">
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Speed</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.speedScore)}>
                      {formatGrade(score.speedScore)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Speed Score</div>
                </div>
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Acceleration</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.accelerationScore)}>
                      {formatGrade(score.accelerationScore)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Accel. Score</div>
                </div>
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Braking</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.brakingScore)}>
                      {formatGrade(score.brakingScore)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Braking Score</div>
                </div>
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Cornering</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.corneringScore)}>
                      {formatGrade(score.corneringScore)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Cornering Score</div>
                </div>
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Idle Time</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.idleTimeScore)}>
                      {formatGrade(score.idleTimeScore)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Idle Score</div>
                </div>
                <div className="fm-list-card">
                  <div className="fm-list-card-title">Overall</div>
                  <div className="fm-list-card-value">
                    <span className={getGradeClassName(score.overallScore)}>
                      {score.overallScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="fm-list-card-sub">Overall Score</div>
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

      {isLoading && <div className="fm-note">Loading driver scores…</div>}
      {error && <div className="fm-note fm-warning-danger">{error}</div>}
    </div>
  );
}
