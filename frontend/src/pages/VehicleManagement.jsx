/**
 * VehicleManagement.jsx — Maintain the fleet: add / edit / remove vehicles,
 * set capacity constraints and mark vehicles unavailable (breakdown).
 */
import React, { useState } from 'react';
import { Truck, Pencil, X, Check, Info, Plus, Trash2, Power } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VEHICLE_TYPES } from '../data/mockData';

function VehicleModal({ vehicle, onSave, onClose }) {
  const isNew = !vehicle;
  const [form, setForm] = useState({
    label: vehicle?.label ?? '',
    type: vehicle?.type ?? VEHICLE_TYPES[0],
    capacity_kg: vehicle ? String(vehicle.capacity_kg) : '',
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    const cap = parseFloat(form.capacity_kg);
    if (isNaN(cap) || cap <= 0) errs.capacity_kg = 'Capacity must be a positive number.';
    else if (cap > 100000) errs.capacity_kg = 'Capacity must be ≤ 100,000 kg.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ label: form.label.trim() || undefined, type: form.type.trim(), capacity_kg: cap });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{isNew ? 'Add Vehicle' : `Edit ${vehicle.id}`}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Vehicle label</label>
            <input className="input" value={form.label} onChange={set('label')} placeholder="e.g. Vehicle 004" />
          </div>
          <div>
            <label className="label">Vehicle type</label>
            <select className="select" value={form.type} onChange={set('type')}>
              {[...new Set([...VEHICLE_TYPES, form.type])].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Capacity (kg) *</label>
            <input type="number" min={1} className={`input ${errors.capacity_kg ? 'border-red-400' : ''}`}
              value={form.capacity_kg} onChange={set('capacity_kg')} placeholder="e.g. 2000" />
            {errors.capacity_kg && <p className="text-xs text-red-600 mt-1">{errors.capacity_kg}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary"><Check size={15} /> {isNew ? 'Add Vehicle' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VehicleManagement() {
  const {
    vehicles, addVehicle, updateVehicle, deleteVehicle, toggleVehicleAvailability,
    optimisationResult, totalCapacity, totalWaste,
  } = useApp();
  const [modal, setModal] = useState(null); // null | 'new' | vehicle id

  const routeMap = {};
  (optimisationResult?.routes || []).forEach((r) => { routeMap[r.vehicle_id] = r; });
  const loadFactor = totalCapacity > 0 ? Math.round((totalWaste / totalCapacity) * 100) : 0;

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-start gap-2.5">
        <Info size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Project assumption:</span> capacities are estimates for this demonstration,
          not verified CMC vehicle specifications. Each vehicle makes one trip per shift (depot → stops → depot).
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-slate-800">Fleet Summary</h2>
          <div className="flex items-center gap-2">
            <span className="badge bg-green-100 text-green-800">
              {vehicles.filter((v) => v.available !== false).length} of {vehicles.length} available
            </span>
            <button className="btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Vehicle</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Available capacity</p>
            <p className="text-xl font-bold text-slate-800">{totalCapacity.toLocaleString()} kg</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total waste</p>
            <p className="text-xl font-bold text-slate-800">{totalWaste.toLocaleString()} kg</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Load factor</p>
            <p className={`text-xl font-bold ${loadFactor > 100 ? 'text-red-600' : 'text-slate-800'}`}>{loadFactor}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {vehicles.map((v) => {
          const r = routeMap[v.id];
          const assigned = r?.total_waste_kg || 0;
          const pct = v.capacity_kg > 0 ? Math.round((assigned / v.capacity_kg) * 100) : 0;
          const barColor = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : v.color;
          const off = v.available === false;

          return (
            <div key={v.id} className={`card ${off ? 'opacity-60' : ''}`} style={{ borderTopWidth: 4, borderTopColor: v.color }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${v.color}1a` }}>
                    <Truck size={18} style={{ color: v.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{v.id}</p>
                    <p className="text-xs text-slate-500">{v.label}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <button className={`btn-icon ${off ? 'text-red-500' : 'text-green-600'}`}
                    title={off ? 'Mark available' : 'Mark unavailable (breakdown)'}
                    onClick={() => toggleVehicleAvailability(v.id)}>
                    <Power size={15} />
                  </button>
                  <button className="btn-icon" title="Edit vehicle" onClick={() => setModal(v.id)}><Pencil size={15} /></button>
                  <button className="btn-icon text-red-400 hover:text-red-600" title="Remove vehicle"
                    disabled={vehicles.length <= 1} onClick={() => deleteVehicle(v.id)}><Trash2 size={15} /></button>
                </div>
              </div>

              <div className="space-y-2.5 text-sm mb-4">
                <div className="flex justify-between"><span className="text-slate-500">Status</span>
                  <span className={`badge ${off ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{off ? 'Unavailable' : 'Available'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium text-slate-700">{v.type}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Capacity</span><span className="font-semibold text-slate-800">{v.capacity_kg.toLocaleString()} kg</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Route colour</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.color }} />{v.colorName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Assigned</span>
                  <span className="font-semibold text-slate-800">{r ? `${r.stops.length} stops · ${assigned.toLocaleString()} kg · ${r.total_distance_km} km` : '—'}</span></div>
              </div>

              <div>
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="text-slate-500">Capacity utilisation</span>
                  <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                </div>
                {!r && <p className="text-[11px] text-slate-400 mt-1">{off ? 'Excluded from optimisation.' : 'Run optimisation to assign loads.'}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <VehicleModal
          vehicle={modal === 'new' ? null : vehicles.find((v) => v.id === modal)}
          onSave={(data) => {
            if (modal === 'new') addVehicle(data);
            else updateVehicle(modal, Object.fromEntries(Object.entries(data).filter(([, x]) => x !== undefined)));
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
