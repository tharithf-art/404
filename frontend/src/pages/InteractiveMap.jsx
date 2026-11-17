/**
 * InteractiveMap.jsx — Leaflet map of collection points, depot and routes.
 * Toggle between the optimised plan and the baseline strategy.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../context/AppContext';
import { MAP_CONFIG, PRIORITY_CONFIG } from '../data/mockData';
import DisclaimerBadge from '../components/DisclaimerBadge';
import ScenarioBar from '../components/ScenarioBar';
import ErrorAlert from '../components/ErrorAlert';

function makeIcon(color, { overflow = false, unserviced = false, label = '' } = {}) {
  const ring = overflow ? 'box-shadow:0 0 0 3px #ef4444,0 0 10px 3px rgba(239,68,68,.6);' : 'box-shadow:0 1px 4px rgba(0,0,0,0.35);';
  const bg = unserviced ? '#fff' : color;
  const border = unserviced ? `3px dashed ${color}` : '2.5px solid white';
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${bg};border:${border};${ring}
      display:flex;align-items:center;justify-content:center;color:white;font:700 10px Inter,sans-serif">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

const depotIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:6px;background:#0f172a;border:2px solid white;
    box-shadow:0 1px 5px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font:700 11px Inter">D</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function InteractiveMap() {
  const { locations, vehicles, depot, optimisationResult, optimisationError, setOptimisationError } = useApp();
  const [view, setView] = useState('optimised');
  const [colourBy, setColourBy] = useState('vehicle');

  const plan = useMemo(() => {
    if (!optimisationResult) return null;
    return view === 'baseline' ? optimisationResult.baseline : optimisationResult;
  }, [optimisationResult, view]);

  // location id -> { vehicle, seq, arrival }
  const assignment = useMemo(() => {
    const m = {};
    (plan?.routes || []).forEach((r) => {
      const v = vehicles.find((x) => x.id === r.vehicle_id);
      (r.schedule || []).forEach((s) => { m[s.location_id] = { vehicle: v, seq: s.seq, arrival: s.arrival }; });
    });
    return m;
  }, [plan, vehicles]);
  const unserviced = new Set(plan?.unserviced || []);

  const polylines = (plan?.routes || [])
    .map((r) => ({ r, v: vehicles.find((x) => x.id === r.vehicle_id) }))
    .filter(({ r, v }) => v && r.geometry?.length > 1);

  const positions = [[depot.lat, depot.lng], ...locations.map((l) => [l.lat, l.lng])];

  return (
    <div className="p-5 lg:p-7 space-y-4">
      <DisclaimerBadge />
      <ScenarioBar />
      {optimisationError && <ErrorAlert error={optimisationError} onDismiss={() => setOptimisationError(null)} />}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {optimisationResult ? (
          <>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {['optimised', 'baseline'].map((k) => (
                <button key={k} onClick={() => setView(k)}
                  className={`px-3 py-1.5 font-medium ${view === k ? 'bg-green-600 text-white' : 'bg-white text-slate-600'}`}>
                  {k === 'optimised' ? `Optimised (${optimisationResult.optimised_distance_km} km)` : `Baseline (${optimisationResult.baseline_distance_km} km)`}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              {['vehicle', 'priority'].map((k) => (
                <button key={k} onClick={() => setColourBy(k)}
                  className={`px-3 py-1.5 font-medium ${colourBy === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                  Colour by {k}
                </button>
              ))}
            </div>
            {unserviced.size > 0 && <span className="badge bg-amber-100 text-amber-800">{unserviced.size} unserviced (dashed)</span>}
          </>
        ) : (
          <span className="badge bg-blue-100 text-blue-700">Generate routes to display vehicle paths</span>
        )}
        <span className="badge bg-slate-100 text-slate-700">{locations.length} collection points</span>
      </div>

      <div className="card p-0 overflow-hidden relative" style={{ height: 'calc(100vh - 320px)', minHeight: 480 }}>
        <MapContainer center={MAP_CONFIG.center} zoom={MAP_CONFIG.zoom} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />

          {polylines.map(({ r, v }) => (
            <Polyline key={`${view}-${r.vehicle_id}`} positions={r.geometry}
              pathOptions={{ color: v.color, weight: 4, opacity: 0.85, dashArray: view === 'baseline' ? '8 6' : undefined }} />
          ))}

          <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
            <Popup><div className="p-3 text-xs"><p className="font-semibold text-sm">Depot</p><p>{depot.name}</p></div></Popup>
          </Marker>

          {locations.map((loc) => {
            const a = assignment[loc.id];
            const isUns = unserviced.has(loc.id);
            const pri = loc.overflow ? 'High' : loc.priority;
            const color = colourBy === 'vehicle' && a?.vehicle ? a.vehicle.color : PRIORITY_CONFIG[pri]?.color || '#6b7280';
            return (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}
                icon={makeIcon(color, { overflow: loc.overflow, unserviced: isUns, label: a ? a.seq : '' })}>
                <Popup>
                  <div className="p-3 min-w-[210px] text-xs space-y-1">
                    <p className="font-semibold text-slate-900 text-sm mb-1">{loc.name}</p>
                    <p><span className="text-slate-500">ID:</span> <span className="font-mono">{loc.id}</span></p>
                    <p><span className="text-slate-500">Waste:</span> <strong>{loc.waste_kg} kg</strong>
                      {loc.overflow && <span className="ml-1 text-red-600 font-semibold">OVERFLOWING</span>}</p>
                    <p><span className="text-slate-500">Priority:</span>{' '}
                      <span style={{ color: PRIORITY_CONFIG[pri]?.color, fontWeight: 600 }}>{pri}</span>
                      {loc.overflow && loc.priority !== 'High' && <span className="text-slate-400"> (was {loc.priority})</span>}</p>
                    {a && <p><span className="text-slate-500">Assigned:</span> <strong style={{ color: a.vehicle?.color }}>{a.vehicle?.id}</strong> · stop {a.seq} · ETA {a.arrival}</p>}
                    {isUns && <p className="text-amber-700 font-semibold">Not serviced in this plan (capacity)</p>}
                    <p className="text-[10px] text-slate-400 italic">{loc.note}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 p-3 text-xs space-y-1.5 min-w-[180px]">
          <p className="font-semibold text-slate-700 mb-1">Legend</p>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-slate-900" /><span>Depot (route start/end)</span></div>
          {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
            <div key={k} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: c.color }} /><span>{k} priority</span></div>
          ))}
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white" style={{ boxShadow: '0 0 0 2px #ef4444' }} /><span>Overflowing bin</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-dashed border-slate-500" /><span>Unserviced</span></div>
          {polylines.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium pt-1">Vehicle routes</p>
              {polylines.map(({ v }) => (
                <div key={v.id} className="flex items-center gap-2"><div className="w-6 h-1 rounded-full" style={{ background: v.color }} /><span>{v.id}</span></div>
              ))}
              <p className="text-[10px] text-slate-400 italic">Straight lines between stops; distances use a road factor.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
