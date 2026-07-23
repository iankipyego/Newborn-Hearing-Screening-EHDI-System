'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ActionNeededItem } from '@/lib/dashboard/queries';

const STYLES: Record<string, string> = {
  IN_PROGRESS:        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
  REFERRED_AUDIOLOGY: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
  DIAGNOSED:          'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40',
  LOST_TO_FOLLOWUP:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
  PASSED:             'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
};

export default function ActionNeededTable({ items }: { items: ActionNeededItem[] }) {
  const router = useRouter();
  const goToPatient = (patientId: string) => router.push(`/children/${patientId}`);

  if (items.length === 0) return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-fg mb-0.5">Action Needed</h3>
      <p className="text-xs text-gray-500 dark:text-fg-muted mb-4">Patients requiring follow-up attention</p>
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 dark:text-fg-muted">
        No overdue items — all patients are on track
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-fg">Action Needed</h3>
          <p className="text-xs text-gray-500 dark:text-fg-muted">Patients requiring follow-up attention</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-xs font-semibold text-red-700 dark:text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Phone: stacked cards — a table here would force horizontal scroll */}
      <div className="md:hidden space-y-2">
        {items.map((item) => (
          <Link key={`${item.patient_id}-${item.issue}`}
             href={`/children/${item.patient_id}`}
             className="block rounded-lg border border-gray-100 dark:border-surface-border/50 p-3
                        hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-mono font-semibold text-teal-700 dark:text-accent-light">{item.research_id}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${STYLES[item.pathway_status] ?? STYLES.IN_PROGRESS}`}>
                {item.pathway_status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-700 dark:text-fg mb-1.5">{item.issue}</p>
            {item.days_overdue > 0
              ? <span className={`text-xs font-bold ${item.days_overdue > 30 ? 'text-red-600 dark:text-red-400' : item.days_overdue > 14 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-fg-muted'}`}>{item.days_overdue}d overdue</span>
              : <span className="text-xs text-gray-400 dark:text-fg-muted">Not overdue</span>}
          </Link>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 dark:border-surface-border">
              <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-fg-muted">Research ID</th>
              <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-fg-muted">Issue</th>
              <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-fg-muted text-right">Days</th>
              <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-fg-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.patient_id}-${item.issue}`}
                  role="link"
                  tabIndex={0}
                  aria-label={`View record for ${item.research_id}`}
                  className="border-b border-gray-50 dark:border-surface-border/50 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  onClick={() => goToPatient(item.patient_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToPatient(item.patient_id); }
                  }}>
                <td className="py-2.5 pr-4">
                  <span className="text-xs font-mono font-semibold text-teal-700 dark:text-accent-light">{item.research_id}</span>
                </td>
                <td className="py-2.5 pr-4 text-xs text-gray-700 dark:text-fg">{item.issue}</td>
                <td className="py-2.5 pr-4 text-right">
                  {item.days_overdue > 0
                    ? <span className={`text-xs font-bold ${item.days_overdue > 30 ? 'text-red-600 dark:text-red-400' : item.days_overdue > 14 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-fg-muted'}`}>{item.days_overdue}d</span>
                    : <span className="text-xs text-gray-400 dark:text-fg-muted">—</span>}
                </td>
                <td className="py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${STYLES[item.pathway_status] ?? STYLES.IN_PROGRESS}`}>
                    {item.pathway_status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}