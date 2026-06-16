"use client";

import { useState, useCallback } from "react";
import { FiLock, FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { authApi } from "../utils/api";
import "./ChangePasswordModal.css";

interface Props {
  onClose: () => void;
}

interface FieldState {
  value: string;
  show: boolean;
  error: string;
}

const initial = (): FieldState => ({ value: "", show: false, error: "" });

function validate(oldPw: string, newPw: string, confirmPw: string) {
  const errors = { old: "", new: "", confirm: "" };

  if (!oldPw) errors.old = "Current password is required.";

  if (!newPw) {
    errors.new = "New password is required.";
  } else if (newPw.length < 8) {
    errors.new = "At least 8 characters required.";
  } else if (
    !/[A-Z]/.test(newPw) ||
    !/[a-z]/.test(newPw) ||
    !/[0-9]/.test(newPw) ||
    !/[^A-Za-z0-9]/.test(newPw)
  ) {
    errors.new = "Must contain uppercase, lowercase, digit, and special character.";
  }

  if (!confirmPw) {
    errors.confirm = "Please confirm your new password.";
  } else if (newPw && confirmPw !== newPw) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [old, setOld] = useState<FieldState>(initial);
  const [newPw, setNewPw] = useState<FieldState>(initial);
  const [confirm, setConfirm] = useState<FieldState>(initial);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const errors = validate(old.value, newPw.value, confirm.value);
    setOld((s) => ({ ...s, error: errors.old }));
    setNewPw((s) => ({ ...s, error: errors.new }));
    setConfirm((s) => ({ ...s, error: errors.confirm }));

    if (errors.old || errors.new || errors.confirm) return;

    setLoading(true);
    try {
      const res = await fetch(authApi.changePassword(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: old.value, newPassword: newPw.value }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 1800);
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data?.message ?? "Failed to change password. Please try again.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [old.value, newPw.value, confirm.value, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="cpw-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="cpw-title">
      <div className="cpw-modal">
        <div className="cpw-header">
          <span className="cpw-title" id="cpw-title">
            <FiLock size={16} />
            Change Password
          </span>
          <button type="button" className="cpw-close" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        {success ? (
          <div className="cpw-alert cpw-alert-success">Password changed successfully!</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="cpw-fields">
              <PasswordField
                label="Current Password"
                state={old}
                onChange={(v) => setOld((s) => ({ ...s, value: v, error: "" }))}
                onToggle={() => setOld((s) => ({ ...s, show: !s.show }))}
                autoComplete="current-password"
              />
              <PasswordField
                label="New Password"
                state={newPw}
                onChange={(v) => setNewPw((s) => ({ ...s, value: v, error: "" }))}
                onToggle={() => setNewPw((s) => ({ ...s, show: !s.show }))}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm New Password"
                state={confirm}
                onChange={(v) => setConfirm((s) => ({ ...s, value: v, error: "" }))}
                onToggle={() => setConfirm((s) => ({ ...s, show: !s.show }))}
                autoComplete="new-password"
              />

              <p className="cpw-requirements">
                Min 8 characters · uppercase · lowercase · digit · special character
              </p>

              {serverError && <div className="cpw-alert cpw-alert-error">{serverError}</div>}
            </div>

            <div className="cpw-actions" style={{ marginTop: 20 }}>
              <button type="button" className="cpw-btn cpw-btn-cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="cpw-btn cpw-btn-submit" disabled={loading}>
                {loading ? "Saving…" : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  state: FieldState;
  onChange: (v: string) => void;
  onToggle: () => void;
  autoComplete?: string;
}

function PasswordField({ label, state, onChange, onToggle, autoComplete }: FieldProps) {
  return (
    <div className="cpw-field">
      <label className="cpw-label">{label}</label>
      <div className="cpw-input-wrap">
        <input
          type={state.show ? "text" : "password"}
          className={`cpw-input${state.error ? " cpw-input-error" : ""}`}
          value={state.value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
        />
        <button type="button" className="cpw-eye" onClick={onToggle} tabIndex={-1} aria-label="Toggle visibility">
          {state.show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
        </button>
      </div>
      {state.error && <span className="cpw-field-error">{state.error}</span>}
    </div>
  );
}
