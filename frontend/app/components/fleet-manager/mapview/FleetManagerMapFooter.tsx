// app/components/mapview/MapFooter.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { FiActivity, FiClock, FiTruck, FiMenu, FiX } from "react-icons/fi";

type MapFooterProps = {
  activePanel: "trips" | "vehicle" | "history" | null;
  hasSelection: boolean;
  onTogglePanel: (panel: "trips" | "vehicle" | "history") => void;
  onClearSelection: () => void;
};

const PANEL_ITEMS = [
  { key: "trips",   label: "Trips",               Icon: FiActivity },
  { key: "vehicle", label: "Vehicle Information",  Icon: FiTruck },
  { key: "history", label: "History",              Icon: FiClock },
] as const;

export default function MapFooter({
  activePanel,
  hasSelection,
  onTogglePanel,
  onClearSelection,
}: MapFooterProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close hamburger menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const activePanelLabel = PANEL_ITEMS.find((p) => p.key === activePanel)?.label ?? null;

  return (
    <footer className="map-footer map-footer--fleet">
      <div className="map-footer-inner">
        <div className="map-footer-title">
          <div className="map-footer-title-text">Fleet Features</div>
          <div className="map-footer-title-subtext">Open feature sidebars from here</div>
        </div>

        {/* Desktop actions */}
        <div className="map-footer-actions">
          {PANEL_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`map-footer-action ${activePanel === key ? "is-active" : ""}`}
              onClick={() => onTogglePanel(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <button
            className="map-footer-action-red is-secondary"
            onClick={onClearSelection}
            disabled={!hasSelection}
          >
            Clear Selection
          </button>
        </div>

        {/* Mobile hamburger */}
        <div className="map-footer-hamburger" ref={menuRef}>
          {menuOpen && (
            <div className="map-footer-mobile-menu">
              {PANEL_ITEMS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`map-footer-mobile-item ${activePanel === key ? "is-active" : ""}`}
                  onClick={() => { onTogglePanel(key); setMenuOpen(false); }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
              <button
                className="map-footer-mobile-item is-danger"
                onClick={() => { onClearSelection(); setMenuOpen(false); }}
                disabled={!hasSelection}
              >
                Clear Selection
              </button>
            </div>
          )}
          <button
            className={`map-footer-hamburger-btn ${menuOpen ? "is-open" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Fleet features menu"
          >
            {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            <span className="map-footer-hamburger-label">
              {activePanelLabel ?? "Fleet Features"}
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
