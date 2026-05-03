// app/components/DriverNavbar.tsx

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiMap, FiLogOut } from "react-icons/fi";
import { FaMapMarkedAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

import "../../components/Navbar.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
};

const navItems: NavItem[] = [
  { href: "/driver", label: "Map", icon: FiMap },
];

export default function DriverNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const mapStyleKey = "tyb.mapStyle";
  const resolveStoredStyle = (value: string | null) => {
    if (value === "satellite" || value === "light" || value === "colorful") {
      return value;
    }
    return "colorful";
  };
  const [mapStyle, setMapStyle] = useState<"satellite" | "light" | "colorful">(() => {
    if (typeof window === "undefined") return "colorful";
    return resolveStoredStyle(window.localStorage.getItem(mapStyleKey));
  });

  const isActive = (href: string) => pathname === href;
  const isMapRoute = navItems.some((item) => item.href === pathname && item.label === "Map");

  useEffect(() => {
    if (typeof window === "undefined") return;

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
            className="tyb-nav-button tyb-nav-button-logout"
            onClick={async () => { await logout(); router.replace("/login"); }}
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
