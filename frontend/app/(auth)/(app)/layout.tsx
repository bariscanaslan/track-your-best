// app/(auth)/(app)/layout.tsx

"use client";

import AdminNavbar from "../../components/admin/AdminNavbar";
import FleetManagerNavbar from "../../components/fleet-manager/FleetManagerNavbar";
import DriverNavbar from "../../components/driver/DriverNavbar";

import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role =
    pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/driver")
        ? "driver"
        : "fleet-manager";

  // Auth guard temporarily disabled.
  return (
    <div>
      {role === "admin" ? <AdminNavbar /> : role === "driver" ? <DriverNavbar /> : <FleetManagerNavbar />}
      <main>{children}</main>
    </div>
  );
}
