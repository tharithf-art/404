/**
 * RouteComparison.jsx — Baseline vs optimised, plus comparative analysis of
 * all strategies computed by the backend on the SAME scenario.
 */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const STRAT_COLORS = { baseline: '#94a3b8', greedy: '#f59e0b', distance_only: '#2563eb', optimised: '#16a34a' };
const SHORT = { baseline: 'Baseline', greedy: 'Greedy NN', distance_only: 'CVRP (dist.)', optimised: 'EcoRoute' };

export default function RouteComparison() {
  const { optimisationResult: r, vehicles } = useApp();

  if (!r) {
    return (
      <div className="p-5 lg:p-7">
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center"><BarChart3 size={28} className="text-slate-400" /></div>
          <p className="text-base font-semibold text-slate-700">No Comparison Data Available</p>
          <p className="text-sm text-slate-500 max-w-sm">Run <strong>Routes &amp; Schedules → Generate</strong> first.</p>
        </div>
      </div>
    );
  }

  const S = Object.fromEntries(r.strategies.map((s) => [s.key, s]));
  const base = S.baseline, opt = S.optimised;
  const saved = +(base.total_distance_km - opt.total_distance_km).toFixed(2);
  const savedPct = base.total_distance_km ? Math.round((saved / base.total_distance_km) * 100) : 0;
  const extraKg = +(opt.serviced_kg - base.serviced_kg).toFixed(1);

  const chart = r.strategies.map((s) => ({
    name: SHORT[s.key] || s.key, key: s.key,
    distance: s.total_distance_km, collected: s.serviced_kg, kmpt: s.km_per_tonne ?? 0,
  }));
  const vehicleData = r.routes.map((rt) => {
    const b = r.baseline.routes.find((x) => x.vehicle_id === rt.vehicle_id);
    return {
      name: rt.vehicle_id,
      optimised: rt.total_distance_km, baseline: b?.total_distance_km ?? 0,
      util_opt: rt.capacity_pct, util_base: b?.capacity_pct ?? 0,
      fill: vehicles.find((v) => v.id === rt.vehicle_id)?.color || '#94a3b8',
    };
  });

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Baseline distance</p>
          <p className="text-3xl font-bold text-slate-500">{base.total_distance_km} km</p>
          <p className="text-xs text-slate-400 mt-1">{base.serviced_count} stops · {base.serviced_kg.toLocaleString()} kg</p>
        </div>
        <div className="card text-center border-green-200">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Optimised distance</p>
          <p className="text-3xl font-bold text-green-700">{opt.total_distance_km} km</p>
          <p className="text-xs text-slate-400 mt-1">{opt.serviced_count} stops · {opt.serviced_kg.toLocaleString()} kg</p>
        </div>
        <div className={`card text-center ${saved >= 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-xs uppercase tracking-wider mb-1 text-slate-600">Distance change</p>
          <p className={`text-3xl font-bold ${saved >= 0 ? 'text-green-700' : 'text-amber-700'}`}>{saved >= 0 ? `−${saved}` : `+${-saved}`} km</p>
          <p className="text-sm font-semibold mt-1 flex items-center justify-center gap-1 text-slate-600">
            {saved >= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            {saved >= 0 ? `${savedPct}% shorter` : 'longer because more waste is collected'}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Extra waste collected</p>
          <p className="text-3xl font-bold text-slate-800">{extraKg >= 0 ? '+' : ''}{extraKg.toLocaleString()} kg</p>
          <p className="text-xs text-slate-400 mt-1">High-priority missed: {base.high_unserviced} → {opt.high_unserviced}</p>
        </div>
      </div>

      {/* Strategy table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Comparative optimisation analysis (same scenario)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                {['Strategy', 'Distance', 'Stops served', 'Waste collected', 'Unserviced', 'High missed', 'Fleet util.', 'km / tonne', 'Avg High ETA', 'Longest route'].map((h) => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.strategies.map((s) => (
                <tr key={s.key} className={s.key === 'optimised' ? 'bg-green-50/60' : ''}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STRAT_COLORS[s.key] }} />
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">{s.description}</p>
                  </td>
                  <td className="table-cell font-mono">{s.total_distance_km} km</td>
                  <td className="table-cell">{s.serviced_count}</td>
                  <td className="table-cell font-mono">{s.serviced_kg.toLocaleString()} kg</td>
                  <td className="table-cell">{s.unserviced_count} ({s.unserviced_kg.toLocaleString()} kg)</td>
                  <td className={`table-cell font-semibold ${s.high_unserviced ? 'text-red-600' : 'text-green-700'}`}>{s.high_unserviced}</td>
                  <td className="table-cell">{s.fleet_utilisation_pct}%</td>
                  <td className="table-cell font-mono">{s.km_per_tonne ?? '—'}</td>
                  <td className="table-cell">{s.avg_high_arrival_min != null ? `${s.avg_high_arrival_min} min` : '—'}</td>
                  <td className="table-cell">{Math.round(s.max_route_duration_min)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-[11px] text-slate-400">
          All strategies respect vehicle capacity. "Avg High ETA" = average minutes after shift start until High-priority stops are reached.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Total distance by strategy (km)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} barSize={46}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" km" />
              <Tooltip formatter={(v) => `${v} km`} />
              <Bar dataKey="distance" name="Distance" radius={[6, 6, 0, 0]}>
                {chart.map((d) => <Cell key={d.key} fill={STRAT_COLORS[d.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Waste collected by strategy (kg)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} barSize={46}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip formatter={(v) => `${v.toLocaleString()} kg`} />
              <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]}>
                {chart.map((d) => <Cell key={d.key} fill={STRAT_COLORS[d.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Distance per vehicle: baseline vs optimised (km)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vehicleData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" km" />
              <Tooltip formatter={(v) => `${v} km`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="baseline" name="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="optimised" name="Optimised" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Vehicle capacity utilisation (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vehicleData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="util_base" name="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="util_opt" name="Optimised" radius={[4, 4, 0, 0]}>
                {vehicleData.map((d) => <Cell key={d.name} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
