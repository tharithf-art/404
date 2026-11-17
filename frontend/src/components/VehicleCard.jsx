/**
 * VehicleCard.jsx — Vehicle info and capacity utilisation.
 */
import React from 'react';
import { Truck } from 'lucide-react';

export default function VehicleCard({ vehicle, route }) {
  const assigned = route?.total_waste_kg || 0;
  const pct = vehicle.capacity_kg > 0 ? Math.round((assigned / vehicle.capacity_kg) * 100) : 0;
  const off = vehicle.available === false;
  const barColor = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : vehicle.color;

  return (
    <div className={`card ${off ? 'opacity-60' : ''}`} style={{ borderLeftWidth: 4, borderLeftColor: vehicle.color }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${vehicle.color}1a` }}>
            <Truck size={17} style={{ color: vehicle.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{vehicle.id}</p>
            <p className="text-xs text-slate-500">{vehicle.type} · {vehicle.capacity_kg.toLocaleString()} kg</p>
          </div>
        </div>
        <span className={`badge text-xs font-semibold ${off ? 'bg-red-100 text-red-700' : 'text-white'}`}
          style={off ? {} : { backgroundColor: vehicle.color }}>
          {off ? 'Unavailable' : vehicle.colorName}
        </span>
      </div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-500">Capacity utilisation</span>
        <span className="text-xs font-semibold" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{assigned.toLocaleString()} / {vehicle.capacity_kg.toLocaleString()} kg</span>
        <span>{route ? `${route.stops.length} stops · ${route.total_distance_km} km` : off ? 'Excluded' : 'Unassigned'}</span>
      </div>
    </div>
  );
}
