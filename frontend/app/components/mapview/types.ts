export type DeviceLocation = {
  latitude: number;
  longitude: number;
  gpsTimestamp?: string | null;
  receivedTimestamp?: string | null;
  deviceId: string;
  vehicleId: string;
  deviceName?: string | null;
};
