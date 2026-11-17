/**
 * DatabaseView.jsx — Inspect the SQLite database: tables, record counts and
 * optimisation run history. Add/edit data via the Locations and Vehicles pages.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, RefreshCw, RotateCcw, Trash2, ExternalLink, Eye, HardDrive, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { db, API_BASE } from '../services/api';
import PriorityBadge from '../components/PriorityBadge';

const TABS = [
  { key: 'locations', label: 'locations' },
  { key: 'vehicles', label: 'vehicles' },
  { key: 'runs', label: 'optimisation_runs' },
];

export default function DatabaseView() {
  const { dataSource, locations, vehicles, loadFromDatabase, resetScenario, runsVersion, loadRunResult, setDataError } = useApp();
  const [tab, setTab] = useState('locations');
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);   // 'reset' | 'clear'
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (dataSource !== 'database') return;
    try {
      const [s, r] = await Promise.all([db.stats(), db.listRuns(100)]);
      setStats(s);
      setRuns(r);
    } catch (e) { setDataError(e); }
  }, [dataSource, setDataError]);

  useEffect(() => { refresh(); }, [refresh, runsVersion, locations.length, vehicles.length]);

  const doReset = async () => { setBusy(true); await resetScenario(); await refresh(); setBusy(false); setConfirm(null); };
  const doClear = async () => {
    setBusy(true);
    try { await db.clearRuns(); } catch (e) { setDataError(e); }
    await refresh(); setBusy(false); setConfirm(null);
  };
  const openRun = async (id) => {
    try {
      const run = await db.getRun(id);
      loadRunResult(run.result);
      navigate('/optimisation');
    } catch (e) { setDataError(e); }
  };

  if (dataSource !== 'database') {
    return (
      <div className="p-5 lg:p-7">
        <div className="card flex flex-col items-center text-center py-14 gap-3">
          <WifiOff size={30} className="text-slate-400" />
          <p className="text-base font-semibold text-slate-700">
            {dataSource === 'loading' ? 'Connecting to the database…' : 'Database not connected'}
          </p>
          <p className="text-sm text-slate-500 max-w-md">
            The database lives in the Python backend. Start it with <code className="bg-slate-100 px-1 rounded">start-ecoroute.bat</code>{' '}
            (or <code className="bg-slate-100 px-1 rounded">python -m uvicorn app.main:app --port 8000</code> in the backend folder).
            Until then the app uses built-in sample data and changes are not saved.
          </p>
          <button className="btn-primary" onClick={loadFromDatabase}><RefreshCw size={15} /> Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-7 space-y-5">
      {/* Summary */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center"><Database size={18} className="text-white" /></div>
            <div>
              <p className="font-semibold text-slate-900">SQLite database <span className="badge bg-green-100 text-green-700 ml-1">connected</span></p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><HardDrive size={12} />
                <code className="bg-slate-100 px-1 rounded break-all">{stats?.database_file ?? '…'}</code></p>
              <p className="text-xs text-slate-500 mt-1">
                Every add / edit / delete on the Locations and Vehicles pages is saved here. Every optimisation run is logged.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => { loadFromDatabase(); refresh(); }}><RefreshCw size={15} /> Refresh</button>
            <a className="btn-secondary" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> API (add data)</a>
            <button className="btn-danger" onClick={() => setConfirm('reset')} disabled={busy}><RotateCcw size={14} /> Reset to sample data</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-lg p-3 text-left border transition ${tab === t.key ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
              <p className="text-xs font-mono text-slate-500">{t.label}</p>
              <p className="text-2xl font-bold text-slate-800">
                {t.key === 'locations' ? stats?.locations : t.key === 'vehicles' ? stats?.vehicles : stats?.optimisation_runs}
              </p>
              <p className="text-[11px] text-slate-400">rows</p>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 font-mono">SELECT * FROM {TABS.find((t) => t.key === tab).label}</h3>
          {tab === 'runs' && runs.length > 0 && (
            <button className="btn-danger" onClick={() => setConfirm('clear')} disabled={busy}><Trash2 size={13} /> Clear history</button>
          )}
          {tab === 'locations' && <button className="btn-secondary" onClick={() => navigate('/locations')}>Add / edit locations →</button>}
          {tab === 'vehicles' && <button className="btn-secondary" onClick={() => navigate('/vehicles')}>Add / edit vehicles →</button>}
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          {tab === 'locations' && (
            <table className="w-full min-w-[900px] text-xs">
              <thead><tr>{['id', 'name', 'area', 'lat', 'lng', 'waste_kg', 'priority', 'overflow', 'updated_at'].map((h) => <th key={h} className="table-header font-mono normal-case">{h}</th>)}</tr></thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="table-cell font-mono text-xs">{l.id}</td>
                    <td className="table-cell text-xs">{l.name}</td>
                    <td className="table-cell text-xs text-slate-500">{l.area}</td>
                    <td className="table-cell font-mono text-xs">{Number(l.lat).toFixed(4)}</td>
                    <td className="table-cell font-mono text-xs">{Number(l.lng).toFixed(4)}</td>
                    <td className="table-cell font-mono text-xs font-semibold">{l.waste_kg}</td>
                    <td className="table-cell text-xs"><PriorityBadge priority={l.priority} /></td>
                    <td className="table-cell text-xs">{l.overflow ? <span className="badge bg-red-100 text-red-700">1</span> : '0'}</td>
                    <td className="table-cell font-mono text-[11px] text-slate-400">{l.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'vehicles' && (
            <table className="w-full min-w-[800px] text-xs">
              <thead><tr>{['id', 'label', 'type', 'capacity_kg', 'available', 'color', 'updated_at'].map((h) => <th key={h} className="table-header font-mono normal-case">{h}</th>)}</tr></thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="table-cell font-mono text-xs">{v.id}</td>
                    <td className="table-cell text-xs">{v.label}</td>
                    <td className="table-cell text-xs">{v.type}</td>
                    <td className="table-cell font-mono text-xs font-semibold">{v.capacity_kg}</td>
                    <td className="table-cell text-xs">{v.available ? '1' : <span className="badge bg-red-100 text-red-700">0</span>}</td>
                    <td className="table-cell text-xs"><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: v.color }} />{v.color}</span></td>
                    <td className="table-cell font-mono text-[11px] text-slate-400">{v.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'runs' && (
            runs.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">No optimisation runs yet. Generate routes and they will be logged here.</p>
            ) : (
              <table className="w-full min-w-[950px] text-xs">
                <thead><tr>{['id', 'created_at (UTC)', 'locations', 'vehicles', 'waste_kg', 'collected_kg', 'optimised_km', 'baseline_km', 'unserviced', 'fleet_util_%', 'ms', ''].map((h) => <th key={h} className="table-header font-mono normal-case">{h}</th>)}</tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="table-cell font-mono text-xs">{r.id}</td>
                      <td className="table-cell font-mono text-[11px]">{r.created_at}</td>
                      <td className="table-cell text-xs">{r.n_locations}</td>
                      <td className="table-cell text-xs">{r.n_vehicles}</td>
                      <td className="table-cell font-mono text-xs">{r.total_waste_kg}</td>
                      <td className="table-cell font-mono text-xs">{r.collected_kg}</td>
                      <td className="table-cell font-mono text-xs font-semibold text-green-700">{r.optimised_distance_km}</td>
                      <td className="table-cell font-mono text-xs text-slate-500">{r.baseline_distance_km}</td>
                      <td className={`table-cell text-xs ${r.unserviced_count ? 'text-amber-700 font-semibold' : ''}`}>{r.unserviced_count}</td>
                      <td className="table-cell text-xs">{r.fleet_utilisation_pct}</td>
                      <td className="table-cell text-xs text-slate-400">{r.computation_time_ms}</td>
                      <td className="table-cell"><button className="btn-icon" title="Open this run's routes" onClick={() => openRun(r.id)}><Eye size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      <div className="card text-xs text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-700 text-sm">Other ways to view or edit the database</p>
        <p>• <strong>DB Browser for SQLite</strong> (free, sqlitebrowser.org) → Open Database → the file shown above.</p>
        <p>• <strong>VS Code</strong>: install the “SQLite Viewer” extension, then click <code className="bg-slate-100 px-1 rounded">backend/data/ecoroute.db</code>.</p>
        <p>• <strong>API docs</strong> at <code className="bg-slate-100 px-1 rounded">{API_BASE}/docs</code> → <em>POST /api/locations</em> → “Try it out”.</p>
        <p className="text-slate-400">Schema: <code className="bg-slate-100 px-1 rounded">backend/db/schema.sql</code>. All data is simulated.</p>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              {confirm === 'reset' ? 'Reset to sample data?' : 'Clear run history?'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirm === 'reset'
                ? 'All locations and vehicles in the database will be replaced with the original 20-location, 3-vehicle sample. Run history is kept. This cannot be undone.'
                : `All ${runs.length} saved optimisation runs will be deleted permanently. Locations and vehicles are not affected.`}
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-danger" disabled={busy} onClick={confirm === 'reset' ? doReset : doClear}>
                {confirm === 'reset' ? 'Reset' : 'Delete history'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
