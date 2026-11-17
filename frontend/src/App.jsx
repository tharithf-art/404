/**
 * App.jsx — Root component: routing + layout shell.
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

import { AppProvider } from './context/AppContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';

import Dashboard from './pages/Dashboard';
import CollectionLocations from './pages/CollectionLocations';
import VehicleManagement from './pages/VehicleManagement';
import InteractiveMap from './pages/InteractiveMap';
import RouteOptimisation from './pages/RouteOptimisation';
import RouteComparison from './pages/RouteComparison';
import DatabaseView from './pages/DatabaseView';
import { useApp } from './context/AppContext';
import { XCircle } from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/locations': 'Collection Locations',
  '/vehicles': 'Vehicle Management',
  '/map': 'Interactive Map',
  '/optimisation': 'Routes & Collection Schedules',
  '/comparison': 'Strategy Comparison',
  '/database': 'Database',
};

function DataErrorBanner() {
  const { dataError, setDataError } = useApp();
  if (!dataError) return null;
  return (
    <div className="mx-5 lg:mx-7 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 flex items-start gap-2 text-sm text-red-700">
      <span className="flex-1"><strong>Could not save to database:</strong> {dataError.message}</span>
      <button className="btn-icon text-red-500" onClick={() => setDataError(null)}><XCircle size={16} /></button>
    </div>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'EcoRoute';

  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <DataErrorBanner />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/locations" element={<CollectionLocations />} />
            <Route path="/vehicles" element={<VehicleManagement />} />
            <Route path="/map" element={<InteractiveMap />} />
            <Route path="/optimisation" element={<RouteOptimisation />} />
            <Route path="/comparison" element={<RouteComparison />} />
            <Route path="/database" element={<DatabaseView />} />
            <Route path="*" element={
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <p className="text-6xl font-bold text-slate-200 mb-3">404</p>
                  <p className="text-lg font-semibold text-slate-600">Page not found</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </BrowserRouter>
  );
}
