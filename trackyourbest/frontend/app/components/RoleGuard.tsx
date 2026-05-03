"use client";

// Frontend analog of the backend TybAuthorizeAttributes.cs.
// Wrap any JSX subtree to show it only to users with the matching role(s).
// Components that aren't inside an AuthProvider always render nothing.

import { useAuth } from "../context/AuthContext";
import { ROLES, TybRole } from "../../lib/roles";

interface RoleGuardProps {
  roles: TybRole[];
  /** Rendered when the user lacks the required role. Defaults to null. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Generic role gate. Prefer the named shorthands below for readability. */
export default function RoleGuard({ roles, fallback = null, children }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Named shorthands — match TybAuthorizeAttributes.cs one-to-one
// ─────────────────────────────────────────────────────────────────────────────

interface GuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Visible only to Admin. */
export const AdminOnly = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.Admin]} {...p} />;

/** Visible only to Fleet Manager. */
export const FleetManagerOnly = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.FleetManager]} {...p} />;

/** Visible only to Driver. */
export const DriverOnly = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.Driver]} {...p} />;

/** Visible to Admin or Fleet Manager. */
export const AdminOrFleetManager = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.Admin, ROLES.FleetManager]} {...p} />;

/** Visible to Admin or Driver. */
export const AdminOrDriver = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.Admin, ROLES.Driver]} {...p} />;

/** Visible to Fleet Manager or Driver. */
export const FleetManagerOrDriver = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.FleetManager, ROLES.Driver]} {...p} />;

/** Visible to any authenticated user regardless of role. */
export const AnyRole = (p: GuardProps) =>
  <RoleGuard roles={[ROLES.Admin, ROLES.FleetManager, ROLES.Driver, ROLES.Viewer]} {...p} />;
