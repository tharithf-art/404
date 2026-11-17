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

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/locations': 'Collection Locations',
  '/vehicles': 'Vehicle Management',
  '/map': 'Interactive Map',
  '/optimisation': 'Routes & Collection Schedules',
  '/comparison': 'Strategy Comparison',
};

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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/locations" element={<CollectionLocations />} />
            <Route path="/vehicles" element={<VehicleManagement />} />
            <Route path="/map" element={<InteractiveMap />} />
            <Route path="/optimisation" element={<RouteOptimisation />} />
            <Route path="/comparison" element={<RouteComparison />} />
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
