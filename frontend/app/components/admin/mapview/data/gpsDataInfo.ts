export type GpsDataInfo = {
  deviceId: string;
  tripId?: string | null;
  geography?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  isMoving?: boolean | null;
  isStopped?: boolean | null;
};

export type GpsRoutePoint = {
  latitude: number;
  longitude: number;
  gpsTimestamp?: string | null;
};

export type MapDeviceLocation = GpsDataInfo & {
  gpsTimestamp?: string | null;
  receivedTimestamp?: string | null;
  vehicleId?: string | null;
  deviceName?: string | null;
};
