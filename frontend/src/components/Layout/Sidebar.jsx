/**
 * Sidebar.jsx — Responsive sidebar navigation.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MapPin, Truck, Map, Route, BarChart3, Leaf, X } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'            },
  { to: '/locations',    icon: MapPin,          label: 'Collection Locations' },
  { to: '/vehicles',     icon: Truck,           label: 'Vehicle Management'   },
  { to: '/optimisation', icon: Route,           label: 'Routes & Schedules'   },
  { to: '/map',          icon: Map,             label: 'Interactive Map'      },
  { to: '/comparison',   icon: BarChart3,       label: 'Strategy Comparison'  },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-slate-200
          flex flex-col transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Leaf size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">EcoRoute</p>
              <p className="text-[10px] text-slate-500 leading-tight">Adaptive Waste Collection</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden btn-icon" aria-label="Close sidebar"><X size={18} /></button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-0.5">Service Zone</p>
          <p className="text-xs text-slate-700 leading-snug">Town Hall – Kuppiyawatte – Borella, Colombo</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
              className={({ isActive }) => (isActive ? 'sidebar-link-active' : 'sidebar-link')}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <p className="text-[10px] text-slate-400">BuildX 0.1 · Challenge 05</p>
          <p className="text-[10px] text-slate-400">EcoRoute v1.0</p>
        </div>
      </aside>
    </>
  );
}
