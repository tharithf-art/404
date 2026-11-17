/**
 * api.js — EcoRoute API service layer (all backend calls live here).
 * Backend: FastAPI in /backend. Interactive docs at {BASE}/docs.
 */
import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Normalise errors so callers always get { message, status, isNetworkError }
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const n = { message: 'Unknown error', status: null, isNetworkError: false, isTimeout: false };
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      n.isNetworkError = true;
      n.isTimeout = error.code === 'ECONNABORTED';
      n.message = n.isTimeout
        ? 'Request timed out. The optimisation backend may be overloaded.'
        : 'Cannot reach the optimisation backend.';
    } else if (error.response) {
      n.status = error.response.status;
      const detail = error.response.data?.detail;
      // FastAPI validation errors arrive as an array of {loc, msg}
      n.message = Array.isArray(detail)
        ? detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
        : detail || error.response.data?.message || `Server returned HTTP ${error.response.status}`;
    } else {
      n.message = error.message || 'Network error';
      n.isNetworkError = true;
    }
    return Promise.reject(n);
  }
);

/** POST /api/optimize — capacitated VRP with schedules and baseline comparison. */
export async function optimizeRoutes(locations, vehicles, depot, settings) {
  const payload = {
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      lat: Number(l.lat),
      lng: Number(l.lng),
      waste_kg: Number(l.waste_kg),
      priority: l.priority,
      overflow: !!l.overflow,
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      capacity_kg: Number(v.capacity_kg),
      available: v.available !== false,
      type: v.type,
    })),
    depot,
    settings,
  };
  const response = await apiClient.post('/api/optimize', payload);
  return response.data;
}

/** POST /api/simulate/overflow — randomly mark bins as overflowing (simulated). */
export async function simulateOverflow(locations, { probability = 0.25, seed = null } = {}) {
  const response = await apiClient.post('/api/simulate/overflow', {
    locations: locations.map((l) => ({
      id: l.id, name: l.name, lat: Number(l.lat), lng: Number(l.lng),
      waste_kg: Number(l.waste_kg), priority: l.priority, overflow: !!l.overflow,
    })),
    probability,
    seed,
  });
  return response.data;
}

export async function healthCheck() {
  const response = await apiClient.get('/health', { timeout: 4000 });
  return response.data;
}

export default apiClient;

// ─── Database (SQLite) ────────────────────────────────────────────────────────
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const locBody = (l) => strip({
  id: l.id, name: l.name, area: l.area, lat: l.lat != null ? Number(l.lat) : undefined,
  lng: l.lng != null ? Number(l.lng) : undefined, waste_kg: l.waste_kg != null ? Number(l.waste_kg) : undefined,
  priority: l.priority, overflow: l.overflow, note: l.note,
});
const vehBody = (v) => strip({
  id: v.id, label: v.label, type: v.type, capacity_kg: v.capacity_kg != null ? Number(v.capacity_kg) : undefined,
  available: v.available, color: v.color, colorName: v.colorName,
});

export const db = {
  listLocations: () => apiClient.get('/api/locations').then((r) => r.data),
  createLocation: (l) => apiClient.post('/api/locations', locBody(l)).then((r) => r.data),
  updateLocation: (id, patch) => apiClient.put(`/api/locations/${encodeURIComponent(id)}`, locBody(patch)).then((r) => r.data),
  deleteLocation: (id) => apiClient.delete(`/api/locations/${encodeURIComponent(id)}`).then((r) => r.data),
  listVehicles: () => apiClient.get('/api/vehicles').then((r) => r.data),
  createVehicle: (v) => apiClient.post('/api/vehicles', vehBody(v)).then((r) => r.data),
  updateVehicle: (id, patch) => apiClient.put(`/api/vehicles/${encodeURIComponent(id)}`, vehBody(patch)).then((r) => r.data),
  deleteVehicle: (id) => apiClient.delete(`/api/vehicles/${encodeURIComponent(id)}`).then((r) => r.data),
  listRuns: (limit = 50) => apiClient.get('/api/runs', { params: { limit } }).then((r) => r.data),
  getRun: (id) => apiClient.get(`/api/runs/${id}`).then((r) => r.data),
  clearRuns: () => apiClient.delete('/api/runs').then((r) => r.data),
  stats: () => apiClient.get('/api/db/stats').then((r) => r.data),
  reset: () => apiClient.post('/api/db/reset').then((r) => r.data),
};
