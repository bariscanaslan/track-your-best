"use client";

import dynamic from "next/dynamic";

const DriverMapView = dynamic(
  () => import("../../../components/driver/mapview/DriverMapView"),
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

export default function DriverPage() {
  return <DriverMapView />;
}
