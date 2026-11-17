/**
 * AppContext.jsx — Global state for EcoRoute.
 *
 * DATA SOURCE
 *   Locations and vehicles are loaded from the backend SQLite database and every
 *   add / edit / delete is saved there. If the backend is offline the app falls
 *   back to the built-in sample data (changes are then NOT saved).
 *
 * DYNAMIC RECALCULATION
 *   When auto-recalculate is on and routes already exist, any change to the
 *   scenario (waste, overflow, vehicle breakdown, settings…) re-runs the optimiser.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { INITIAL_LOCATIONS, VEHICLES, DEPOT, DEFAULT_SETTINGS, VEHICLE_PALETTE } from '../data/mockData';
import { optimizeRoutes, simulateOverflow as apiSimulateOverflow, healthCheck, db } from '../services/api';

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
  const [lastEvent, setLastEvent] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  const [dataSource, setDataSource] = useState('loading');   // 'loading' | 'database' | 'offline'
  const [dataError, setDataError] = useState(null);
  const [runsVersion, setRunsVersion] = useState(0);          // bump to refresh run history views

  const availableVehicles = vehicles.filter((v) => v.available !== false);
  const totalWaste = locations.reduce((s, l) => s + (Number(l.waste_kg) || 0), 0);
  const totalCapacity = availableVehicles.reduce((s, v) => s + (Number(v.capacity_kg) || 0), 0);
  const useDb = dataSource === 'database';

  const note = (msg) => setLastEvent({ msg, at: new Date().toLocaleTimeString() });
  const fail = (err) => setDataError(err?.message ? err : { message: String(err) });

  // ── Load data from the database ────────────────────────────────────────────
  const loadFromDatabase = useCallback(async () => {
    try {
      const [locs, vehs] = await Promise.all([db.listLocations(), db.listVehicles()]);
      setLocations(locs);
      setVehicles(vehs);
      setDataSource('database');
      setBackendOnline(true);
      setDataError(null);
      return true;
    } catch {
      setDataSource((s) => (s === 'database' ? s : 'offline'));
      return false;
    }
  }, []);

  useEffect(() => { loadFromDatabase(); }, [loadFromDatabase]);

  // ── Backend health ping (also switches to the database when it comes online) ─
  const sourceRef = useRef(dataSource);
  sourceRef.current = dataSource;
  useEffect(() => {
    let alive = true;
    const ping = () => healthCheck()
      .then(() => {
        if (!alive) return;
        setBackendOnline(true);
        if (sourceRef.current === 'offline') loadFromDatabase();
      })
      .catch(() => alive && setBackendOnline(false));
    ping();
    const t = setInterval(ping, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [loadFromDatabase]);

  // ── Optimisation ───────────────────────────────────────────────────────────
  const reqId = useRef(0);
  const runOptimisation = useCallback(async () => {
    const id = ++reqId.current;
    setIsOptimising(true);
    setOptimisationError(null);
    try {
      const result = await optimizeRoutes(locations, vehicles, depot, settings);
      if (id !== reqId.current) return;
      setOptimisationResult({ ...result, generated_at: new Date().toISOString() });
      setIsStale(false);
      setBackendOnline(true);
      setRunsVersion((v) => v + 1);
    } catch (err) {
      if (id !== reqId.current) return;
      setOptimisationError(err);
      if (err.isNetworkError) setBackendOnline(false);
    } finally {
      if (id === reqId.current) setIsOptimising(false);
    }
  }, [locations, vehicles, depot, settings]);

  // Dynamic recalculation when inputs change after a result exists
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!optimisationResult && !isStale) return;
    if (autoRecalc) {
      const t = setTimeout(() => runOptimisation(), 350);
      return () => clearTimeout(t);
    }
    setIsStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, vehicles, settings]);

  // ── Location CRUD (saved to the database when online) ──────────────────────
  const addLocation = async (loc) => {
    try {
      if (useDb) {
        const saved = await db.createLocation(loc);
        setLocations((prev) => [...prev, saved]);
        note(`Saved new location ${saved.id} to database`);
      } else {
        let n = locations.length + 1;
        let id = `LOC-${String(n).padStart(3, '0')}`;
        while (locations.some((l) => l.id === id)) id = `LOC-${String(++n).padStart(3, '0')}`;
        setLocations((prev) => [...prev, { overflow: false, ...loc, id }]);
        note(`Added location ${id} (offline – not saved)`);
      }
    } catch (e) { fail(e); }
  };
  const updateLocation = async (id, updates) => {
    try {
      if (useDb) {
        const saved = await db.updateLocation(id, updates);
        setLocations((prev) => prev.map((l) => (l.id === id ? saved : l)));
      } else {
        setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
      }
      note(`Updated ${id}${useDb ? '' : ' (offline – not saved)'}`);
    } catch (e) { fail(e); }
  };
  const deleteLocation = async (id) => {
    try {
      if (useDb) await db.deleteLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      note(`Removed ${id}`);
    } catch (e) { fail(e); }
  };

  // ── Vehicle CRUD ───────────────────────────────────────────────────────────
  const addVehicle = async (v) => {
    try {
      if (useDb) {
        const saved = await db.createVehicle(v);
        setVehicles((prev) => [...prev, saved]);
        note(`Saved new vehicle ${saved.id} (${saved.capacity_kg} kg) to database`);
      } else {
        let n = vehicles.length + 1;
        let id = `V${String(n).padStart(3, '0')}`;
        while (vehicles.some((x) => x.id === id)) id = `V${String(++n).padStart(3, '0')}`;
        const palette = VEHICLE_PALETTE[vehicles.length % VEHICLE_PALETTE.length];
        setVehicles((prev) => [...prev, { available: true, label: `Vehicle ${id.slice(1)}`, ...palette, ...v, id }]);
        note(`Added vehicle ${id} (offline – not saved)`);
      }
    } catch (e) { fail(e); }
  };
  const updateVehicle = async (id, updates) => {
    try {
      if (useDb) {
        const saved = await db.updateVehicle(id, updates);
        setVehicles((prev) => prev.map((v) => (v.id === id ? saved : v)));
      } else {
        setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
      }
      note(`Updated ${id}`);
    } catch (e) { fail(e); }
  };
  const deleteVehicle = async (id) => {
    try {
      if (useDb) await db.deleteVehicle(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      note(`Removed vehicle ${id}`);
    } catch (e) { fail(e); }
  };
  const toggleVehicleAvailability = async (id) => {
    const v = vehicles.find((x) => x.id === id);
    const nowAvailable = v?.available === false;
    await updateVehicle(id, { available: nowAvailable });
    note(`${id} marked ${nowAvailable ? 'available' : 'unavailable (breakdown)'}`);
  };

  // ── Scenario events ────────────────────────────────────────────────────────
  const simulateOverflow = async (probability = 0.25) => {
    const res = await apiSimulateOverflow(locations, { probability });
    if (useDb && res.changed.length) {
      await Promise.all(res.changed.map((c) => db.updateLocation(c.id, { waste_kg: c.to_kg, overflow: true })));
    }
    setLocations(res.locations.map((l) => ({ ...locations.find((x) => x.id === l.id), ...l })));
    note(res.changed.length
      ? `Simulated overflow at ${res.changed.length} point(s): ${res.changed.map((c) => c.id).join(', ')}`
      : 'Overflow simulation: no points overflowed this time');
    return res;
  };
  const resetScenario = async () => {
    setSettings(DEFAULT_SETTINGS);
    if (useDb) {
      try { await db.reset(); await loadFromDatabase(); } catch (e) { fail(e); }
    } else {
      setLocations(INITIAL_LOCATIONS);
      setVehicles(VEHICLES);
    }
    note('Scenario reset to the 20-location sample');
  };
  const updateSettings = (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    note(`Settings changed: ${Object.keys(patch).join(', ')}`);
  };
  const loadRunResult = (result) => {
    setOptimisationResult({ ...result, generated_at: new Date().toISOString(), from_history: true });
    setIsStale(true);
  };

  const value = {
    locations, vehicles, availableVehicles, depot, settings,
    optimisationResult, isOptimising, optimisationError, isStale,
    autoRecalc, lastEvent, backendOnline, dataSource, dataError, runsVersion,
    totalWaste, totalCapacity,
    addLocation, updateLocation, deleteLocation,
    addVehicle, updateVehicle, deleteVehicle, toggleVehicleAvailability,
    simulateOverflow, resetScenario, updateSettings, loadFromDatabase, loadRunResult,
    runOptimisation, setAutoRecalc, setOptimisationError, setDataError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
