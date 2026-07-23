'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { DailyOperational, MissedBreakdown } from '@/lib/dashboard/queries';

const MISSED_COLORS: Record<keyof MissedBreakdown, string> = {
  discharged_early: 'var(--color-warn)', refused: 'var(--color-red-500)',
  equipment_down: 'var(--color-violet-500)', staff_absent: 'var(--color-gray-500)',
};
const MISSED_LABELS: Record<keyof MissedBreakdown, string> = {
  discharged_early: 'Discharged early', refused: 'Refused', equipment_down: 'Equipment down', staff_absent: 'Staff absent',
};

function DayTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl text-xs border"
         style={{ background: 'var(--chart-tooltip-bg)', borderColor: 'var(--chart-tooltip-border)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--chart-tooltip-text)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'total_screened' ? 'Screened' : 'Missed'}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function OperationalChart({ daily, missed_breakdown }: { daily: DailyOperational[]; missed_breakdown: MissedBreakdown }) {
  const hasDaily = daily.some((d) => d.total_screened > 0 || d.total_missed > 0);
  const chartData = daily.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  const missedData = (Object.keys(missed_breakdown) as Array<keyof MissedBreakdown>)
    .filter((k) => missed_breakdown[k] > 0)
    .map((k) => ({ reason: MISSED_LABELS[k], count: missed_breakdown[k], fill: MISSED_COLORS[k] }));
  const maxMissed = Math.max(...missedData.map((m) => m.count), 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-fg mb-0.5">Daily Screening Volume</h3>
      <p className="text-xs text-gray-500 dark:text-fg-muted mb-4">Last 30 days from operational logs</p>

      {hasDaily ? (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={chartData} margin={{ top: 5, right: 8, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<DayTip />} />
            <Bar dataKey="total_screened" fill="var(--color-accent)" radius={[3, 3, 0, 0]} barSize={10} />
            <Bar dataKey="total_missed" fill="var(--color-red-300)" radius={[3, 3, 0, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400 dark:text-fg-muted">No operational data yet</div>
      )}

      {missedData.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-surface-border">
          <p className="text-xs font-medium text-gray-600 dark:text-fg-muted mb-3">Missed screening reasons (30-day total)</p>
          <div className="space-y-2">
            {missedData.map((item) => (
              <div key={item.reason} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 dark:text-fg-muted w-28 shrink-0">{item.reason}</span>
                <div className="flex-1 h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.count / maxMissed) * 100}%`, backgroundColor: item.fill }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-fg w-6 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}