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
