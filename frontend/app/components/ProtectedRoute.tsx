// app/components/ProtectedRoute.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLE_HOME, TybRole } from "../../lib/roles";

interface Props {
  children: React.ReactNode;
  allowedRoles?: TybRole[];
  navbar?: React.ReactNode;
}

function AuthStatusScreen({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at top, #111827, #020617)",
        zIndex: 9999,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid rgba(59,130,246,0.2)",
            borderTopColor: "#3b82f6",
            animation: "tyb-spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <div style={{ color: "#94a3b8", fontSize: 13, letterSpacing: "0.05em" }}>{label}</div>
        <style>{`@keyframes tyb-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, allowedRoles, navbar }: Props) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isRoleAllowed = !allowedRoles || (user ? allowedRoles.includes(user.role) : false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!isRoleAllowed && user) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [isAuthenticated, isRoleAllowed, loading, router, user]);

  if (loading) return <AuthStatusScreen label="Checking session..." />;
  if (!isAuthenticated) return <AuthStatusScreen label="Redirecting to login..." />;
  if (!isRoleAllowed) return <AuthStatusScreen label="Redirecting..." />;

  return (
    <>
      {navbar}
      {children}
    </>
  );
}
