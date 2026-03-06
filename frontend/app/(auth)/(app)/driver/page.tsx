// app/(auth)/(app)/driver/page.tsx

"use client";

import dynamic from "next/dynamic";

const DriverMapView = dynamic(() => import("../../../components/driver/mapview/DriverMapView"), {
  ssr: false,
});

export default function DriverPage() {
  return <DriverMapView />;
}
