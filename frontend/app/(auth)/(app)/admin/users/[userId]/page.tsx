"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usersApi, organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

type UserDetail = {
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

type OrgOption = { id: string; name: string };

const ROLES = ["viewer", "driver", "fleet_manager", "admin"] as const;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} - ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminUserEditPage() {
  const params = useParams();
  const userId = String(params?.userId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    organizationId: "",
    username: "",
    fullName: "",
    email: "",
    phone: "",
    role: "viewer",
    avatarUrl: "",
    isActive: true,
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchUser = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(usersApi.getById(userId, apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user.");
      const data: UserDetail = await res.json();
      setUser(data);
      setForm({
        organizationId: data.organizationId ?? "",
        username: data.username ?? "",
        fullName: data.fullName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        role: data.role ?? "viewer",
        avatarUrl: data.avatarUrl ?? "",
        isActive: data.isActive ?? true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await fetch(organizationsApi.list(apiBase), { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setOrgs(Array.isArray(data) ? data : []);
    } catch { setOrgs([]); }
  };

  useEffect(() => { fetchUser(); fetchOrgs(); }, [userId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(usersApi.update(user.id, apiBase), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: form.organizationId || null,
          username: form.username.trim() || null,
          fullName: form.fullName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          avatarUrl: form.avatarUrl.trim() || null,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Update failed.");
      }
      await fetchUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Users</div>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/users">Back to list</Link>
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>Editing User</strong>
          <div className="adm-list-sub">Update identity, role and organization assignment.</div>
        </div>
        <div className="adm-list-sub">User ID: {userId}</div>
      </div>

      {isLoading && <div className="adm-note">Loading user...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      {user && (
        <div className="adm-edit-grid">
          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Identity</div></div>
            <div className="adm-edit-avatar">
              <img src={form.avatarUrl || "/tyb-logo.png"} alt="Avatar" className="adm-avatar-lg" />
            </div>
            <div className="adm-section-sub">
              Created: {formatDateTime(user.createdAt)} • Updated: {formatDateTime(user.updatedAt)} • Last login: {formatDateTime(user.lastLogin)}
              {user.createdByName && <> • Created by: {user.createdByName}</>}
            </div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Username</div>
                <input placeholder="username" value={form.username} onChange={handleChange("username")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Full name</div>
                <input placeholder="full_name" value={form.fullName} onChange={handleChange("fullName")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Email</div>
                <input type="email" placeholder="email" value={form.email} onChange={handleChange("email")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Phone</div>
                <input placeholder="phone" value={form.phone} onChange={handleChange("phone")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Avatar URL</div>
                <input placeholder="avatar_url" value={form.avatarUrl} onChange={handleChange("avatarUrl")} />
              </label>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Role & Organization</div></div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Organization</div>
                <select className="adm-select" value={form.organizationId} onChange={handleChange("organizationId")}>
                  <option value="">-- none --</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Role</div>
                <select className="adm-select" value={form.role} onChange={handleChange("role")}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Status</div>
                <div className="adm-toggle">
                  <input id="user-active" type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
                  <label htmlFor="user-active"><span>{form.isActive ? "Active" : "Inactive"}</span></label>
                </div>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
