/**
 * AppContext.jsx — Global state for EcoRoute.
 *
 * Holds the scenario (locations, vehicles, depot, settings), the latest
 * optimisation result, and implements DYNAMIC RECALCULATION: when
 * auto-recalculate is on and routes already exist, any change to the
 * scenario (waste quantity, overflow, vehicle breakdown, settings…)
 * re-runs the optimiser automatically.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { INITIAL_LOCATIONS, VEHICLES, DEPOT, DEFAULT_SETTINGS, VEHICLE_PALETTE } from '../data/mockData';
import { optimizeRoutes, simulateOverflow as apiSimulateOverflow, healthCheck } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [locations, setLocations] = useState(INITIAL_LOCATIONS);
  const [vehicles, setVehicles] = useState(VEHICLES);
  const [depot] = useState(DEPOT);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [optimisationResult, setOptimisationResult] = useState(null);
  const [isOptimising, setIsOptimising] = useState(false);
  const [optimisationError, setOptimisationError] = useState(null);
  const [autoRecalc, setAutoRecalc] = useState(true);
  const [lastEvent, setLastEvent] = useState(null);       // human-readable change log entry
  const [isStale, setIsStale] = useState(false);          // result no longer matches inputs
  const [backendOnline, setBackendOnline] = useState(null);

  const availableVehicles = vehicles.filter((v) => v.available !== false);
  const totalWaste = locations.reduce((s, l) => s + (Number(l.waste_kg) || 0), 0);
  const totalCapacity = availableVehicles.reduce((s, v) => s + (Number(v.capacity_kg) || 0), 0);

  // ── Backend health ping ────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const ping = () => healthCheck().then(() => alive && setBackendOnline(true))
      .catch(() => alive && setBackendOnline(false));
    ping();
    const t = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // ── Optimisation ───────────────────────────────────────────────────────────
  const reqId = useRef(0);
  const runOptimisation = useCallback(async () => {
    const id = ++reqId.current;
    setIsOptimising(true);
    setOptimisationError(null);
    try {
      const result = await optimizeRoutes(locations, vehicles, depot, settings);
      if (id !== reqId.current) return;        // a newer request superseded this one
      setOptimisationResult({ ...result, generated_at: new Date().toISOString() });
      setIsStale(false);
      setBackendOnline(true);
    } catch (err) {
      if (id !== reqId.current) return;
      setOptimisationError(err);
      if (err.isNetworkError) setBackendOnline(false);
    } finally {
      if (id === reqId.current) setIsOptimising(false);
    }
  }, [locations, vehicles, depot, settings]);

  // Dynamic recalculation: inputs changed after a result exists
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!optimisationResult && !isStale) return;
    if (autoRecalc) {
      const t = setTimeout(() => runOptimisation(), 350);   // debounce rapid edits
      return () => clearTimeout(t);
    }
    setIsStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, vehicles, settings]);

  const note = (msg) => setLastEvent({ msg, at: new Date().toLocaleTimeString() });

  // ── Location CRUD ──────────────────────────────────────────────────────────
  const addLocation = (loc) => {
    const n = locations.length + 1;
    let id = `LOC-${String(n).padStart(3, '0')}`;
    while (locations.some((l) => l.id === id)) id = `LOC-${Date.now() % 100000}`;
    setLocations((prev) => [...prev, { overflow: false, ...loc, id }]);
    note(`Added location ${loc.name}`);
  };
  const updateLocation = (id, updates) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    note(`Updated ${id}`);
  };
  const deleteLocation = (id) => {
    setLocations((prev) => prev.filter((l) => l.id !== id));
    note(`Removed ${id}`);
  };

  // ── Vehicle CRUD ───────────────────────────────────────────────────────────
  const addVehicle = (v) => {
    let n = vehicles.length + 1;
    let id = `V${String(n).padStart(3, '0')}`;
    while (vehicles.some((x) => x.id === id)) id = `V${String(++n).padStart(3, '0')}`;
    const palette = VEHICLE_PALETTE[vehicles.length % VEHICLE_PALETTE.length];
    setVehicles((prev) => [...prev, { available: true, label: `Vehicle ${id.slice(1)}`, ...palette, ...v, id }]);
    note(`Added vehicle ${id} (${v.capacity_kg} kg)`);
  };
  const updateVehicle = (id, updates) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
    note(`Updated ${id}`);
  };
  const deleteVehicle = (id) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    note(`Removed vehicle ${id}`);
  };
  const toggleVehicleAvailability = (id) => {
    const v = vehicles.find((x) => x.id === id);
    updateVehicle(id, { available: v?.available === false });
    note(`${id} marked ${v?.available === false ? 'available' : 'unavailable (breakdown)'}`);
  };

  // ── Scenario events ────────────────────────────────────────────────────────
  const simulateOverflow = async (probability = 0.25) => {
    const res = await apiSimulateOverflow(locations, { probability });
    setLocations(res.locations.map((l) => ({ ...locations.find((x) => x.id === l.id), ...l })));
    note(res.changed.length
      ? `Simulated overflow at ${res.changed.length} point(s): ${res.changed.map((c) => c.id).join(', ')}`
      : 'Overflow simulation: no points overflowed this time');
    return res;
  };
  const resetScenario = () => {
    setLocations(INITIAL_LOCATIONS);
    setVehicles(VEHICLES);
    setSettings(DEFAULT_SETTINGS);
    note('Scenario reset to the 20-location sample');
  };
  const updateSettings = (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    note(`Settings changed: ${Object.keys(patch).join(', ')}`);
  };

  const value = {
    locations, vehicles, availableVehicles, depot, settings,
    optimisationResult, isOptimising, optimisationError, isStale,
    autoRecalc, lastEvent, backendOnline,
    totalWaste, totalCapacity,
    addLocation, updateLocation, deleteLocation,
    addVehicle, updateVehicle, deleteVehicle, toggleVehicleAvailability,
    simulateOverflow, resetScenario, updateSettings,
    runOptimisation, setAutoRecalc, setOptimisationError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
