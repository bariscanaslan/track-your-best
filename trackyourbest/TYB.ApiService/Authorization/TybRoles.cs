namespace TYB.ApiService.Authorization;

/// <summary>
/// Role string constants that match the JWT "role" claim values emitted by AuthService.
/// Use these with the custom attributes in TybAuthorizeAttributes.cs.
/// </summary>
public static class TybRoles
{
    public const string Admin        = "admin";
    public const string FleetManager = "fleet_manager";
    public const string Driver       = "driver";
    public const string Viewer       = "viewer";
}
