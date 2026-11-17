/**
 * ErrorAlert.jsx — Styled error/warning alert box.
 */
import React from 'react';
import { XCircle, WifiOff } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function ErrorAlert({ error, onDismiss }) {
  if (!error) return null;

  const isNetwork = error.isNetworkError;
  const Icon = isNetwork ? WifiOff : XCircle;
  const title = isNetwork ? 'Backend Unreachable' : 'Error';

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
      <Icon size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">{title}</p>
        <p className="text-sm text-red-700 mt-0.5">{error.message || String(error)}</p>
        {isNetwork && (
          <p className="text-xs text-red-600 mt-1">
            Start the backend: <code className="bg-red-100 px-1 rounded">cd backend &amp;&amp; uvicorn app.main:app --port 8000</code>{' '}
            (expected at <code className="bg-red-100 px-1 rounded">
              {API_BASE || window.location.origin}
            </code>)
          </p>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="btn-icon text-red-500 hover:text-red-700">
          <XCircle size={16} />
        </button>
      )}
    </div>
  );
}
