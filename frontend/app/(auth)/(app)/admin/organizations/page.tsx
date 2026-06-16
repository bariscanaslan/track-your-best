"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { organizationsApi } from "../../../../utils/api";
import "../admin.css";

type OrgRow = {
  id: string;
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminOrganizationsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchOrgs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(organizationsApi.list(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load organizations.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
    );
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((o) =>
      [o.name, o.legalName, o.email, o.address, o.city, o.country].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [rows, appliedQuery]);

  useEffect(() => { setPage(1); }, [appliedQuery, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this organization? All related data may be affected.")) return;
    try {
      const res = await fetch(organizationsApi.remove(id, apiBase), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchOrgs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Organizations</div>
        <div className="adm-actions">
          <input
            className="adm-search"
            placeholder="Search organizations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setAppliedQuery(query); }}
          />
          <button className="adm-button" type="button" onClick={() => setAppliedQuery(query)} title="Search"><FaSearch size={13} /></button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); }} title="Reset"><FaUndo size={13} /></button>
          <Link className="adm-button adm-button-primary" href="/admin/organizations/new">Add Organization</Link>
        </div>
      </div>

      <div className="adm-list">
        {pagedRows.map((org) => (
          <div key={org.id} className="adm-list-row">
            <div className="adm-list-top">
              <div className="adm-list-identity">
                {org.logoUrl
                  ? <img src={org.logoUrl} alt={org.name} className="adm-avatar" />
                  : <div className="adm-nav-card-icon" style={{ width: 40, height: 40, fontSize: 18, borderRadius: 10 }}>🏢</div>
                }
                <div>
                  <div className="adm-list-title-row">
                    <div className="adm-list-title">{org.name || "-"}</div>
                    <span className={`adm-status${org.isActive === false ? " is-inactive" : ""}`}>
                      {org.isActive === false ? "inactive" : "active"}
                    </span>
                  </div>
                  {org.legalName && <div className="adm-list-sub">{org.legalName}{org.taxNumber ? ` • Tax: ${org.taxNumber}` : ""}</div>}
                  <div className="adm-list-sub">ID: {org.id}</div>
                </div>
              </div>
              <div className="adm-list-actions">
                <Link className="adm-link" href={`/admin/organizations/${org.id}`}>Edit</Link>
                <button className="adm-link adm-link-danger" type="button" onClick={() => handleDelete(org.id)}>Delete</button>
              </div>
            </div>
            <div className="adm-list-details" style={{ gridTemplateColumns: "repeat(auto-fill)" }}>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Contact</div>
                <div className="adm-list-card-value">{org.email || "-"}</div>
                <div className="adm-list-card-sub">{org.phone || "-"}</div>
                <div className="adm-list-card-sub" style={{ fontSize: 11 }}>{org.website || "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Location</div>
                <div className="adm-list-card-value" style={{ fontSize: 12 }}>{org.address || "-"}</div>
                <div className="adm-list-card-sub">{[org.city, org.country].filter(Boolean).join(", ") || "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Legal</div>
                <div className="adm-list-card-value" style={{ fontSize: 12 }}>{org.legalName || "-"}</div>
                <div className="adm-list-card-sub">Tax: {org.taxNumber || "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Audit</div>
                <div className="adm-list-card-value">Created: {formatDate(org.createdAt)}</div>
                <div className="adm-list-card-sub">Updated: {formatDate(org.updatedAt)}</div>
                {org.createdByName && <div className="adm-list-card-sub">By: {org.createdByName}</div>}
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

      {isLoading && <div className="adm-note">Loading organizations...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
