/**
 * KPICard.jsx — Reusable dashboard KPI card.
 */
import React from 'react';

export default function KPICard({ icon: Icon, label, value, sub, color = 'green' }) {
  const colorMap = {
    green:  { bg: 'bg-green-50',  icon: 'bg-green-600',  text: 'text-green-700'  },
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-600',   text: 'text-blue-700'   },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-600', text: 'text-orange-700' },
    slate:  { bg: 'bg-slate-50',  icon: 'bg-slate-600',  text: 'text-slate-700'  },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-500',  text: 'text-amber-700'  },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-500',    text: 'text-red-700'    },
  };
  const c = colorMap[color] || colorMap.green;

  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.icon}`}>
        {Icon && <Icon size={18} className="text-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
