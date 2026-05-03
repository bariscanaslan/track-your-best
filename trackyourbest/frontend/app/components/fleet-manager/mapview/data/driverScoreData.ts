export type DriverScoreSummary = {
  driverId: string;
  averageOverallScore: number;
  tripCount: number;
  lastCalculatedAt?: string | null;
};