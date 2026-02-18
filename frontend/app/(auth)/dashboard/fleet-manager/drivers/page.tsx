"use client";

import { useMemo, useState } from "react";
import { drivers } from "./data";
import "../fleet-manager.css";

const fields = [
  "license_number",
  "license_type",
  "license_expiry",
  "date_of_birth",
  "hire_date",
  "emergency_contact_name",
  "emergency_contact_phone",
  "is_active",
];

export default function FleetManagerDriversPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const rows = useMemo(() => drivers, []);

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Drivers</div>
        <div className="fm-actions">
          <button className="fm-button fm-button-primary" onClick={() => setIsAddOpen(true)}>
            Add Driver
          </button>
        </div>
      </div>

      <div className="fm-grid">
        {rows.map((driver, idx) => (
          <div key={idx} className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">{driver.license_number}</div>
              <span className="fm-status">{driver.is_active ? "active" : "inactive"}</span>
            </div>

            {fields.map((field) => (
              <div key={field} className="fm-field">
                <div className="fm-field-label">{field}</div>
                <div>{String(driver[field])}</div>
              </div>
            ))}

            <div className="fm-card-actions">
              <button className="fm-link" onClick={() => setEditing(driver)}>
                Edit
              </button>
              <button className="fm-link fm-link-danger" onClick={() => window.alert("Delete action placeholder")}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAddOpen && (
        <div className="fm-modal-backdrop">
          <div className="fm-modal">
            <div className="fm-modal-header">
              <div className="fm-modal-title">Add Driver</div>
              <button className="fm-link" onClick={() => setIsAddOpen(false)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input placeholder="license_number" />
              <input placeholder="license_type" />
              <div className="fm-form-row">
                <input placeholder="license_expiry" />
                <input placeholder="date_of_birth" />
              </div>
              <div className="fm-form-row">
                <input placeholder="hire_date" />
                <input placeholder="is_active" />
              </div>
              <input placeholder="emergency_contact_name" />
              <input placeholder="emergency_contact_phone" />
              <div className="fm-modal-actions">
                <button type="button" className="fm-button" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="fm-button fm-button-primary">
                  Save
                </button>
              </div>
              <div className="fm-note">Form is UI-only for now. Wire to API later.</div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fm-modal-backdrop">
          <div className="fm-modal">
            <div className="fm-modal-header">
              <div className="fm-modal-title">Edit Driver</div>
              <button className="fm-link" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input defaultValue={editing.license_number} placeholder="license_number" />
              <input defaultValue={editing.license_type} placeholder="license_type" />
              <div className="fm-form-row">
                <input defaultValue={editing.license_expiry} placeholder="license_expiry" />
                <input defaultValue={editing.date_of_birth} placeholder="date_of_birth" />
              </div>
              <div className="fm-form-row">
                <input defaultValue={editing.hire_date} placeholder="hire_date" />
                <input defaultValue={String(editing.is_active)} placeholder="is_active" />
              </div>
              <input defaultValue={editing.emergency_contact_name} placeholder="emergency_contact_name" />
              <input defaultValue={editing.emergency_contact_phone} placeholder="emergency_contact_phone" />
              <div className="fm-modal-actions">
                <button type="button" className="fm-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="button" className="fm-button fm-button-primary">
                  Update
                </button>
              </div>
              <div className="fm-note">Form is UI-only for now. Wire to API later.</div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
