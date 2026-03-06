// app/(auth)/(app)/admin/page.tsx

"use client";

import dynamic from "next/dynamic";

const AdminMapView = dynamic(() => import("../../../components/admin/mapview/AdminMapView"), {
  ssr: false,
});

export default function AdminPage() {
  return <AdminMapView />;
}
