"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { driversApi } from "../../../../utils/api";
import "../admin.css";

type DriverRow = {
  id: string;
  organizationId?: string | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  licenseNumber: string;
  licenseType?: string | null;
  licenseExpiry?: string | null;
  hireDate?: string | null;
  isActive?: boolean | null;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  lastLogin?: string | null;
  userCreatedAt?: string | null;
};

export type DriverScoreSummary = {
  driverId: string;
  averageOverallScore: number;
  tripCount: number;
  lastCalculatedAt?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} - ${formatDate(value)}`;
};

const getGradeLabel = (score?: number | null) => {
  if (score == null) return "No grade";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "Medium";
  if (score >= 35) return "Risky";
  return "Dangerous";
};

const getGradeClass = (score?: number | null) => {
  if (score == null) return "adm-grade adm-grade-none";
  if (score >= 90) return "adm-grade adm-grade-excellent";
  if (score >= 75) return "adm-grade adm-grade-good";
  if (score >= 55) return "adm-grade adm-grade-medium";
  if (score >= 35) return "adm-grade adm-grade-risky";
  return "adm-grade adm-grade-dangerous";
};

export default function AdminDriversPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [rows, setRows] = useState<DriverRow[]>([]);
  const [scoresMap, setScoresMap] = useState<Record<string, DriverScoreSummary>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isScoresLoading, setIsScoresLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "fullName" | "email" | "vehicleName" | "licenseNumber">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "fullName" | "email" | "vehicleName" | "licenseNumber">("all");

  const [page, setPage] = useState(1);
  const pageSize = 10;



  const fetchDrivers = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const res = await fetch(driversApi.listAll(apiBase), {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Failed to load drivers.");

    const data = await res.json();
    const driverRows = Array.isArray(data) ? data : [];
    setRows(driverRows);

    console.log("driverRows:", driverRows);

    const organizationId =
      driverRows.find((x: DriverRow) => x.organizationId)?.organizationId ?? null;

    console.log("organizationId from driverRows:", organizationId);

    if (organizationId) {
      await fetchScores(organizationId);
    } else {
      console.warn("No organizationId found in driver rows. Scores will not load.");
      setScoresMap({});
    }
  } catch (err) {
    console.error("fetchDrivers error:", err);
    setError(err instanceof Error ? err.message : "Failed to load drivers.");
    setRows([]);
    setScoresMap({});
  } finally {
    setIsLoading(false);
  }
};

const fetchScores = async (organizationId: string) => {
  if (!apiBase) return;

  setIsScoresLoading(true);

  try {
    const url = `${apiBase}/api/DriverScores/summary?organizationId=${organizationId}`;
    console.log("Fetching scores from:", url);

    const res = await fetch(url, { credentials: "include" });

    console.log("scores response status:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("scores response error body:", text);
      throw new Error("Failed to load driver grades.");
    }

    const data: DriverScoreSummary[] = await res.json();
    console.log("scoresData:", data);

    const map: Record<string, DriverScoreSummary> = {};
    for (const item of data) {
      map[item.driverId] = item;
    }

    console.log("scoresMap:", map);
    setScoresMap(map);
  } catch (err) {
    console.error("Driver scores fetch error:", err);
    setScoresMap({});
  } finally {
    setIsScoresLoading(false);
  }
};

  useEffect(() => {
    fetchDrivers();
  }, []);

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

    return sorted.filter((d) => {
      const fv = (v?: string | null) => (v ?? "").toLowerCase();

      if (appliedField === "fullName") return fv(d.fullName).includes(q);
      if (appliedField === "email") return fv(d.email).includes(q);
      if (appliedField === "vehicleName") return fv(d.vehicleName).includes(q);
      if (appliedField === "licenseNumber") return fv(d.licenseNumber).includes(q);

      return [d.fullName, d.email, d.vehicleName, d.licenseNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, appliedQuery, appliedField]);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, appliedField, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this driver? This cannot be undone.")) return;

    try {
      const res = await fetch(driversApi.remove(id, apiBase), {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Delete failed.");

      await fetchDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Drivers</div>

        <div className="adm-actions">
          <select
            className="adm-search-select"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as typeof searchField)}
          >
            <option value="all">All fields</option>
            <option value="fullName">Full name</option>
            <option value="email">Email</option>
            <option value="vehicleName">Vehicle</option>
            <option value="licenseNumber">License</option>
          </select>

          <input
            className="adm-search"
            placeholder="Search drivers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setAppliedField(searchField);
                setAppliedQuery(query);
              }
            }}
          />

          <button
            className="adm-button"
            type="button"
            onClick={() => {
              setAppliedField(searchField);
              setAppliedQuery(query);
            }}
            title="Search"
          >
            <FaSearch size={13} />
          </button>

          <button
            className="adm-button"
            type="button"
            onClick={() => {
              setQuery("");
              setAppliedQuery("");
              setSearchField("all");
              setAppliedField("all");
            }}
            title="Reset"
          >
            <FaUndo size={13} />
          </button>

          <Link className="adm-button adm-button-primary" href="/admin/drivers/new">
            Add Driver
          </Link>
        </div>
      </div>

      <div className="adm-list">
        {pagedRows.map((driver) => {
          const scoreInfo = scoresMap[driver.id];
          const avgScore = scoreInfo?.averageOverallScore ?? null;
          const tripCount = scoreInfo?.tripCount ?? 0;

          return (
            <div key={driver.id} className="adm-list-row">
              <div className="adm-list-top">
                <div className="adm-list-identity">
                  <img
                    src={driver.avatarUrl || "/tyb-logo.png"}
                    alt={driver.fullName || "Driver"}
                    className="adm-avatar"
                  />

                  <div>
                    <div className="adm-list-title-row">
                      <div className="adm-list-title">
                        {driver.fullName || driver.licenseNumber || "-"}
                      </div>

                      <span className={getGradeClass(avgScore)}>
                        {avgScore != null ? `${avgScore.toFixed(1)} / 100` : "No grade"}
                      </span>

                      <span className={`adm-status${driver.isActive === false ? " is-inactive" : ""}`}>
                        {driver.isActive === false ? "inactive" : "active"}
                      </span>

                      {driver.licenseType && (
                        <span className="adm-list-pill">{driver.licenseType}</span>
                      )}
                    </div>

                    <div className="adm-list-sub">
                      User ID: {driver.userId ?? "-"} · Trips graded: {tripCount} · {getGradeLabel(avgScore)}
                    </div>
                  </div>
                </div>

                <div className="adm-list-actions">
                  <Link className="adm-link" href={`/admin/drivers/${driver.id}`}>
                    Edit
                  </Link>
                  <button
                    className="adm-link adm-link-danger"
                    type="button"
                    onClick={() => handleDelete(driver.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="adm-list-details">
                <div className="adm-list-card">
                  <div className="adm-list-card-title">Vehicle</div>
                  <div className="adm-list-card-value">{driver.vehicleName || "-"}</div>
                  <div className="adm-list-card-sub">
                    {driver.vehicleId ? driver.vehicleId.slice(0, 8) + "..." : "-"}
                  </div>
                </div>

                <div className="adm-list-card">
                  <div className="adm-list-card-title">Contact</div>
                  <div className="adm-list-card-value">{driver.email || "-"}</div>
                  <div className="adm-list-card-sub">{driver.phone || "-"}</div>
                </div>

                <div className="adm-list-card">
                  <div className="adm-list-card-title">License</div>
                  <div className="adm-list-card-value">{driver.licenseNumber || "-"}</div>
                  <div className="adm-list-card-sub">Exp: {formatDate(driver.licenseExpiry)}</div>
                </div>

                <div className="adm-list-card">
                  <div className="adm-list-card-title">Account</div>
                  <div className="adm-list-card-value">Hired: {formatDate(driver.hireDate)}</div>
                  <div className="adm-list-card-sub">Last login: {formatDateTime(driver.lastLogin)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="adm-pagination">
        <div className="adm-pagination-info">
          {filteredRows.length === 0
            ? "No results"
            : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                currentPage * pageSize,
                filteredRows.length
              )} of ${filteredRows.length}`}
        </div>

        <div className="adm-pagination-controls">
          <button className="adm-button" type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>
            First
          </button>
          <button
            className="adm-button"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="adm-pagination-page">
            Page {currentPage} / {pageCount}
          </span>
          <button
            className="adm-button"
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage === pageCount}
          >
            Next
          </button>
          <button
            className="adm-button"
            type="button"
            onClick={() => setPage(pageCount)}
            disabled={currentPage === pageCount}
          >
            Last
          </button>
        </div>
      </div>

      {isLoading && <div className="adm-note">Loading drivers...</div>}
      {!isLoading && isScoresLoading && <div className="adm-note">Loading driver grades...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}