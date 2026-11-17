/**
 * PriorityBadge.jsx — Coloured priority pill.
 */
import React from 'react';
import { PRIORITY_CONFIG } from '../data/mockData';

export default function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Low;
  return (
    <span className={`badge ${cfg.bg} ${cfg.text}`}>
      {priority}
    </span>
  );
}
