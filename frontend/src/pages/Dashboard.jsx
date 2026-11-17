/**
 * Dashboard.jsx — KPIs, fleet utilisation and waste overview.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Truck, Weight, Route, TrendingUp, Gauge, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { PRIORITY_CONFIG } from '../data/mockData';
import KPICard from '../components/KPICard';
import VehicleCard from '../components/VehicleCard';
import DisclaimerBadge from '../components/DisclaimerBadge';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label ?? payload[0].name}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color || p.fill }}>{p.name}: {p.value.toLocaleString()} kg</p>)}
    </div>
  );
};

export default function Dashboard() {
  const { locations, vehicles, availableVehicles, optimisationResult: r, totalWaste, totalCapacity } = useApp();

  const priorityData = useMemo(() => {
    const m = { High: 0, Medium: 0, Low: 0 };
    locations.forEach((l) => { const p = l.overflow ? 'High' : l.priority; m[p] = (m[p] || 0) + Number(l.waste_kg); });
    return Object.entries(m).map(([name, value]) => ({ name, value, fill: PRIORITY_CONFIG[name]?.color || '#94a3b8' }));
  }, [locations]);

  const areaData = useMemo(() => locations.slice().sort((a, b) => b.waste_kg - a.waste_kg).slice(0, 10)
    .map((l) => ({ name: (l.area || l.name).slice(0, 24), waste: Number(l.waste_kg) })), [locations]);

  const routeOf = (id) => r?.routes.find((x) => x.vehicle_id === id);
  const overflowCount = locations.filter((l) => l.overflow).length;
  const loadPct = totalCapacity ? Math.round((totalWaste / totalCapacity) * 100) : 0;

  return (
    <div className="p-5 lg:p-7 space-y-6">
      <DisclaimerBadge />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KPICard icon={MapPin} label="Collection points" value={locations.length} sub="Active service points" color="green" />
        <KPICard icon={Weight} label="Total waste" value={`${totalWaste.toLocaleString()} kg`} sub={`${loadPct}% of available capacity`} color={loadPct > 100 ? 'red' : 'amber'} />
        <KPICard icon={Truck} label="Vehicles" value={`${availableVehicles.length} / ${vehicles.length}`} sub={`${totalCapacity.toLocaleString()} kg available`} color="blue" />
        <KPICard icon={Flame} label="Overflowing bins" value={overflowCount} sub={overflowCount ? 'Treated as High priority' : 'None reported'} color={overflowCount ? 'red' : 'slate'} />
        <KPICard icon={Route} label="Route distance" value={r ? `${r.optimised_distance_km} km` : '—'}
          sub={r ? `Baseline ${r.baseline_distance_km} km` : 'Pending optimisation'} color={r ? 'green' : 'slate'} />
        <KPICard icon={Gauge} label="Fleet utilisation" value={r ? `${r.utilisation.fleet_utilisation_pct}%` : '—'}
          sub={r ? `${r.utilisation.collection_rate_pct}% of waste collected` : 'Pending optimisation'} color={r ? 'green' : 'slate'} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Vehicle utilisation</h2>
          <span className="text-xs text-slate-500">Available capacity: {totalCapacity.toLocaleString()} kg</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} route={routeOf(v.id)} />)}
        </div>
      </section>

      {r?.unserviced?.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>{r.unserviced.length} location(s)</strong> cannot be serviced with current capacity —{' '}
          <Link to="/optimisation" className="underline">see reasons</Link>.
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Waste by (effective) priority</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={priorityData} cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {priorityData.map((e) => <Cell key={e.name} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top 10 locations by waste (kg)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={areaData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="waste" name="Waste" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {!r && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
          <TrendingUp size={18} className="text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            Routes not yet optimised — open <Link to="/optimisation" className="font-semibold underline">Routes &amp; Schedules</Link> and click
            “Generate Optimised Routes”.
          </p>
        </div>
      )}
    </div>
  );
}
