export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export const devicesApi = {
  information: (deviceId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/devices/${deviceId}/information`,
};

export const gpsApi = {
  lastLocationByDeviceId: (baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/last-location/device-id`,
  routeByVehicle: (vehicleId, start, end, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/route/vehicle/${vehicleId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
};

export const driversApi = {
  infoByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/drivers/vehicle/${vehicleId}`,
};

export const vehiclesApi = {
  information: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/vehicles/${vehicleId}/information`,
};

export const tripsApi = {
  plan: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/trips/plan`,
  approve: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/trips/approve`,
  activeByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/active/vehicle/${vehicleId}`,
  historyByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/history/vehicle/${vehicleId}`,
  cancelByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/cancel/vehicle/${vehicleId}`,
};

export const api = {
  devices: devicesApi,
  drivers: driversApi,
  gps: gpsApi,
  vehicles: vehiclesApi,
  trips: tripsApi,
};
