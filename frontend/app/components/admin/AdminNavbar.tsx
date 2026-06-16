// app/components/AdminNavbar.tsx

"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiCpu, FiHome, FiUsers, FiTruck, FiLogOut, FiLock, FiMenu, FiX } from "react-icons/fi";
import { FaBuilding, FaCar, FaUserTie } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import ChangePasswordModal from "../ChangePasswordModal";

import "../../components/Navbar.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: FiHome },
  { href: "/admin/devices", label: "Devices", icon: FiCpu },
  { href: "/admin/users", label: "Users", icon: FiUsers },
  { href: "/admin/organizations", label: "Organizations", icon: FaBuilding },
  { href: "/admin/vehicles", label: "Vehicles", icon: FaCar },
  { href: "/admin/drivers", label: "Drivers", icon: FaUserTie },
  { href: "/admin/trips", label: "Trips", icon: FiTruck },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="tyb-navbar">
        <div className="tyb-navbar-inner">
          <div className="tyb-navbar-left">
            <img src="/tyb-logo.png" alt="Track Your Best Logo" className="tyb-navbar-logo" />
            <span className="tyb-navbar-brand-text">Track Your Best</span>
          </div>

          <div className="tyb-navbar-buttons">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tyb-nav-button ${isActive(item.href) ? "is-active" : ""}`}
                >
                  <span className="tyb-nav-icon">
                    <Icon size={18} />
                  </span>
                  <span className="tyb-nav-label">{item.label}</span>
                </Link>
              );
            })}
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
              onClick={handleLogout}
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
                  onClick={handleLogout}
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
