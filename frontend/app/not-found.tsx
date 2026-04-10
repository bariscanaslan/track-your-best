"use client";

import Link from "next/link";
import { useAuth } from "./context/AuthContext";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  fleet_manager: "/fleet-manager",
  driver: "/driver",
};

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? (ROLE_HOME[user.role] ?? "/login") : "/login";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at top, #111827, #020617)",
      fontFamily: "inherit",
      padding: "24px",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: 480,
      }}>

        {/* 404 number */}
        <div style={{
          fontSize: "clamp(80px, 18vw, 140px)",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 8,
          userSelect: "none",
        }}>
          404
        </div>

        {/* Divider dot */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#3b82f6",
          margin: "0 auto 24px",
          boxShadow: "0 0 12px rgba(59,130,246,0.6)",
        }} />

        <div style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#f1f5f9",
          marginBottom: 10,
          letterSpacing: "-0.01em",
        }}>
          Page Not Found
        </div>

        <div style={{
          fontSize: 14,
          color: "#64748b",
          lineHeight: 1.7,
          marginBottom: 36,
        }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </div>

        <Link
          href={home}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            borderRadius: 9999,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 4px 20px rgba(59,130,246,0.35)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          ← Go to Home
        </Link>
      </div>
    </div>
  );
}
