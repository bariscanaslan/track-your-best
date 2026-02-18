// app/(auth)/dashboard/layout.tsx

"use client";

import Navbar from "../../components/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth guard temporarily disabled.
  return (
    <div>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
