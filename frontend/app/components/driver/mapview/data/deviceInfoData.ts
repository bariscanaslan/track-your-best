export type DeviceInfo = {
  organizationId?: string | null;
  deviceName: string;
  deviceIdentifier: string;
  signalStrength?: number | null;
  imei?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
};
