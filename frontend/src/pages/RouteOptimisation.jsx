/**
 * RouteOptimisation.jsx — Generate routes, show collection schedules,
 * capacity validation, unserviced locations and utilisation.
 * All optimisation runs in the Python backend (POST /api/optimize).
 */
import React, { useEffect, useState } from 'react';
import {
  Route, AlertTriangle, CheckCircle2, Navigation, Settings2, Clock, ChevronDown, ChevronUp, Flame, Cpu,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import ScenarioBar from '../components/ScenarioBar';
import PriorityBadge from '../components/PriorityBadge';

// ── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const { settings, updateSettings } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [err, setErr] = useState(null);
  useEffect(() => setDraft(settings), [settings]);

  const num = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const apply = () => {
    const out = {
      shift_start: draft.shift_start,
      avg_speed_kmh: parseFloat(draft.avg_speed_kmh),
      service_min_base: parseFloat(draft.service_min_base),
      service_min_per_100kg: parseFloat(draft.service_min_per_100kg),
      max_shift_min: parseFloat(draft.max_shift_min),
      road_factor: parseFloat(draft.road_factor),
      priority_aware: !!draft.priority_aware,
    };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(out.shift_start)) return setErr('Shift start must be HH:MM.');
    if (!(out.avg_speed_kmh > 1 && out.avg_speed_kmh <= 120)) return setErr('Speed must be 1–120 km/h.');
    if (!(out.road_factor >= 1 && out.road_factor <= 3)) return setErr('Road factor must be 1.0–3.0.');
    if ([out.service_min_base, out.service_min_per_100kg].some((x) => !(x >= 0))) return setErr('Service times must be ≥ 0.');
    if (!(out.max_shift_min > 0)) return setErr('Shift length must be positive.');
    setErr(null);
    updateSettings(out);
  };

  return (
    <div className="card py-3">
      <button className="flex w-full items-center justify-between text-sm font-semibold text-slate-700" onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2"><Settings2 size={15} /> Planning assumptions</span>
        <span className="flex items-center gap-2 text-xs font-normal text-slate-500">
          Shift {settings.shift_start} · {settings.avg_speed_kmh} km/h · road factor {settings.road_factor} ·{' '}
          {settings.priority_aware ? 'priority-aware' : 'distance only'}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div><label className="label">Shift start</label>
              <input className="input" type="time" value={draft.shift_start} onChange={num('shift_start')} /></div>
            <div><label className="label">Avg speed (km/h)</label>
              <input className="input" type="number" value={draft.avg_speed_kmh} onChange={num('avg_speed_kmh')} /></div>
            <div><label className="label">Service min / stop</label>
              <input className="input" type="number" value={draft.service_min_base} onChange={num('service_min_base')} /></div>
            <div><label className="label">Extra min / 100 kg</label>
              <input className="input" type="number" value={draft.service_min_per_100kg} onChange={num('service_min_per_100kg')} /></div>
            <div><label className="label">Max shift (min)</label>
              <input className="input" type="number" value={draft.max_shift_min} onChange={num('max_shift_min')} /></div>
            <div><label className="label">Road factor</label>
              <input className="input" type="number" step="0.05" value={draft.road_factor} onChange={num('road_factor')} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!draft.priority_aware}
              onChange={(e) => setDraft((d) => ({ ...d, priority_aware: e.target.checked }))} />
            Priority-aware optimisation (serve High / overflowing points first when capacity is short)
          </label>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end"><button className="btn-primary" onClick={apply}>Apply</button></div>
          <p className="text-[11px] text-slate-400">
            These are planning assumptions, not measured values. Distance = straight-line × road factor.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Route card with schedule ──────────────────────────────────────────────────
function RouteCard({ route, vehicle }) {
  const [showAll, setShowAll] = useState(true);
  if (!vehicle) return null;
  const pct = Math.round(route.capacity_pct ?? 0);
  const barColor = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : vehicle.color;
  const empty = !route.stops?.length;

  return (
    <div className="card" style={{ borderLeftWidth: 4, borderLeftColor: vehicle.color }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${vehicle.color}1a` }}>
            <Navigation size={18} style={{ color: vehicle.color }} />
          </div>
          <div>
            <p className="font-bold text-slate-900">{vehicle.id} <span className="font-normal text-slate-500 text-sm">· {vehicle.type}</span></p>
            <p className="text-xs text-slate-500">
              {empty ? 'Not needed for this plan' : <>Depot {route.start_time} → back at depot {route.end_time} ({Math.round(route.duration_min)} min)</>}
            </p>
          </div>
        </div>
        <span className="badge text-white font-semibold" style={{ backgroundColor: vehicle.color }}>
          {route.stops?.length ?? 0} stops
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
          <p className="text-xs text-slate-500">Distance</p>
          <p className="text-lg font-bold text-slate-800">{route.total_distance_km} km</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
          <p className="text-xs text-slate-500">Load</p>
          <p className="text-lg font-bold text-slate-800">{route.total_waste_kg.toLocaleString()} kg</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
          <p className="text-xs text-slate-500">Utilisation</p>
          <p className="text-lg font-bold" style={{ color: barColor }}>{pct}%</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
        </div>
        <p className="text-xs text-slate-500 mt-1 flex justify-between">
          <span>{route.total_waste_kg.toLocaleString()} / {route.capacity_kg.toLocaleString()} kg</span>
          <span className="text-green-700 font-medium">✓ within capacity · {route.spare_capacity_kg.toLocaleString()} kg spare</span>
        </p>
        {route.exceeds_shift && (
          <p className="text-xs text-red-600 mt-1">⚠ Route is longer than the shift limit.</p>
        )}
      </div>

      {!empty && (
        <div>
          <button className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
            onClick={() => setShowAll(!showAll)}>
            <Clock size={12} /> Collection schedule {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showAll && (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-left">
                    <th className="py-1 px-1">#</th><th className="py-1 px-1">Arrive</th><th className="py-1 px-1">Location</th>
                    <th className="py-1 px-1 text-right">kg</th><th className="py-1 px-1 text-right">Load</th><th className="py-1 px-1 text-right">Leg km</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-400 border-t border-slate-100">
                    <td className="py-1 px-1">D</td><td className="py-1 px-1 font-mono">{route.start_time}</td>
                    <td className="py-1 px-1" colSpan={4}>Depart depot</td>
                  </tr>
                  {route.schedule.map((s) => (
                    <tr key={s.location_id} className="border-t border-slate-100">
                      <td className="py-1 px-1">
                        <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: vehicle.color }}>{s.seq}</span>
                      </td>
                      <td className="py-1 px-1 font-mono">{s.arrival}</td>
                      <td className="py-1 px-1">
                        <span className="font-medium text-slate-700">{s.name}</span>{' '}
                        {s.overflow && <Flame size={11} className="inline text-red-500" />}
                        <span className="ml-1"><PriorityBadge priority={s.effective_priority} /></span>
                      </td>
                      <td className="py-1 px-1 text-right">{s.waste_kg}</td>
                      <td className="py-1 px-1 text-right text-slate-500">{s.load_after_kg}</td>
                      <td className="py-1 px-1 text-right text-slate-500">{s.leg_km}</td>
                    </tr>
                  ))}
                  <tr className="text-slate-400 border-t border-slate-100">
                    <td className="py-1 px-1">D</td><td className="py-1 px-1 font-mono">{route.end_time}</td>
                    <td className="py-1 px-1" colSpan={3}>Return to depot / unload</td>
                    <td className="py-1 px-1 text-right">{route.return_leg_km}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RouteOptimisation() {
  const { vehicles, optimisationResult: r, isOptimising, optimisationError, setOptimisationError } = useApp();

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <ScenarioBar />
      <SettingsPanel />

      {optimisationError && <ErrorAlert error={optimisationError} onDismiss={() => setOptimisationError(null)} />}

      {isOptimising && !r && (
        <div className="card"><LoadingSpinner message="Running capacitated VRP optimiser…" /></div>
      )}

      {!isOptimising && !r && !optimisationError && (
        <div className="card flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Route size={28} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">No Routes Generated Yet</p>
          <p className="text-sm text-slate-500 max-w-md">
            Click <strong>Generate Optimised Routes</strong>. The backend assigns locations to vehicles under
            capacity limits, orders each route, builds a timed schedule and compares it with a baseline.
          </p>
        </div>
      )}

      {r && (
        <div className={`space-y-5 transition-opacity ${isOptimising ? 'opacity-60' : ''}`}>
          {/* Summary */}
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                Optimisation complete — {r.routes.filter((x) => x.stops.length).length} vehicle routes,{' '}
                {r.utilisation.collected_kg.toLocaleString()} kg of {r.utilisation.total_waste_kg.toLocaleString()} kg collected
                ({r.utilisation.collection_rate_pct}%)
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-xs text-green-700">
                <span>Total distance: <strong>{r.optimised_distance_km} km</strong></span>
                <span>Baseline: <strong>{r.baseline_distance_km} km</strong></span>
                <span>Fleet utilisation: <strong>{r.utilisation.fleet_utilisation_pct}%</strong></span>
                <span>Unserviced: <strong>{r.unserviced.length}</strong></span>
                <span className="flex items-center gap-1"><Cpu size={11} /> {r.solver.iterations} ILS iterations · {r.computation_time_ms} ms</span>
              </div>
            </div>
          </div>

          {r.warnings?.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
              {r.warnings.map((w) => <p key={w}>⚠ {w}</p>)}
            </div>
          )}
          {r.unavailable_vehicles?.length > 0 && (
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-700">
              Excluded (unavailable / breakdown): <strong>{r.unavailable_vehicles.join(', ')}</strong>
            </div>
          )}

          {/* Unserviced */}
          {r.unserviced_details?.length > 0 && (
            <div className="card border-amber-300 bg-amber-50">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Locations that cannot be serviced with available capacity ({r.unserviced_details.length})
                  </p>
                  <table className="w-full text-xs mt-2">
                    <tbody>
                      {r.unserviced_details.map((u) => (
                        <tr key={u.id} className="border-t border-amber-200 align-top">
                          <td className="py-1.5 pr-2 font-mono whitespace-nowrap">{u.id}</td>
                          <td className="py-1.5 pr-2 font-medium text-amber-900">{u.name} {u.overflow && <Flame size={11} className="inline text-red-500" />}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">{u.waste_kg} kg</td>
                          <td className="py-1.5 pr-2"><PriorityBadge priority={u.priority} /></td>
                          <td className="py-1.5 text-amber-800">{u.reason} <span className="text-amber-600">→ {u.recommendation}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
            {r.routes.map((route) => (
              <RouteCard key={route.vehicle_id} route={route} vehicle={vehicles.find((v) => v.id === route.vehicle_id)} />
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            Assumptions: {r.assumptions.distance_model}; {r.assumptions.avg_speed_kmh} km/h; service {r.assumptions.service_time};
            one trip per vehicle; depot: {r.assumptions.depot}. Algorithm: {r.solver.algorithm} (seed {r.solver.seed}).
          </p>
        </div>
      )}
    </div>
  );
}
