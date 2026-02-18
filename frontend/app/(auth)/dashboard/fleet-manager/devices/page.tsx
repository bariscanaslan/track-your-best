"use client";

import { useMemo, useState } from "react";
import { devices } from "./data";
import "../fleet-manager.css";

const fields = [
  "device_name",
  "device_identifier",
  "status",
  "imei",
  "ip_address",
  "last_seen_at",
];

export default function FleetManagerDevicesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const rows = useMemo(() => devices, []);

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Devices</div>
        <div className="fm-actions">
          <button className="fm-button fm-button-primary" onClick={() => setIsAddOpen(true)}>
            Add Device
          </button>
        </div>
      </div>

      <div className="fm-grid">
        {rows.map((device, idx) => (
          <div key={idx} className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">{device.device_name}</div>
              <span className="fm-status">{device.status}</span>
            </div>

            {fields.map((field) => (
              <div key={field} className="fm-field">
                <div className="fm-field-label">{field}</div>
                <div>{String(device[field])}</div>
              </div>
            ))}

            <div className="fm-card-actions">
              <button className="fm-link" onClick={() => setEditing(device)}>
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
              <div className="fm-modal-title">Add Device</div>
              <button className="fm-link" onClick={() => setIsAddOpen(false)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input placeholder="device_name" />
              <input placeholder="device_identifier" />
              <div className="fm-form-row">
                <input placeholder="status" />
                <input placeholder="imei" />
              </div>
              <div className="fm-form-row">
                <input placeholder="ip_address" />
                <input placeholder="last_seen_at" />
              </div>
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
              <div className="fm-modal-title">Edit Device</div>
              <button className="fm-link" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input defaultValue={editing.device_name} placeholder="device_name" />
              <input defaultValue={editing.device_identifier} placeholder="device_identifier" />
              <div className="fm-form-row">
                <input defaultValue={editing.status} placeholder="status" />
                <input defaultValue={editing.imei} placeholder="imei" />
              </div>
              <div className="fm-form-row">
                <input defaultValue={editing.ip_address} placeholder="ip_address" />
                <input defaultValue={editing.last_seen_at} placeholder="last_seen_at" />
              </div>
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
