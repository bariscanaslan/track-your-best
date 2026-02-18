"use client";

import { useMemo, useState } from "react";
import { vehicles } from "./data";
import "../fleet-manager.css";

const fields = [
  "vehicle_name",
  "plate_number",
  "brand",
  "model",
  "year",
  "vin",
  "color",
  "fuel_type",
  "capacity",
  "insurance_expiry",
  "is_active",
];

export default function FleetManagerVehiclesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const rows = useMemo(() => vehicles, []);

  return (
    <div className="fm-page">
      <div className="fm-header">
        <div className="fm-title">Vehicles</div>
        <div className="fm-actions">
          <button className="fm-button fm-button-primary" onClick={() => setIsAddOpen(true)}>
            Add Vehicle
          </button>
        </div>
      </div>

      <div className="fm-grid">
        {rows.map((vehicle, idx) => (
          <div key={idx} className="fm-card">
            <div className="fm-card-header">
              <div className="fm-card-title">{vehicle.vehicle_name}</div>
              <span className="fm-status">{vehicle.is_active ? "active" : "inactive"}</span>
            </div>

            {fields.map((field) => (
              <div key={field} className="fm-field">
                <div className="fm-field-label">{field}</div>
                <div>{String(vehicle[field])}</div>
              </div>
            ))}

            <div className="fm-card-actions">
              <button className="fm-link" onClick={() => setEditing(vehicle)}>
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
              <div className="fm-modal-title">Add Vehicle</div>
              <button className="fm-link" onClick={() => setIsAddOpen(false)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input placeholder="vehicle_name" />
              <input placeholder="plate_number" />
              <div className="fm-form-row">
                <input placeholder="brand" />
                <input placeholder="model" />
              </div>
              <div className="fm-form-row">
                <input placeholder="year" />
                <input placeholder="vin" />
              </div>
              <div className="fm-form-row">
                <input placeholder="color" />
                <input placeholder="fuel_type" />
              </div>
              <div className="fm-form-row">
                <input placeholder="capacity" />
                <input placeholder="insurance_expiry" />
              </div>
              <input placeholder="is_active" />
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
              <div className="fm-modal-title">Edit Vehicle</div>
              <button className="fm-link" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <form className="fm-form">
              <input defaultValue={editing.vehicle_name} placeholder="vehicle_name" />
              <input defaultValue={editing.plate_number} placeholder="plate_number" />
              <div className="fm-form-row">
                <input defaultValue={editing.brand} placeholder="brand" />
                <input defaultValue={editing.model} placeholder="model" />
              </div>
              <div className="fm-form-row">
                <input defaultValue={editing.year} placeholder="year" />
                <input defaultValue={editing.vin} placeholder="vin" />
              </div>
              <div className="fm-form-row">
                <input defaultValue={editing.color} placeholder="color" />
                <input defaultValue={editing.fuel_type} placeholder="fuel_type" />
              </div>
              <div className="fm-form-row">
                <input defaultValue={editing.capacity} placeholder="capacity" />
                <input defaultValue={editing.insurance_expiry} placeholder="insurance_expiry" />
              </div>
              <input defaultValue={String(editing.is_active)} placeholder="is_active" />
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
