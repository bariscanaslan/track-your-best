// app/(auth)/(app)/admin/page.tsx

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { devicesApi, driversApi, vehiclesApi, usersApi, organizationsApi } from "../../../utils/api";
import "./admin.css";

type Stats = {
  users: number;
  devices: number;
  vehicles: number;
  drivers: number;
  organizations: number;
};

const navCards = [
  {
    href: "/admin/devices",
    title: "Devices",
    sub: "Manage GPS tracking devices",
    icon: "📡",
  },
  {
    href: "/admin/users",
    title: "Users",
    sub: "Manage user accounts and roles",
    icon: "👥",
  },
  {
    href: "/admin/organizations",
    title: "Organizations",
    sub: "Manage organizations",
    icon: "🏢",
  },
  {
    href: "/admin/vehicles",
    title: "Vehicles",
    sub: "Manage fleet vehicles",
    icon: "🚗",
  },
  {
    href: "/admin/drivers",
    title: "Drivers",
    sub: "Manage driver profiles",
    icon: "🧑‍✈️",
  },
  {
    href: "/admin/sessions",
    title: "Sessions",
    sub: "Inspect trip sessions and logs",
    icon: "📋",
  },
  {
    href: "/admin/system-events",
    title: "System Events",
    sub: "System-wide event log",
    icon: "⚡",
  },
];

export default function AdminDashboardPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [stats, setStats] = useState<Stats>({ users: 0, devices: 0, vehicles: 0, drivers: 0, organizations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [usersRes, devicesRes, vehiclesRes, driversRes, orgsRes] = await Promise.allSettled([
          fetch(usersApi.list(apiBase), { credentials: "include" }),
          fetch(devicesApi.listAll(apiBase), { credentials: "include" }),
          fetch(vehiclesApi.listAll(apiBase), { credentials: "include" }),
          fetch(driversApi.listAll(apiBase), { credentials: "include" }),
          fetch(organizationsApi.list(apiBase), { credentials: "include" }),
        ]);

        const count = async (res: PromiseSettledResult<Response>) => {
          if (res.status === "rejected" || !res.value.ok) return 0;
          try {
            const data = await res.value.json();
            return Array.isArray(data) ? data.length : 0;
          } catch {
            return 0;
          }
        };

        const [users, devices, vehicles, drivers, organizations] = await Promise.all([
          count(usersRes),
          count(devicesRes),
          count(vehiclesRes),
          count(driversRes),
          count(orgsRes),
        ]);

        setStats({ users, devices, vehicles, drivers, organizations });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statItems = [
    { label: "Users", value: stats.users, href: "/admin/users" },
    { label: "Devices", value: stats.devices, href: "/admin/devices" },
    { label: "Vehicles", value: stats.vehicles, href: "/admin/vehicles" },
    { label: "Drivers", value: stats.drivers, href: "/admin/drivers" },
    { label: "Organizations", value: stats.organizations, href: "/admin/organizations" },
  ];

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div className="adm-title">Admin Dashboard</div>
        <div className="adm-list-sub">System overview and management hub</div>
      </div>

      <div className="adm-stats-grid">
        {statItems.map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
            <div className="adm-stat-card">
              <div className="adm-stat-label">{item.label}</div>
              <div className="adm-stat-value">{loading ? "—" : item.value}</div>
              <div className="adm-stat-sub">View all →</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="adm-nav-grid">
        {navCards.map((card) => (
          <Link key={card.href} href={card.href} className="adm-nav-card">
            <div className="adm-nav-card-icon">{card.icon}</div>
            <div className="adm-nav-card-info">
              <div className="adm-nav-card-title">{card.title}</div>
              <div className="adm-nav-card-sub">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
