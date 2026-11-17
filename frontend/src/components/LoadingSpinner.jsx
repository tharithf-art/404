/**
 * LoadingSpinner.jsx — Centred loading indicator.
 */
import React from 'react';

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
