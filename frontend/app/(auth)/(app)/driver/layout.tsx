"use client";

import ProtectedRoute from "../../../components/ProtectedRoute";
import DriverNavbar from "../../../components/driver/DriverNavbar";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["driver"]} navbar={<DriverNavbar />}>
      {children}
    </ProtectedRoute>
  );
}
