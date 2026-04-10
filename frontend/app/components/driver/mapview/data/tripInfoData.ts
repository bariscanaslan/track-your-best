export type EtaPrediction = {
  id: string;
  tripId: string;
  predictionTime: string;
  predictedArrivalTime?: string | null;
  remainingDistanceKm?: number | null;
  confidenceScore?: number | null;
  trafficFactor?: number | null;
  modelVersion?: string | null;
  etaMinutes?: number | null;
  isRushHour?: boolean | null;
  avgSpeedKmh?: number | null;
  trafficDensity?: number | null;
  dayOfWeek?: string | null;
  isWeekend?: boolean | null;
};

export type TripPlanPayload = {
  vehicleId: string;
  driverId?: string | null;
  tripName?: string | null;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startAddress?: string | null;
  endAddress?: string | null;
  plannedEndTime?: string | null;
  notes?: string | null;
};

export type TripSummary = {
  id: string;
  vehicleId?: string | null;
  tripName?: string | null;
  status?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  startAddress?: string | null;
  endAddress?: string | null;
  startTime: string;
  endTime?: string | null;
  plannedEndTime?: string | null;
  durationSeconds?: number | null;
  totalDistanceKm?: number | null;
  maxSpeed?: number | null;
  avgSpeed?: number | null;
  stopCount?: number | null;
  pauseCount?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  geometry?: Array<[number, number]> | null;
};
