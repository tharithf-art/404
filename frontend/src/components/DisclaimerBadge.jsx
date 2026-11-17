/**
 * DisclaimerBadge.jsx — Persistent data disclaimer banner.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DisclaimerBadge() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-start gap-2.5">
      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 leading-relaxed">
        <span className="font-semibold">Simulated Sample Data:</span>{' '}
        Real CMC road names with estimated GPS positions and simulated waste quantities.
        Results demonstrate the optimisation method, not real-world operational findings.
      </p>
    </div>
  );
}
