/**
 * Header.jsx — Top bar with page title, fleet load and backend status.
 */
import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Header({ title, onMenuClick }) {
  const { totalWaste, totalCapacity, backendOnline, dataSource } = useApp();
  const pct = totalCapacity > 0 ? Math.round((totalWaste / totalCapacity) * 100) : 0;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button className="lg:hidden btn-icon" onClick={onMenuClick} aria-label="Open sidebar">
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-500">Fleet Load</span>
          <span className={`text-xs font-semibold ${pct > 100 ? 'text-red-600' : pct > 90 ? 'text-amber-600' : 'text-green-600'}`}>
            {totalWaste.toLocaleString()} / {totalCapacity.toLocaleString()} kg
          </span>
          <span className="text-xs text-slate-400">({pct}%)</span>
        </div>
        <span className={`hidden md:inline-flex badge ${dataSource === 'database' ? 'bg-green-100 text-green-700' : dataSource === 'offline' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
          title={dataSource === 'offline' ? 'Backend offline: using built-in sample data, changes are not saved' : 'Data is saved in the SQLite database'}>
          {dataSource === 'database' ? 'Data: database (saved)' : dataSource === 'offline' ? 'Data: sample (not saved)' : 'Data: loading…'}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500" title="Optimisation backend status">
          <span className={`w-2 h-2 rounded-full ${backendOnline === null ? 'bg-slate-300' : backendOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="hidden md:inline">{backendOnline === null ? 'Checking…' : backendOnline ? 'Backend online' : 'Backend offline'}</span>
        </div>
      </div>
    </header>
  );
}
