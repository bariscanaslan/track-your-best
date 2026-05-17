// app/components/Navbar.tsx

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FiMap, FiCpu, FiLogOut, FiAlertTriangle, FiLock, FiMenu, FiX, FiStar } from "react-icons/fi";
import { FaMapMarkedAlt, FaCar, FaUserTie } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import ChangePasswordModal from "../ChangePasswordModal";

import "../../components/Navbar.css";


type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

const navItemsByRole: Record<string, NavItem[]> = {
  "fleet-manager": [
    { href: "/fleet-manager", label: "Map", icon: FiMap },
    { href: "/fleet-manager/devices", label: "Devices", icon: FiCpu },
    { href: "/fleet-manager/vehicles", label: "Vehicles", icon: FaCar },
    { href: "/fleet-manager/drivers", label: "Drivers", icon: FaUserTie },
    { href: "/fleet-manager/anomalies", label: "Anomalies", icon: FiAlertTriangle },
    { href: "/fleet-manager/driver-scores", label: "Driver Scores", icon: FiStar },
  ],
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "light" | "colorful">("colorful");
  const mapStyleKey = "tyb.mapStyle";

  const role =
    pathname.startsWith("/fleet-manager")
        ? "fleet-manager" : "fleet-manager";

  const navItems = navItemsByRole[role] ?? navItemsByRole.admin;

  const isActive = (href: string) => pathname === href;
  const isMapRoute = navItems.some((item) => item.href === pathname && item.label === "Map");

  const resolveStoredStyle = (value: string | null) => {
    if (value === "satellite" || value === "light" || value === "colorful") {
      return value;
    }
    return "colorful";
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = resolveStoredStyle(window.localStorage.getItem(mapStyleKey));
    setMapStyle(stored);

    const handleStyleEvent = (event: Event) => {
      const next = resolveStoredStyle((event as CustomEvent).detail as string | null);
      setMapStyle(next);
      window.localStorage.setItem(mapStyleKey, next);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== mapStyleKey) return;
      setMapStyle(resolveStoredStyle(event.newValue));
    };

    window.addEventListener("tyb:map-style", handleStyleEvent as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("tyb:map-style", handleStyleEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const labelByStyle = {
    satellite: "Satellite",
    light: "Light-all",
    colorful: "Colorful Streets",
  } as const;

  const handleToggleStyle = () => {
    const next =
      mapStyle === "satellite" ? "light" : mapStyle === "light" ? "colorful" : "satellite";
    setMapStyle(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(mapStyleKey, next);
      window.dispatchEvent(new CustomEvent("tyb:map-style", { detail: next }));
    }
  };

  return (
    <>
      <nav className="tyb-navbar">
        <div className="tyb-navbar-inner">
          <div className="tyb-navbar-left">
            <img
              src="/tyb-logo.png"
              alt="Track Your Best Logo"
              className="tyb-navbar-logo"
            />
            <span className="tyb-navbar-brand-text">Track Your Best</span>
          </div>

          <div className="tyb-navbar-buttons">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tyb-nav-button ${
                    isActive(item.href) ? "is-active" : ""
                  }`}
                >
                  <span className="tyb-nav-icon">
                    <Icon size={18} />
                  </span>
                  <span className="tyb-nav-label">{item.label}</span>
                </Link>
              );
            })}

            {isMapRoute && (
              <button
                type="button"
                className="tyb-map-style-button"
                onClick={handleToggleStyle}
                aria-label={`Map style: ${labelByStyle[mapStyle]}`}
                title={`Map style: ${labelByStyle[mapStyle]}`}
              >
                <FaMapMarkedAlt size={16} />
              </button>
            )}

            <button
              type="button"
              className="tyb-nav-button"
              onClick={() => setShowChangePassword(true)}
              aria-label="Change Password"
            >
              <span className="tyb-nav-icon"><FiLock size={18} /></span>
              <span className="tyb-nav-label">Password</span>
            </button>
            <button
              type="button"
              className="tyb-nav-button tyb-nav-button-logout"
              onClick={async () => { await logout(); router.replace("/login"); }}
              aria-label="Logout"
            >
              <span className="tyb-nav-icon"><FiLogOut size={18} /></span>
              <span className="tyb-nav-label">Logout</span>
            </button>
          </div>

          <div className="tyb-hamburger-wrapper">
            {menuOpen && (
              <div className="tyb-hamburger-overlay" onClick={() => setMenuOpen(false)} />
            )}
            <button
              type="button"
              className="tyb-hamburger-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
            {menuOpen && (
              <div className="tyb-hamburger-menu">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`tyb-hamburger-menu-item ${isActive(item.href) ? "is-active" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
                {isMapRoute && (
                  <button
                    type="button"
                    className="tyb-hamburger-menu-item"
                    onClick={() => { handleToggleStyle(); setMenuOpen(false); }}
                  >
                    <FaMapMarkedAlt size={16} />
                    {labelByStyle[mapStyle]}
                  </button>
                )}
                <button
                  type="button"
                  className="tyb-hamburger-menu-item"
                  onClick={() => { setShowChangePassword(true); setMenuOpen(false); }}
                >
                  <FiLock size={16} />
                  Password
                </button>
                <button
                  type="button"
                  className="tyb-hamburger-menu-item is-logout"
                  onClick={async () => { await logout(); router.replace("/login"); }}
                >
                  <FiLogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}
