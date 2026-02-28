"use client";

import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { vehiclesApi } from "../../../../utils/api";
import "../fleet-manager.css";

type VehicleRow = {
  id: string;
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
  isActive?: boolean | null;
  createdAt?: string | null;
};

const ORG_ID = "0310ed50-86f2-468c-901d-6b3fcb113914";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function FleetManagerVehiclesPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "vehicleName" | "plateNumber" | "deviceName" | "brand">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "vehicleName" | "plateNumber" | "deviceName" | "brand">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const fetchVehicles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(vehiclesApi.list(ORG_ID, apiBase), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load vehicles.");
      }
      const data = (await res.json()) as VehicleRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load vehicles.";
      setError(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.vehicleName || "").toLowerCase().localeCompare((b.vehicleName || "").toLowerCase())
    );

    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;

    return sorted.filter((vehicle) => {
      const fieldValue = (field?: string | null) => (field ?? "").toLowerCase();

      if (appliedField === "vehicleName") return fieldValue(vehicle.vehicleName).includes(q);
      if (appliedField === "plateNumber") return fieldValue(vehicle.plateNumber).includes(q);
      if (appliedField === "deviceName") return fieldValue(vehicle.deviceName).includes(q);
      if (appliedField === "brand") return fieldValue(vehicle.brand).includes(q);

      const haystack = [
        vehicle.vehicleName,
        vehicle.plateNumber,
        vehicle.deviceName,
        vehicle.brand,
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

  const handleDelete = async (vehicleId: string) => {
    try {
      const res = await fetch(vehiclesApi.remove(vehicleId, apiBase), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Delete failed.");
      }
      await fetchVehicles();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      setError(message);
    }
  };

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Vehicles</div>
        <div className="fm-actions">
          <select
            className="fm-search-select"
            value={searchField}
            onChange={(event) =>
              setSearchField(event.target.value as "all" | "vehicleName" | "plateNumber" | "deviceName" | "brand")
            }
          >
            <option value="all">All fields</option>
            <option value="vehicleName">Vehicle name</option>
            <option value="plateNumber">Plate number</option>
            <option value="deviceName">Device</option>
            <option value="brand">Brand</option>
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
          <a className="fm-button fm-button-primary" href="/fleet-manager/vehicles/new">
            Add Vehicle
          </a>
        </div>
      </div>

      <div className="fm-list">
        {pagedRows.map((vehicle) => (
          <div key={vehicle.id} className="fm-list-row">
            <div className="fm-list-top">
              <div className="fm-list-identity">
                <img
                  src="/tyb-logo.png"
                  alt={vehicle.vehicleName || "Vehicle"}
                  className="fm-avatar"
                />
                <div>
                  <div className="fm-list-title-row">
                    <div className="fm-list-title">{vehicle.vehicleName || "-"}</div>
                    <span className={`fm-status ${vehicle.isActive ? "" : "is-inactive"}`}>
                      {vehicle.isActive ? "active" : "inactive"}
                    </span>
                    {vehicle.brand && <span className="fm-list-pill">{vehicle.brand}</span>}
                  </div>
                  <div className="fm-list-sub">Vehicle ID: {vehicle.id}</div>
                </div>
              </div>
              <div className="fm-list-actions">
                <a className="fm-link" href={`/fleet-manager/vehicles/${vehicle.id}`}>
                  Edit
                </a>
                <button
                  className="fm-link fm-link-danger"
                  onClick={() => {
                    const ok = window.confirm("Delete this vehicle? This cannot be undone.");
                    if (ok) handleDelete(vehicle.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="fm-list-details">
              <div className="fm-list-card">
                <div className="fm-list-card-title">Device</div>
                <div className="fm-list-card-value">{vehicle.deviceName || "-"}</div>
                <div className="fm-list-card-sub">{vehicle.deviceId ?? "-"}</div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">Registration</div>
                <div className="fm-list-card-value">{vehicle.plateNumber || "-"}</div>
                <div className="fm-list-card-sub">{vehicle.model || "-"}</div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">Specs</div>
                <div className="fm-list-card-value">
                  {vehicle.year ? `${vehicle.year}` : "-"} {vehicle.color ? `• ${vehicle.color}` : ""}
                </div>
                <div className="fm-list-card-sub">
                  {vehicle.fuelType || "-"} {vehicle.capacity ? `• ${vehicle.capacity}` : ""}
                </div>
              </div>
              <div className="fm-list-card">
                <div className="fm-list-card-title">Dates</div>
                <div className="fm-list-card-value">Insurance: {formatDate(vehicle.insuranceExpiry ?? null)}</div>
                <div className="fm-list-card-sub">Created: {formatDate(vehicle.createdAt ?? null)}</div>
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

      {isLoading && <div className="fm-note">Loading vehicles...</div>}
      {error && <div className="fm-note">{error}</div>}
    </div>
  );
}
