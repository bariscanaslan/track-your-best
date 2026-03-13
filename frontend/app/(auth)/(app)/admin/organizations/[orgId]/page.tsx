"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

type OrgDetail = {
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} - ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AdminOrganizationEditPage() {
  const params = useParams();
  const orgId = String(params?.orgId ?? "");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    taxNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    website: "",
    logoUrl: "",
    isActive: true,
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fetchOrg = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(organizationsApi.getById(orgId, apiBase), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load organization.");
      const data: OrgDetail = await res.json();
      setOrg(data);
      setForm({
        name: data.name ?? "",
        legalName: data.legalName ?? "",
        taxNumber: data.taxNumber ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        country: data.country ?? "",
        website: data.website ?? "",
        logoUrl: data.logoUrl ?? "",
        isActive: data.isActive ?? true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrg(); }, [orgId]);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(organizationsApi.update(org.id, apiBase), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          legalName: form.legalName.trim() || null,
          taxNumber: form.taxNumber.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          website: form.website.trim() || null,
          logoUrl: form.logoUrl.trim() || null,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Update failed.");
      }
      await fetchOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Organizations</div>
        <div className="adm-actions">
          <Link className="adm-button" href="/admin/organizations">Back to list</Link>
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>Editing Organization</strong>
          <div className="adm-list-sub">Update organization info and status.</div>
        </div>
        <div className="adm-list-sub">Org ID: {orgId}</div>
      </div>

      {isLoading && <div className="adm-note">Loading...</div>}
      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      {org && (
        <div className="adm-edit-grid">
          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Identity</div></div>
            <div className="adm-edit-avatar">
              <img src={form.logoUrl || "/tyb-logo.png"} alt="Logo" className="adm-avatar-lg" />
            </div>
            <div className="adm-section-sub">
              Created: {formatDateTime(org.createdAt)} • Updated: {formatDateTime(org.updatedAt)}
              {org.createdByName && <> • Created by: {org.createdByName}</>}
            </div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Name <span style={{ color: "var(--adm-danger, #ef4444)" }}>*</span></div>
                <input placeholder="organization_name" value={form.name} onChange={handleChange("name")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Legal Name</div>
                <input placeholder="legal_name" value={form.legalName} onChange={handleChange("legalName")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Tax Number</div>
                <input placeholder="tax_number" value={form.taxNumber} onChange={handleChange("taxNumber")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Logo URL</div>
                <input placeholder="https://..." value={form.logoUrl} onChange={handleChange("logoUrl")} />
              </label>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-header"><div className="adm-card-title">Contact & Location</div></div>
            <div className="adm-form">
              <label className="adm-field">
                <div className="adm-field-label">Email</div>
                <input type="email" placeholder="email" value={form.email} onChange={handleChange("email")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Phone</div>
                <input placeholder="phone" value={form.phone} onChange={handleChange("phone")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Website</div>
                <input placeholder="https://..." value={form.website} onChange={handleChange("website")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Address</div>
                <input placeholder="address" value={form.address} onChange={handleChange("address")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">City</div>
                <input placeholder="city" value={form.city} onChange={handleChange("city")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Country</div>
                <input placeholder="country" value={form.country} onChange={handleChange("country")} />
              </label>
              <label className="adm-field">
                <div className="adm-field-label">Status</div>
                <div className="adm-toggle">
                  <input id="org-active" type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
                  <label htmlFor="org-active"><span>{form.isActive ? "Active" : "Inactive"}</span></label>
                </div>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
