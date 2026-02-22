# API Structure Guide

## Scope
This document describes:
- Backend API endpoints in `backend/TrackYourBest/TYB.ApiService/Controllers`
- Frontend endpoint definitions in `frontend/app/api.js`
- Which frontend page/component uses which endpoint

---

## Backend API (TYB.ApiService)

### Active Controllers and Endpoints

| HTTP | Endpoint | Controller | File |
|---|---|---|---|
| GET | `/api/devices/last-locations` | `DevicesController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Core/DevicesController.cs` |
| GET | `/api/devices/{deviceId:guid}/information` | `DevicesController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Core/DevicesController.cs` |
| GET | `/api/vehicles/{vehicleId:guid}/information` | `VehiclesController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Core/VehiclesController.cs` |
| POST | `/api/trips/plan` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |
| POST | `/api/trips/approve` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |
| GET | `/api/trips/driver/{driverId:guid}` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |
| GET | `/api/trips/active/vehicle/{vehicleId:guid}` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |
| POST | `/api/trips/cancel/vehicle/{vehicleId:guid}` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |
| GET | `/api/trips/history/vehicle/{vehicleId:guid}` | `TripsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/TripsController.cs` |

### Controllers Currently With No Action Endpoints

| Base Route | Controller | File |
|---|---|---|
| `/api/driverscores` | `DriverScoresController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Analytics/DriverScoresController.cs` |
| `/api/eta` | `EtaController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Analytics/EtaController.cs` |
| `/api/routeoptimization` | `RouteOptimizationController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Analytics/RouteOptimizationController.cs` |
| `/api/sessionlogs` | `SessionLogsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Audit/SessionLogsController.cs` |
| `/api/systemevents` | `SystemEventsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Audit/SystemEventsController.cs` |
| `/api/organizations` | `OrganizationsController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Core/OrganizationsController.cs` |
| `/api/users` | `UsersController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Core/UsersController.cs` |
| `/api/geofences` | `GeofencesController` | `backend/TrackYourBest/TYB.ApiService/Controllers/Spatial/GeofencesController.cs` |

---

## Frontend API Definitions

### Central Endpoint File
- `frontend/app/api.js`

### Defined Endpoint Builders

| Namespace | Function | Resolved Endpoint Pattern |
|---|---|---|
| `devices` | `lastLocations(baseUrl)` | `${baseUrl}/api/devices/last-locations` |
| `devices` | `information(deviceId, baseUrl)` | `${baseUrl}/api/devices/${deviceId}/information` |
| `vehicles` | `information(vehicleId, baseUrl)` | `${baseUrl}/api/vehicles/${vehicleId}/information` |
| `trips` | `plan(baseUrl)` | `${baseUrl}/api/trips/plan` |
| `trips` | `approve(baseUrl)` | `${baseUrl}/api/trips/approve` |
| `trips` | `activeByVehicle(vehicleId, baseUrl)` | `${baseUrl}/api/trips/active/vehicle/${vehicleId}` |
| `trips` | `historyByVehicle(vehicleId, baseUrl)` | `${baseUrl}/api/trips/history/vehicle/${vehicleId}` |
| `trips` | `cancelByVehicle(vehicleId, baseUrl)` | `${baseUrl}/api/trips/cancel/vehicle/${vehicleId}` |

---

## Frontend Usage Map

### Page-Level Entry Points
- `frontend/app/(auth)/dashboard/page.tsx` renders `MapView` (dynamic import).
- `MapView` performs the map-related API calls.

### Endpoint to Frontend Usage

| Endpoint | Backend Controller | Frontend Consumer File | Used By Page |
|---|---|---|---|
| `/api/devices/last-locations` | `DevicesController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/devices/{deviceId}/information` | `DevicesController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/vehicles/{vehicleId}/information` | `VehiclesController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/trips/plan` | `TripsController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/trips/approve` | `TripsController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/trips/active/vehicle/{vehicleId}` | `TripsController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/trips/history/vehicle/{vehicleId}` | `TripsController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |
| `/api/trips/cancel/vehicle/{vehicleId}` | `TripsController` | `frontend/app/components/MapView.tsx` | `frontend/app/(auth)/dashboard/page.tsx` |

### Auth Calls in Frontend (Not Mapped to Current TYB.ApiService Controllers)

| Endpoint | Frontend File | Status |
|---|---|---|
| `/auth/me` | `frontend/app/context/AuthContext.tsx` | Present in code, but `AuthProvider` is disabled in `frontend/app/layout.tsx` |
| `/auth/logout` | `frontend/app/context/AuthContext.tsx` | Present in code, but `AuthProvider` is disabled in `frontend/app/layout.tsx` |

---

## Notes
- Current map flow follows your rule: location source is device-based (`/api/devices/last-locations`).
- Vehicle and device detail payloads are separated by controller:
  - vehicle detail: `VehiclesController`
  - device detail: `DevicesController`
- `GpsDataController` under `Spatial` was removed from the current structure.
