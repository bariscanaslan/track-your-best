using NpgsqlTypes;

namespace TYB.ApiService.Infrastructure.Entities.Spatial
{
	public enum TripStatus
	{
		[PgName("driver_approve")]
		DriverApprove,
		[PgName("ongoing")]
		Ongoing,
		[PgName("paused")]
		Paused,
		[PgName("completed")]
		Completed,
		[PgName("cancelled_fm")]
		CancelledFm,
		[PgName("cancelled_driver")]
		CancelledDriver
	}
}
