/**
 * ScenarioBar.jsx — Run optimisation + dynamic scenario events.
 * Shared by the Routes and Map pages.
 */
import React, { useState } from 'react';
import { Play, Flame, RotateCcw, RefreshCw, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ScenarioBar() {
  const {
    locations, availableVehicles, totalWaste, totalCapacity,
    runOptimisation, isOptimising, autoRecalc, setAutoRecalc,
    simulateOverflow, resetScenario, lastEvent, isStale, optimisationResult,
    setOptimisationError, dataSource,
  } = useApp();
  const [busy, setBusy] = useState(false);

  const overflow = async () => {
    setBusy(true);
    try { await simulateOverflow(0.25); } catch (e) { setOptimisationError(e); }
    setBusy(false);
  };

  const pct = totalCapacity > 0 ? Math.round((totalWaste / totalCapacity) * 100) : 0;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">
            <strong>{locations.length}</strong> locations · <strong>{totalWaste.toLocaleString()} kg</strong> ·{' '}
            <strong>{availableVehicles.length}</strong> available vehicles ·{' '}
            <strong>{totalCapacity.toLocaleString()} kg</strong> capacity{' '}
            <span className={`badge ml-1 ${pct > 100 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {pct}% load
            </span>
          </p>
          {pct > 100 && (
            <p className="text-xs text-red-600 mt-0.5">
              Waste exceeds fleet capacity — some locations will be reported as unserviced.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={overflow} disabled={busy || isOptimising}
            title="Randomly mark ~25% of bins as overflowing (×1.5–2.5 waste, treated as High priority)">
            <Flame size={15} className="text-red-500" /> Simulate overflow
          </button>
          <button className="btn-secondary" disabled={isOptimising} onClick={() => {
            if (dataSource !== 'database' || window.confirm('Reset replaces ALL locations and vehicles in the database with the original 20-location sample. Continue?')) resetScenario();
          }}>
            <RotateCcw size={15} /> Reset
          </button>
          <button id="generate-routes-btn" className="btn-primary" onClick={runOptimisation}
            disabled={isOptimising || locations.length === 0 || availableVehicles.length === 0}>
            {isOptimising
              ? (<><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Optimising…</>)
              : optimisationResult
                ? (<><RefreshCw size={15} /> Re-optimise</>)
                : (<><Play size={15} /> Generate Optimised Routes</>)}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-2">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={autoRecalc} onChange={(e) => setAutoRecalc(e.target.checked)} />
          <Zap size={12} className="text-amber-500" /> Auto-recalculate routes when data changes
        </label>
        {lastEvent && <span>Last change ({lastEvent.at}): {lastEvent.msg}</span>}
        {isStale && !autoRecalc && (
          <span className="badge bg-amber-100 text-amber-700">Routes are out of date — re-optimise</span>
        )}
      </div>
    </div>
  );
}
