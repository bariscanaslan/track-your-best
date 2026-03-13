"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { vehiclesApi } from "../../../../utils/api";
import "../admin.css";

type VehicleRow = {
  id: string;
  organizationId?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  vehicleName: string;
  plateNumber: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  fuelType?: string | null;
  capacity?: number | null;
  insuranceExpiry?: string | null;
  inspectionExpiry?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminVehiclesPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "vehicleName" | "plateNumber" | "brand" | "deviceName">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "vehicleName" | "plateNumber" | "brand" | "deviceName">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchVehicles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(vehiclesApi.listAll(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vehicles.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.vehicleName || "").toLowerCase().localeCompare((b.vehicleName || "").toLowerCase())
    );
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((v) => {
      const fv = (val?: string | null) => (val ?? "").toLowerCase();
      if (appliedField === "vehicleName") return fv(v.vehicleName).includes(q);
      if (appliedField === "plateNumber") return fv(v.plateNumber).includes(q);
      if (appliedField === "brand") return fv(v.brand).includes(q);
      if (appliedField === "deviceName") return fv(v.deviceName).includes(q);
      return [v.vehicleName, v.plateNumber, v.brand, v.deviceName].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, appliedQuery, appliedField]);

  useEffect(() => { setPage(1); }, [appliedQuery, appliedField, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this vehicle? This cannot be undone.")) return;
    try {
      const res = await fetch(vehiclesApi.remove(id, apiBase), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Vehicles</div>
        <div className="adm-actions">
          <select className="adm-search-select" value={searchField} onChange={(e) => setSearchField(e.target.value as typeof searchField)}>
            <option value="all">All fields</option>
            <option value="vehicleName">Vehicle name</option>
            <option value="plateNumber">Plate number</option>
            <option value="brand">Brand</option>
            <option value="deviceName">Device</option>
          </select>
          <input
            className="adm-search"
            placeholder="Search vehicles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setAppliedField(searchField); setAppliedQuery(query); } }}
          />
          <button className="adm-button" type="button" onClick={() => { setAppliedField(searchField); setAppliedQuery(query); }} title="Search"><FaSearch size={13} /></button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); setSearchField("all"); setAppliedField("all"); }} title="Reset"><FaUndo size={13} /></button>
          <Link className="adm-button adm-button-primary" href="/admin/vehicles/new">Add Vehicle</Link>
        </div>
      </div>

      <div className="adm-list">
        {pagedRows.map((vehicle) => (
          <div key={vehicle.id} className="adm-list-row">
            <div className="adm-list-top">
              <div className="adm-list-identity">
                <img src="/tyb-logo.png" alt={vehicle.vehicleName} className="adm-avatar" />
                <div>
                  <div className="adm-list-title-row">
                    <div className="adm-list-title">{vehicle.vehicleName || "-"}</div>
                    <span className={`adm-status${vehicle.isActive === false ? " is-inactive" : ""}`}>
                      {vehicle.isActive === false ? "inactive" : "active"}
                    </span>
                    {vehicle.brand && <span className="adm-list-pill">{vehicle.brand}</span>}
                  </div>
                  <div className="adm-list-sub">ID: {vehicle.id}</div>
                </div>
              </div>
              <div className="adm-list-actions">
                <Link className="adm-link" href={`/admin/vehicles/${vehicle.id}`}>Edit</Link>
                <button className="adm-link adm-link-danger" type="button" onClick={() => handleDelete(vehicle.id)}>Delete</button>
              </div>
            </div>
            <div className="adm-list-details">
              <div className="adm-list-card">
                <div className="adm-list-card-title">Device</div>
                <div className="adm-list-card-value">{vehicle.deviceName || "-"}</div>
                <div className="adm-list-card-sub">{vehicle.deviceId ? vehicle.deviceId.slice(0, 8) + "..." : "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Registration</div>
                <div className="adm-list-card-value">{vehicle.plateNumber || "-"}</div>
                <div className="adm-list-card-sub">{vehicle.model || "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Specs</div>
                <div className="adm-list-card-value">{vehicle.year ?? "-"} {vehicle.color ? `• ${vehicle.color}` : ""}</div>
                <div className="adm-list-card-sub">{vehicle.fuelType || "-"} {vehicle.capacity ? `• ${vehicle.capacity}` : ""}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Dates</div>
                <div className="adm-list-card-value">Insurance: {formatDate(vehicle.insuranceExpiry)}</div>
                <div className="adm-list-card-sub">Inspection: {formatDate(vehicle.inspectionExpiry)}</div>
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

      {isLoading && <div className="adm-note">Loading vehicles...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
