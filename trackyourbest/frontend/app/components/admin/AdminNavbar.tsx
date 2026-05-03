// app/components/AdminNavbar.tsx

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiCpu, FiHome, FiUsers, FiTruck, FiActivity, FiLogOut } from "react-icons/fi";
import { FaBuilding, FaCar, FaUserTie } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

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

  { href: "/admin/system-events", label: "Events", icon: FiActivity },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
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
            className="tyb-nav-button tyb-nav-button-logout"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <span className="tyb-nav-icon"><FiLogOut size={18} /></span>
            <span className="tyb-nav-label">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
