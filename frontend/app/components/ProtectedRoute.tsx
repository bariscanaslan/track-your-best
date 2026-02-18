// app/components/ProtectedRoute.tsx

"use client";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth guard temporarily disabled.
  return <>{children}</>;
}
