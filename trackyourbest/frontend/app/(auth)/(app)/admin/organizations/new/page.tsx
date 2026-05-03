"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { organizationsApi } from "../../../../../utils/api";
import "../../admin.css";

export default function AdminOrganizationCreatePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const router = useRouter();
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(organizationsApi.create(apiBase), {
        method: "POST",
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
        throw new Error(detail || "Create failed.");
      }
      router.push("/admin/organizations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
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
          <button className="adm-button adm-button-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Create Organization"}
          </button>
        </div>
      </div>

      <div className="adm-edit-banner">
        <div>
          <strong>New Organization</strong>
          <div className="adm-list-sub">Register a new organization in the system.</div>
        </div>
      </div>

      {error && <div className="adm-note adm-warning-danger">{error}</div>}

      <div className="adm-edit-grid">
        <section className="adm-card">
          <div className="adm-card-header"><div className="adm-card-title">Identity</div></div>
          <div className="adm-edit-avatar">
            <img src={form.logoUrl || "/tyb-logo.png"} alt="Logo" className="adm-avatar-lg" />
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
    </div>
  );
}
