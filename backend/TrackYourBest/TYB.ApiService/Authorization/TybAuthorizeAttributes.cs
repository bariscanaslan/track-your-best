using Microsoft.AspNetCore.Authorization;

namespace TYB.ApiService.Authorization;

// ─────────────────────────────────────────────────────────────────────────────
//  Single-role gates
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>[AdminOnly] — Only Admin can access this endpoint.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AdminOnlyAttribute : AuthorizeAttribute
{
    public AdminOnlyAttribute() { Roles = TybRoles.Admin; }
}

/// <summary>[FleetManagerOnly] — Only Fleet Manager can access this endpoint.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class FleetManagerOnlyAttribute : AuthorizeAttribute
{
    public FleetManagerOnlyAttribute() { Roles = TybRoles.FleetManager; }
}

/// <summary>[DriverOnly] — Only Driver can access this endpoint.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class DriverOnlyAttribute : AuthorizeAttribute
{
    public DriverOnlyAttribute() { Roles = TybRoles.Driver; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Two-role gates
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>[AdminOrFleetManager] — Admin or Fleet Manager. Typical for management operations.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AdminOrFleetManagerAttribute : AuthorizeAttribute
{
    public AdminOrFleetManagerAttribute()
    {
        Roles = $"{TybRoles.Admin},{TybRoles.FleetManager}";
    }
}

/// <summary>[AdminOrDriver] — Admin or Driver. Typical for trip lifecycle endpoints.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AdminOrDriverAttribute : AuthorizeAttribute
{
    public AdminOrDriverAttribute()
    {
        Roles = $"{TybRoles.Admin},{TybRoles.Driver}";
    }
}

/// <summary>[FleetManagerOrDriver] — Fleet Manager or Driver. Typical for operational/GPS data.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class FleetManagerOrDriverAttribute : AuthorizeAttribute
{
    public FleetManagerOrDriverAttribute()
    {
        Roles = $"{TybRoles.FleetManager},{TybRoles.Driver}";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Any authenticated user
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>[AnyRole] — Any authenticated user regardless of role.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AnyRoleAttribute : AuthorizeAttribute
{
    public AnyRoleAttribute()
    {
        Roles = $"{TybRoles.Admin},{TybRoles.FleetManager},{TybRoles.Driver},{TybRoles.Viewer}";
    }
}
