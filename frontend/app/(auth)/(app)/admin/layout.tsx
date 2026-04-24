"use client";

import ProtectedRoute from "../../../components/ProtectedRoute";
import AdminNavbar from "../../../components/admin/AdminNavbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin"]} navbar={<AdminNavbar />}>
      {children}
    </ProtectedRoute>
  );
}
