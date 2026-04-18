"use client";

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { driversApi } from "../../../../utils/api";
import { useAuth } from "../../../../context/AuthContext";
import "../fleet-manager.css";

type DriverRow = {
  id: string;
  vehicleId?: string | null;
  vehicleName?: string | null;
  licenseNumber: string;
  licenseType?: string | null;
  licenseExpiry?: string | null;
  dateOfBirth?: string | null;
  hireDate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isActive?: boolean | null;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  userCreatedAt?: string | null;
  lastLogin?: string | null;

  averageOverallScore?: number | null;
  tripCount?: number | null;
};

type DriverScoreSummary = {
  driverId: string;
  averageOverallScore: number;
  tripCount: number;
  lastCalculatedAt?: string | null;
};

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

const formatGrade = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "No grade";
  return `${value.toFixed(1)} / 100`;
};

const getGradeClassName = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "fm-grade is-empty";
  if (value >= 80) return "fm-grade is-good";
  if (value >= 60) return "fm-grade is-medium";
  return "fm-grade is-bad";
};

export default function FleetManagerDriversPage() {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "fullName" | "vehicleName" | "email" | "phone">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "fullName" | "vehicleName" | "email" | "phone">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user } = useAuth();
  const orgId = user?.organizationId ?? "";

  const fetchDrivers = async () => {
    if (!orgId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [driversRes, scoresRes] = await Promise.all([
        fetch(driversApi.list(orgId, apiBase), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
        fetch(`${apiBase}/api/DriverScores/summary?organizationId=${orgId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
      ]);

      if (!driversRes.ok) {
        throw new Error("Failed to load drivers.");
      }

      const driversData = (await driversRes.json()) as DriverRow[];
      const scoresData = scoresRes.ok
        ? ((await scoresRes.json()) as DriverScoreSummary[])
        : [];

      console.log("driversData", driversData);
      console.log("scoresData", scoresData);
      
      const scoreMap = new Map(
        (Array.isArray(scoresData) ? scoresData : []).map((item) => [item.driverId, item])
      );

      const mergedRows = (Array.isArray(driversData) ? driversData : []).map((driver) => {
        const summary = scoreMap.get(driver.id);

        return {
          ...driver,
          averageOverallScore: summary?.averageOverallScore ?? null,
          tripCount: summary?.tripCount ?? 0,
        };
      });

      setRows(mergedRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load drivers.";
      setError(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [orgId]);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aName = (a.fullName || "").toLowerCase();
      const bName = (b.fullName || "").toLowerCase();
      if (aName && bName) return aName.localeCompare(bName);
      if (aName) return -1;
      if (bName) return 1;
      return (a.licenseNumber || "").localeCompare(b.licenseNumber || "");
    });

    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;

    return sorted.filter((driver) => {
      const fieldValue = (field?: string | null) => (field ?? "").toLowerCase();

      if (appliedField === "fullName") return fieldValue(driver.fullName).includes(q);
      if (appliedField === "vehicleName") return fieldValue(driver.vehicleName).includes(q);
      if (appliedField === "email") return fieldValue(driver.email).includes(q);
      if (appliedField === "phone") return fieldValue(driver.phone).includes(q);

      const haystack = [
        driver.fullName,
        driver.vehicleName,
        driver.email,
        driver.phone,
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

  const handleDelete = async (driverId: string) => {
    try {
      const res = await fetch(driversApi.remove(driverId, apiBase), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Delete failed.");
      }
      await fetchDrivers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      setError(message);
    }
  };

  const fleetAvg = useMemo(() => {
    const scored = rows.filter((r) => r.averageOverallScore != null);
    if (scored.length === 0) return null;
    return scored.reduce((sum, r) => sum + r.averageOverallScore!, 0) / scored.length;
  }, [rows]);

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Drivers</div>
        <div className="fm-actions">
          <select
            className="fm-search-select"
            value={searchField}
            onChange={(event) =>
              setSearchField(event.target.value as "all" | "fullName" | "vehicleName" | "email" | "phone")
            }
          >
            <option value="all">All fields</option>
            <option value="fullName">Full name</option>
            <option value="vehicleName">Vehicle</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
          <input
            className="fm-search"
            placeholder="Search"
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
            aria-label="Search"
            title="Search"
          >
            <FaSearch size={14} />
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
            aria-label="Reset search"
            title="Reset"
          >
            <FaUndo size={14} />
          </button>
          <a className="fm-button fm-button-primary" href="/fleet-manager/drivers/new">
            Add Driver
          </a>
        </div>
      </div>

      {fleetAvg != null && (
        <div className="fm-driver-fleet-summary">
          <span className="fm-driver-fleet-summary-label">Fleet average score</span>
          <span className={getGradeClassName(fleetAvg)}>{fleetAvg.toFixed(1)} / 100</span>
          <span className="fm-driver-fleet-summary-sub">
            based on {rows.filter((r) => r.averageOverallScore != null).length} of {rows.length} drivers
          </span>
        </div>
      )}

      <div className="fm-list">
        {pagedRows.map((driver) => (
          <div key={driver.id} className="fm-list-row">
            <div className="fm-list-top">
              <div className="fm-list-identity">
                <img
                  src={driver.avatarUrl || "/tyb-logo.png"}
                  alt={driver.fullName || "Driver"}
                  className="fm-avatar"
                />
                <div>
                  <div className="fm-list-title-row">
                    <div className="fm-list-title">{driver.fullName || driver.licenseNumber || "-"}</div>

                    <span className={`fm-status ${driver.isActive ? "" : "is-inactive"}`}>
                      {driver.isActive ? "active" : "inactive"}
                    </span>

                    {driver.licenseType && <span className="fm-list-pill">{driver.licenseType}</span>}
                  </div>

                  <div className="fm-list-sub">
                    {driver.email || driver.userId || "-"}
                  </div>
                </div>
              </div>

              <div className="fm-list-actions">
                <a className="fm-link" href={`/fleet-manager/drivers/${driver.id}`}>
                  Edit
                </a>
                <button
                  className="fm-link fm-link-danger"
                  onClick={() => {
                    const ok = window.confirm("Delete this driver? This cannot be undone.");
                    if (ok) handleDelete(driver.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="fm-list-details">
              <div className="fm-list-card">
                <div className="fm-list-card-title">Avg. Score</div>
                <div className="fm-list-card-value">
                  <span className={getGradeClassName(driver.averageOverallScore)}>
                    {formatGrade(driver.averageOverallScore)}
                  </span>
                </div>
                <div className="fm-list-card-sub">
                  {driver.tripCount != null && driver.tripCount > 0
                    ? `${driver.tripCount} graded trip${driver.tripCount !== 1 ? "s" : ""}`
                    : "No trips graded yet"}
                </div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">Vehicle</div>
                <div className="fm-list-card-value">{driver.vehicleName || "-"}</div>
                <div className="fm-list-card-sub">{driver.vehicleId ?? "-"}</div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">User Info</div>
                <div className="fm-list-card-value">{driver.email || "-"}</div>
                <div className="fm-list-card-sub">{driver.phone || "-"}</div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">Account</div>
                <div className="fm-list-card-value">Created: {formatDate(driver.userCreatedAt ?? null)}</div>
                <div className="fm-list-card-sub">
                  Last login: {formatDateTime(driver.lastLogin ?? null)}
                </div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">License</div>
                <div className="fm-list-card-value">{driver.licenseNumber || "-"}</div>
                <div className="fm-list-card-sub">
                  Exp: {formatDate(driver.licenseExpiry ?? null)}
                </div>
              </div>
            </div>
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

      {isLoading && <div className="fm-note">Loading drivers...</div>}
      {error && <div className="fm-note">{error}</div>}
    </div>
  );
}