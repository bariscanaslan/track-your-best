// app/(auth)/page.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const ROLE_ROUTES = {
  admin: "/admin",
  fleet_manager: "/fleet-manager",
  driver: "/driver",
  viewer: "/admin",
} as const;

export default function HomePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else {
      router.replace(ROLE_ROUTES[user!.role] ?? "/admin");
    }
  }, [loading, isAuthenticated, user, router]);

  return null;
}
