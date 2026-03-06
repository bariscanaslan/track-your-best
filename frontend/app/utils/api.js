export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export const devicesApi = {
  information: (deviceId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/devices/${deviceId}/information`,
  list: (organizationId, baseUrl = getApiBaseUrl(), onlyActive = false) =>
    `${baseUrl}/api/devices?organizationId=${encodeURIComponent(organizationId)}&onlyActive=${encodeURIComponent(String(onlyActive))}`,
  create: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/devices`,
  update: (deviceId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/devices/${deviceId}`,
  remove: (deviceId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/devices/${deviceId}`,
};

export const gpsApi = {
  lastLocationByDeviceId: (baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/last-location/device-id`,
  lastLocationByDriverId: (driverId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/last-location/driver/${driverId}`,
  lastLocationByUserId: (userId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/last-location/user/${userId}`,
  routeByVehicle: (vehicleId, start, end, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/gps/route/vehicle/${vehicleId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
};

export const driversApi = {
  infoByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/drivers/vehicle/${vehicleId}`,
  list: (organizationId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/drivers?organizationId=${encodeURIComponent(organizationId)}`,
  create: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/drivers`,
  getById: (driverId, organizationId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/drivers/${driverId}?organizationId=${encodeURIComponent(organizationId)}`,
  update: (driverId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/drivers/${driverId}`,
  remove: (driverId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/drivers/${driverId}`,
};

export const vehiclesApi = {
  information: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/vehicles/${vehicleId}/information`,
  list: (organizationId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/vehicles?organizationId=${encodeURIComponent(organizationId)}`,
  getById: (vehicleId, organizationId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/vehicles/${vehicleId}?organizationId=${encodeURIComponent(organizationId)}`,
  create: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/vehicles`,
  update: (vehicleId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/vehicles/${vehicleId}`,
  remove: (vehicleId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/vehicles/${vehicleId}`,
};

export const usersApi = {
  update: (userId, baseUrl = getApiBaseUrl()) => `${baseUrl}/api/users/${userId}`,
};

export const tripsApi = {
  plan: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/trips/plan`,
  approve: (baseUrl = getApiBaseUrl()) => `${baseUrl}/api/trips/approve`,
  driverDecision: (tripId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/driver-decision/${tripId}`,
  driverAction: (tripId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/driver-action/${tripId}`,
  driverFinishCheck: (tripId, currentLat, currentLng, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/driver-finish-check/${tripId}?currentLat=${encodeURIComponent(currentLat)}&currentLng=${encodeURIComponent(currentLng)}`,
  activeByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/active/vehicle/${vehicleId}`,
  historyByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/history/vehicle/${vehicleId}`,
  cancelByVehicle: (vehicleId, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/trips/cancel/vehicle/${vehicleId}`,
};

export const geocodingApi = {
  forward: (query, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/geocoding/forward?query=${encodeURIComponent(query)}`,
  reverse: (lat, lon, baseUrl = getApiBaseUrl()) =>
    `${baseUrl}/api/geocoding/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
};

export const api = {
  devices: devicesApi,
  drivers: driversApi,
  gps: gpsApi,
  users: usersApi,
  vehicles: vehiclesApi,
  trips: tripsApi,
  geocoding: geocodingApi,
};
