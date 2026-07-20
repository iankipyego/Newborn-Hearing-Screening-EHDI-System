'use client';
// components/dashboard/KPICard.tsx
// Dark/light KPI card with glow effect in dark mode.

import type { KPI } from '@/lib/dashboard/queries';

interface KPICardProps { kpi: KPI; }

function status(kpi: KPI): 'green' | 'amber' | 'red' | 'gray' {
  if (kpi.value === null) return 'gray';
  if (kpi.inverted) {
    if (kpi.value <= kpi.target) return 'green';
    if (kpi.value <= kpi.target * 1.5) return 'amber';
    return 'red';
  }
  if (kpi.value >= kpi.target) return 'green';
  if (kpi.value >= kpi.target * 0.8) return 'amber';
  return 'red';
}

const C = {
  green:  { text: 'text-emerald-700 dark:text-emerald-400',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/40', bar: 'bg-emerald-500', dot: 'bg-emerald-500', label: 'On target' },
  amber:  { text: 'text-amber-700 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800/40',   bar: 'bg-amber-500', dot: 'bg-amber-500', label: 'Approaching' },
  red:    { text: 'text-red-700 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800/40',       bar: 'bg-red-500', dot: 'bg-red-500', label: 'Below target' },
  gray:   { text: 'text-gray-500 dark:text-fg-muted',      bg: 'bg-gray-50 dark:bg-surface-card',    border: 'border-gray-200 dark:border-surface-border', bar: 'bg-gray-300 dark:bg-surface-border', dot: 'bg-gray-400', label: 'No data' },
};

export default function KPICard({ kpi }: KPICardProps) {
  const s = status(kpi);
  const c = C[s];
  const displayValue = kpi.value === null ? 'N/A' : `${(kpi.value * 100).toFixed(1)}%`;
  const displayTarget = `${(kpi.target * 100).toFixed(0)}%`;
  const barWidth = kpi.value === null
    ? 0
    : kpi.inverted
      ? Math.min(100, (kpi.target / Math.max(kpi.value, 0.001)) * 100)
      : Math.min(100, (kpi.value / kpi.target) * 100);

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${c.bg} ${c.border}
                    ${s !== 'gray' ? 'dark:shadow-lg' : ''}`}
         style={s === 'green' ? { '--tw-shadow-color': 'rgba(16,185,129,0.08)' } as React.CSSProperties
                : s === 'amber' ? { '--tw-shadow-color': 'rgba(245,158,11,0.08)' } as React.CSSProperties
                : s === 'red'   ? { '--tw-shadow-color': 'rgba(239,68,68,0.08)' } as React.CSSProperties
                : undefined}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-gray-600 dark:text-fg-muted leading-tight">{kpi.label}</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.bg} ${c.text} ${c.border} border`}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
          {c.label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-2xl font-display font-bold tracking-tight ${c.text}`}>{displayValue}</span>
        <span className="text-xs text-gray-500 dark:text-fg-muted">Target: {displayTarget}</span>
      </div>
      <div className="h-1.5 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${barWidth}%` }} />
      </div>
      <p className="text-[10px] text-gray-500 dark:text-fg-muted/70 leading-tight">{kpi.description}</p>
    </div>
  );
}