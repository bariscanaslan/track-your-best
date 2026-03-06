// app/(auth)/(app)/fleet-manager/page.tsx

"use client";

import dynamic from "next/dynamic";

const FleetManagerMapView = dynamic(() => import("../../../components/fleet-manager/mapview/FleetManagerMapView"), {
  ssr: false,
});

export default function FleetManagerPage() {
  return <FleetManagerMapView/>;
}
