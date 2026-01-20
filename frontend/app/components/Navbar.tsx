// app/components/Navbar.tsx

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

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

/*
const navItems: NavItem[] = [
  { href: "/", label: "Map", icon: FiMap },
  { href: "/devices", label: "Devices", icon: FiCpu },
  { href: "/routes", label: "Routes", icon: FiGitBranch },
  { href: "/logs", label: "Logs", icon: FiActivity },
];
*/

const navItems: NavItem[] = [
  { href: "/", label: "Map", icon: FiMap },
];

export default function Navbar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };
  
  return (
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
