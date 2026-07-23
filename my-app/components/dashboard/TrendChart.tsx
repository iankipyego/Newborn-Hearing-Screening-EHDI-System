'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import type { TrendPoint } from '@/lib/dashboard/queries';

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const names: Record<string, string> = { coverage_rate: 'Coverage', referral_rate: 'Referral rate', loss_to_followup_rate: 'LTFU rate' };
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl text-xs border"
         style={{ background: 'var(--chart-tooltip-bg)', borderColor: 'var(--chart-tooltip-border)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--chart-tooltip-text)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {names[p.dataKey] ?? p.dataKey}: {(p.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-fg mb-0.5">Quality Trends</h3>
      <p className="text-xs text-gray-500 dark:text-fg-muted mb-4">Monthly rates from quality snapshots</p>
      <div className="flex items-center justify-center h-52 text-sm text-gray-400 dark:text-fg-muted">
        No quality snapshots yet
      </div>
    </div>
  );

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.period_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    coverage_rate: d.coverage_rate ?? 0,
    referral_rate: d.referral_rate ?? 0,
    loss_to_followup_rate: d.loss_to_followup_rate ?? 0,
  }));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-fg mb-0.5">Quality Trends</h3>
      <p className="text-xs text-gray-500 dark:text-fg-muted mb-4">Monthly rates from quality snapshots (§4.11)</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
          <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} domain={[0, 1]} />
          <Tooltip content={<Tip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
            formatter={(v: string) => ({ coverage_rate: 'Coverage', referral_rate: 'Referral rate', loss_to_followup_rate: 'LTFU rate' }[v] ?? v)} />
          <Line type="monotone" dataKey="coverage_rate" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="referral_rate" stroke="var(--color-warn)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="loss_to_followup_rate" stroke="var(--color-red-500)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}