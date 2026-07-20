'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { FunnelStage } from '@/lib/dashboard/queries';

const COLORS = ['#0d9488', '#14b8a6', '#f59e0b', '#f97316', '#ef4444', '#dc2626'];

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FunnelStage }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl text-xs border"
         style={{ background: 'var(--chart-tooltip-bg)', borderColor: 'var(--chart-tooltip-border)' }}>
      <p className="font-semibold" style={{ color: 'var(--chart-tooltip-text)' }}>{d.label}</p>
      <p style={{ color: 'var(--chart-tooltip-sub)' }}>{d.count} {d.count === 1 ? 'patient' : 'patients'}</p>
    </div>
  );
}

export default function FunnelChart({ data }: { data: FunnelStage[] }) {
  const hasData = data.some((s) => s.count > 0);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-fg mb-0.5">Pathway Funnel</h3>
      <p className="text-xs text-gray-500 dark:text-fg-muted mb-4">Patient flow through screening stages</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={26}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-52 text-sm text-gray-400 dark:text-fg-muted">
          No screening data yet
        </div>
      )}
    </div>
  );
}