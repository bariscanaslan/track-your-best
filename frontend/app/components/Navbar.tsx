// app/components/Navbar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FiMap, FiCpu, FiGitBranch, FiActivity } from "react-icons/fi";

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

const navItemsByRole: Record<string, NavItem[]> = {
  admin: [
    { href: "/dashboard/admin", label: "Map", icon: FiMap },
    { href: "/dashboard/admin/vehicles", label: "Vehicles", icon: FiCpu },
    { href: "/dashboard/admin/reports", label: "Reports", icon: FiActivity },
  ],
  "fleet-manager": [
    { href: "/dashboard/fleet-manager", label: "Map", icon: FiMap },
    { href: "/dashboard/fleet-manager/devices", label: "Devices", icon: FiCpu },
    { href: "/dashboard/fleet-manager/drivers", label: "Drivers", icon: FiGitBranch },
    { href: "/dashboard/fleet-manager/vehicles", label: "Vehicles", icon: FiActivity },
  ],
  driver: [
    { href: "/dashboard/driver", label: "Map", icon: FiMap },
    { href: "/dashboard/driver/trips", label: "Trips", icon: FiGitBranch },
    { href: "/dashboard/driver/logs", label: "Logs", icon: FiActivity },
  ],
};

export default function Navbar() {
  const pathname = usePathname();

  const role =
    pathname.includes("/dashboard/admin")
      ? "admin"
      : pathname.includes("/dashboard/fleet-manager")
        ? "fleet-manager"
        : pathname.includes("/dashboard/driver")
          ? "driver"
          : "admin";

  const navItems = navItemsByRole[role] ?? navItemsByRole.admin;

  const isActive = (href: string) => pathname === href;

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

          {/* Logout button disabled while auth is off. */}
        </div>
      </div>
    </nav>
  );
}
