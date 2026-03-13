"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaUndo } from "react-icons/fa";
import { usersApi } from "../../../../utils/api";
import "../admin.css";

type UserRow = {
  id: string;
  organizationId?: string | null;
  organizationName?: string | null;
  username: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  isActive?: boolean | null;
  lastLogin?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} - ${formatDate(value)}`;
};

const rolePillClass = (role: string) => {
  if (role === "admin") return "adm-list-pill adm-list-pill-red";
  if (role === "fleet_manager") return "adm-list-pill adm-list-pill-yellow";
  if (role === "driver") return "adm-list-pill adm-list-pill-green";
  return "adm-list-pill";
};

export default function AdminUsersPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<"all" | "fullName" | "email" | "username" | "role">("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedField, setAppliedField] = useState<"all" | "fullName" | "email" | "username" | "role">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(usersApi.list(apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users.");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.fullName || a.username || "").toLowerCase().localeCompare((b.fullName || b.username || "").toLowerCase())
    );
    const q = appliedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((u) => {
      const fv = (v?: string | null) => (v ?? "").toLowerCase();
      if (appliedField === "fullName") return fv(u.fullName).includes(q);
      if (appliedField === "email") return fv(u.email).includes(q);
      if (appliedField === "username") return fv(u.username).includes(q);
      if (appliedField === "role") return fv(u.role).includes(q);
      return [u.fullName, u.email, u.username, u.role].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, appliedQuery, appliedField]);

  useEffect(() => { setPage(1); }, [appliedQuery, appliedField, rows.length]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(usersApi.remove(id, apiBase), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Users</div>
        <div className="adm-actions">
          <select className="adm-search-select" value={searchField} onChange={(e) => setSearchField(e.target.value as typeof searchField)}>
            <option value="all">All fields</option>
            <option value="fullName">Full name</option>
            <option value="email">Email</option>
            <option value="username">Username</option>
            <option value="role">Role</option>
          </select>
          <input
            className="adm-search"
            placeholder="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setAppliedField(searchField); setAppliedQuery(query); } }}
          />
          <button className="adm-button" type="button" onClick={() => { setAppliedField(searchField); setAppliedQuery(query); }} title="Search"><FaSearch size={13} /></button>
          <button className="adm-button" type="button" onClick={() => { setQuery(""); setAppliedQuery(""); setSearchField("all"); setAppliedField("all"); }} title="Reset"><FaUndo size={13} /></button>
          <Link className="adm-button adm-button-primary" href="/admin/users/new">Add User</Link>
        </div>
      </div>

      <div className="adm-list">
        {pagedRows.map((user) => (
          <div key={user.id} className="adm-list-row">
            <div className="adm-list-top">
              <div className="adm-list-identity">
                <img src={user.avatarUrl || "/tyb-logo.png"} alt={user.fullName || "User"} className="adm-avatar" />
                <div>
                  <div className="adm-list-title-row">
                    <div className="adm-list-title">{user.fullName || user.username || "-"}</div>
                    <span className={`adm-status${user.isActive === false ? " is-inactive" : ""}`}>
                      {user.isActive === false ? "inactive" : "active"}
                    </span>
                    <span className={rolePillClass(user.role)}>{user.role?.replace("_", " ")}</span>
                  </div>
                  <div className="adm-list-sub">@{user.username} • {user.email}</div>
                </div>
              </div>
              <div className="adm-list-actions">
                <Link className="adm-link" href={`/admin/users/${user.id}`}>Edit</Link>
                <button className="adm-link adm-link-danger" type="button" onClick={() => handleDelete(user.id)}>Delete</button>
              </div>
            </div>
            <div className="adm-list-details">
              <div className="adm-list-card">
                <div className="adm-list-card-title">Contact</div>
                <div className="adm-list-card-value">{user.email || "-"}</div>
                <div className="adm-list-card-sub">{user.phone || "-"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Organization</div>
                <div className="adm-list-card-value">{user.organizationName || "—"}</div>
                <div className="adm-list-card-sub">Role: {user.role?.replace("_", " ")}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Account</div>
                <div className="adm-list-card-value">Created: {formatDate(user.createdAt)}</div>
                <div className="adm-list-card-sub">Updated: {formatDate(user.updatedAt)}</div>
                <div className="adm-list-card-sub">Last login: {formatDateTime(user.lastLogin)}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">Created By</div>
                <div className="adm-list-card-value">{user.createdByName || "—"}</div>
              </div>
              <div className="adm-list-card">
                <div className="adm-list-card-title">User ID</div>
                <div className="adm-list-card-value" style={{ fontSize: 11, wordBreak: "break-all" }}>{user.id}</div>
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

      {isLoading && <div className="adm-note">Loading users...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}
    </div>
  );
}
