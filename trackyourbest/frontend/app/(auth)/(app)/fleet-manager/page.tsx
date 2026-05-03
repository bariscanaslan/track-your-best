"use client";

import dynamic from "next/dynamic";

const FleetManagerMapView = dynamic(
  () => import("../../../components/fleet-manager/mapview/FleetManagerMapView"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(circle at top, #111827, #020617)",
      }} />
    ),
  }
);

export default function FleetManagerPage() {
  return <FleetManagerMapView />;
}
