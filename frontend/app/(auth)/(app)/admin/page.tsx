// app/(auth)/(app)/admin/page.tsx

"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../../../components/MapView"), {
  ssr: false,
});

export default function AdminPage() {
  return <MapView />;
}
