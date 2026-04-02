using TYB.ApiService.Application.Services;

namespace TYB.ApiService.Background
{
	public class TripRouteDeviationWorker : BackgroundService
	{
		private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(5);

		private readonly IServiceScopeFactory _scopeFactory;
		private readonly ILogger<TripRouteDeviationWorker> _logger;

		public TripRouteDeviationWorker(
			IServiceScopeFactory scopeFactory,
			ILogger<TripRouteDeviationWorker> logger)
		{
			_scopeFactory = scopeFactory;
			_logger = logger;
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			using var timer = new PeriodicTimer(CheckInterval);

			await RunIterationAsync(stoppingToken);

			while (await timer.WaitForNextTickAsync(stoppingToken))
			{
				await RunIterationAsync(stoppingToken);
			}
		}

		private async Task RunIterationAsync(CancellationToken cancellationToken)
		{
			try
			{
				using var scope = _scopeFactory.CreateScope();
				var monitor = scope.ServiceProvider.GetRequiredService<TripRouteDeviationMonitorService>();
				await monitor.EvaluateActiveTripsAsync(cancellationToken);
			}
			catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
			{
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Trip route deviation worker iteration failed.");
			}
		}
	}
}
