"use client";

import ProtectedRoute from "../../../components/ProtectedRoute";
import FleetManagerNavbar from "../../../components/fleet-manager/FleetManagerNavbar";

export default function FleetManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["fleet_manager"]} navbar={<FleetManagerNavbar />}>
      {children}
    </ProtectedRoute>
  );
}
