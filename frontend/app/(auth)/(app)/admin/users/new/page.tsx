"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usersApi, organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

type OrgOption = { id: string; name: string };

const ROLES = ["viewer", "driver", "fleet_manager", "admin"] as const;

export default function AdminUserCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  const [form, setForm] = useState({
    organizationId: "",
    username: "",
    email: "",
    fullName: "",
    phone: "",
    role: "viewer",
    avatarUrl: "",
    isActive: true,
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await fetch(organizationsApi.list(apiBase), { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setOrgs(Array.isArray(data) ? data : []);
      } catch { setOrgs([]); }
    };
    fetchOrgs();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(usersApi.create(apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: form.organizationId || null,
          username: form.username.trim(),
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          avatarUrl: form.avatarUrl.trim() || null,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Create failed.");
      }
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
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
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create User"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>New User</strong>
          <div className="adm-list-sub">Create a new user account.</div>
        </div>
      </div>

      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      <div className="adm-edit-grid">
        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">Identity</div></div>
          <div className="adm-edit-avatar">
            <img src={form.avatarUrl || "/tyb-logo.png"} alt="Avatar" className="adm-avatar-lg" />
          </div>
          <div className="adm-form">
            <label className="adm-field">
              <div className="adm-field-label">Full name</div>
              <input placeholder="full_name" value={form.fullName} onChange={handleChange("fullName")} />
            </label>
            <label className="adm-field">
              <div className="adm-field-label">Username</div>
              <input placeholder="username" value={form.username} onChange={handleChange("username")} />
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
          <div className="adm-section-sub">Assign the user to an organization and set their role.</div>
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
    </div>
  );
}
