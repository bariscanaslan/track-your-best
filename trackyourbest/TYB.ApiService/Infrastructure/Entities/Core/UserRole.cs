using NpgsqlTypes;

namespace TYB.ApiService.Infrastructure.Entities.Core
{
	public enum UserRole
	{
		[PgName("viewer")]
		Viewer,
		[PgName("driver")]
		Driver,
		[PgName("admin")]
		Admin,
		[PgName("fleet_manager")]
		FleetManager
	}
}
