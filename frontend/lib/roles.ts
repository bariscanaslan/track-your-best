// Single source of truth for roles — mirrors TybRoles.cs on the backend.
// All role strings must match the JWT "role" claim exactly.

export const ROLES = {
  Admin:        "admin",
  FleetManager: "fleet_manager",
  Driver:       "driver",
  Viewer:       "viewer",   // read-only; exists in DB but has no dedicated UI section
} as const;

export type TybRole = (typeof ROLES)[keyof typeof ROLES];

/** Default home route for each role after login. */
export const ROLE_HOME: Record<TybRole, string> = {
  [ROLES.Admin]:        "/admin",
  [ROLES.FleetManager]: "/fleet-manager",
  [ROLES.Driver]:       "/driver",
  [ROLES.Viewer]:       "/admin",
};

/** Route prefixes the role may NOT visit — middleware enforces this server-side. */
export const ROLE_FORBIDDEN_PREFIXES: Record<TybRole, string[]> = {
  [ROLES.Admin]:        ["/driver", "/fleet-manager"],
  [ROLES.FleetManager]: ["/admin",  "/driver"],
  [ROLES.Driver]:       ["/admin",  "/fleet-manager"],
  [ROLES.Viewer]:       ["/driver", "/fleet-manager"],
};
