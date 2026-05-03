"use client";

import { useAuth } from "../context/AuthContext";
import { ROLES, TybRole } from "../../lib/roles";

/**
 * Returns helpers for imperative role checks inside components.
 *
 * Example:
 *   const { isAdmin, isAny } = useRole();
 *   if (isAny(ROLES.Admin, ROLES.FleetManager)) { ... }
 */
export function useRole() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return {
    role,
    isAdmin:        role === ROLES.Admin,
    isFleetManager: role === ROLES.FleetManager,
    isDriver:       role === ROLES.Driver,
    isViewer:       role === ROLES.Viewer,
    /** Returns true if the user's role matches any of the given roles. */
    isAny: (...roles: TybRole[]): boolean => role !== null && roles.includes(role),
  };
}
