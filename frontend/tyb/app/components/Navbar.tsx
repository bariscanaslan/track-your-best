"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiMap,
  FiCpu,
  FiGitBranch,
  FiActivity,
  FiLogOut,
  FiCompass,
} from "react-icons/fi";

import "./Navbar.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

const navItems: NavItem[] = [
  { href: "/", label: "Map", icon: FiMap },
  { href: "/devices", label: "Devices", icon: FiCpu },
  { href: "/routes", label: "Routes", icon: FiGitBranch },
  { href: "/logs", label: "Logs", icon: FiActivity },
];

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    console.log("Logout clicked");
  };

  return (
    <nav className="tyb-navbar">
      <div className="tyb-navbar-inner">
        {/* Sol taraf: logo + marka ismi */}
        <div className="tyb-navbar-left">
          <div className="tyb-navbar-logo">
            <FiCompass size={18} />
          </div>
          <span className="tyb-navbar-brand-text">Track Your Best</span>
        </div>

        {/* Sağ taraf: nav butonları */}
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

          {/* Logout ayrı button */}
          <button
            type="button"
            className="tyb-nav-button tyb-nav-button-logout"
            onClick={handleLogout}
          >
            <span className="tyb-nav-icon">
              <FiLogOut size={18} />
            </span>
            <span className="tyb-nav-label">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
