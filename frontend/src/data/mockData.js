/**
 * mockData.js — EcoRoute sample scenario (Town Hall–Kuppiyawatte–Borella zone).
 *
 * DISCLAIMER (handbook §4.2): SIMULATED DATA.
 *  • Road / place names are real; GPS positions are estimates, not surveyed.
 *  • Waste quantities are simulated for demonstration.
 *  • Vehicle capacities and the depot location are project assumptions,
 *    NOT verified Colombo Municipal Council specifications.
 *
 * The same scenario is stored for the backend in backend/data/sample_scenario.json.
 * 20 locations · 4,800 kg total · 3 vehicles · 5,500 kg capacity.
 */

export const INITIAL_LOCATIONS = [
  { id: 'LOC-001', name: "Public Library (Sir Marcus Fernando Mw.)", area: "Public Library", lat: 6.9220, lng: 79.8617, waste_kg: 240, priority: 'High' },
  { id: 'LOC-002', name: "Marcus Fernando Mawatha", area: "Marcus Fernando Mawatha", lat: 6.9205, lng: 79.8610, waste_kg: 210, priority: 'Medium' },
  { id: 'LOC-003', name: "Dharmapala Mawatha", area: "Dharmapala Mawatha", lat: 6.9178, lng: 79.8580, waste_kg: 260, priority: 'High' },
  { id: 'LOC-004', name: "Green Path (West)", area: "Green Path", lat: 6.9160, lng: 79.8600, waste_kg: 190, priority: 'Low' },
  { id: 'LOC-005', name: "C.W.W. Kannangara Mawatha", area: "C.W.W. Kannangara Mawatha", lat: 6.9143, lng: 79.8625, waste_kg: 280, priority: 'High' },
  { id: 'LOC-006', name: "Albert Crescent", area: "Albert Crescent", lat: 6.9130, lng: 79.8640, waste_kg: 200, priority: 'Medium' },
  { id: 'LOC-007', name: "Flower Road", area: "Flower Road", lat: 6.9115, lng: 79.8655, waste_kg: 300, priority: 'High' },
  { id: 'LOC-008', name: "Reid Avenue", area: "Reid Avenue", lat: 6.9098, lng: 79.8668, waste_kg: 220, priority: 'Medium' },
  { id: 'LOC-009', name: "Cambridge Place", area: "Cambridge Place", lat: 6.9085, lng: 79.8680, waste_kg: 185, priority: 'Low' },
  { id: 'LOC-010', name: "Ananda Coomaraswamy Mawatha", area: "Ananda Coomaraswamy Mawatha", lat: 6.9070, lng: 79.8695, waste_kg: 250, priority: 'High' },
  { id: 'LOC-011', name: "Siridhamma Mawatha", area: "Siridhamma Mawatha", lat: 6.9055, lng: 79.8710, waste_kg: 230, priority: 'Medium' },
  { id: 'LOC-012', name: "Baseline Road (Borella)", area: "Baseline Road", lat: 6.9040, lng: 79.8730, waste_kg: 365, priority: 'High' },
  { id: 'LOC-013', name: "Campbell Terrace", area: "Campbell Terrace", lat: 6.9100, lng: 79.8745, waste_kg: 195, priority: 'Low' },
  { id: 'LOC-014', name: "Nalanda Place", area: "Nalanda Place", lat: 6.9120, lng: 79.8760, waste_kg: 180, priority: 'Low' },
  { id: 'LOC-015', name: "Punchi Borella Junction", area: "Punchi Borella Junction", lat: 6.9025, lng: 79.8755, waste_kg: 310, priority: 'High' },
  { id: 'LOC-016', name: "Greenpath (East / Park Side)", area: "Greenpath", lat: 6.9152, lng: 79.8635, waste_kg: 205, priority: 'Medium' },
  { id: 'LOC-017', name: "Ward Place", area: "Ward Place", lat: 6.9192, lng: 79.8650, waste_kg: 245, priority: 'Medium' },
  { id: 'LOC-018', name: "Gregory's Road", area: "Gregory's Road", lat: 6.9168, lng: 79.8720, waste_kg: 270, priority: 'High' },
  { id: 'LOC-019', name: "Horton Place", area: "Horton Place", lat: 6.9140, lng: 79.8755, waste_kg: 235, priority: 'Medium' },
  { id: 'LOC-020', name: "Rosmead Place", area: "Rosmead Place", lat: 6.9110, lng: 79.8775, waste_kg: 230, priority: 'Medium' },
].map((l) => ({ ...l, overflow: false, note: 'Simulated coordinate – estimated position on named road' }));

// ─── Depot (start/end of every route) ─────────────────────────────────────────
export const DEPOT = {
  name: 'CMC Depot (approx. Town Hall, Colombo 07) – assumed location',
  lat: 6.9167,
  lng: 79.8636,
};

// ─── Vehicle colour palette (assigned in order; extra vehicles cycle) ─────────
export const VEHICLE_PALETTE = [
  { color: '#16a34a', colorName: 'Green'  },
  { color: '#2563eb', colorName: 'Blue'   },
  { color: '#ea580c', colorName: 'Orange' },
  { color: '#9333ea', colorName: 'Purple' },
  { color: '#0891b2', colorName: 'Teal'   },
  { color: '#db2777', colorName: 'Pink'   },
  { color: '#854d0e', colorName: 'Brown'  },
  { color: '#4b5563', colorName: 'Grey'   },
];

export const VEHICLE_TYPES = ['Compact Truck', 'Medium Truck', 'Heavy Truck', 'Tipper', 'Compactor'];

export const VEHICLES = [
  { id: 'V001', label: 'Vehicle 001', capacity_kg: 1000, type: 'Compact Truck', available: true, ...VEHICLE_PALETTE[0] },
  { id: 'V002', label: 'Vehicle 002', capacity_kg: 1500, type: 'Medium Truck',  available: true, ...VEHICLE_PALETTE[1] },
  { id: 'V003', label: 'Vehicle 003', capacity_kg: 3000, type: 'Heavy Truck',   available: true, ...VEHICLE_PALETTE[2] },
];

// ─── Optimisation settings (all are assumptions; editable in the UI) ──────────
export const DEFAULT_SETTINGS = {
  shift_start: '06:00',
  avg_speed_kmh: 20,          // urban collection speed incl. traffic
  service_min_base: 3,        // minutes per stop
  service_min_per_100kg: 2,   // extra minutes per 100 kg loaded
  max_shift_min: 480,
  road_factor: 1.3,           // straight-line → road distance multiplier
  priority_aware: true,
  time_budget_ms: 1500,
  seed: 42,
};

export const MAP_CONFIG = {
  center: [6.9147, 79.863],
  zoom: 14,
  serviceZone: 'Town Hall – Kuppiyawatte – Borella, Colombo',
};

export const PRIORITIES = ['High', 'Medium', 'Low'];

export const PRIORITY_CONFIG = {
  High:   { color: '#ef4444', bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-400'   },
  Medium: { color: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400' },
  Low:    { color: '#6b7280', bg: 'bg-gray-100',  text: 'text-gray-600',  border: 'border-gray-400'  },
};
