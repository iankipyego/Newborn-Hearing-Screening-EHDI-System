'use client';
// app/(app)/dashboard/page.tsx
// Fixed: sends auth token, stable effect dependencies, no infinite loop.

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  UserPlus, Search, ClipboardList, BarChart2,
  AlertTriangle, Download, Users, FilePenLine,
  Printer, FileText, MessageSquareWarning,
} from 'lucide-react';
import { NAV_BY_ROLE, ROLE_BADGE } from '@/lib/nav';
import KPICard from '@/components/dashboard/KPICard';
import FunnelChart from '@/components/dashboard/FunnelChart';
import TrendChart from '@/components/dashboard/TrendChart';
import OperationalChart from '@/components/dashboard/OperationalChart';
import ActionNeededTable from '@/components/dashboard/ActionNeededTable';

/* ── Types ── */
interface KPI {
  key: string; label: string; value: number | null;
  target: number; unit: string; description: string; inverted: boolean;
}
interface FunnelStage { label: string; count: number; }
interface TrendPoint {
  period_start: string; period_end: string;
  coverage_rate: number | null; referral_rate: number | null;
  loss_to_followup_rate: number | null;
}
interface DailyOperational { date: string; total_screened: number; total_missed: number; }
interface MissedBreakdown { discharged_early: number; refused: number; equipment_down: number; staff_absent: number; }
interface ActionNeededItem { patient_id: string; research_id: string; issue: string; days_overdue: number; pathway_status: string; }
interface StoredUser { id: string; name: string; role: string; site_id: string; }

/* ── Quick actions ── */
const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ElementType; description: string }[]> = {
  DATA_CLERK: [
    { label: 'Register New Child',  href: '/children/new',               icon: UserPlus,      description: 'Add a new newborn to the system' },
    { label: 'Search Children',     href: '/children/search',            icon: Search,        description: 'Find an existing child record' },
    { label: 'Operational Log',     href: '/operational-logs',           icon: ClipboardList, description: "Record today's screening activity" },
    { label: 'Correction Requests', href: '/corrections',                icon: FilePenLine,   description: 'View your pending corrections' },
    { label: 'Paper Backup Form',   href: '/admin/paper-backup-form',    icon: FileText,      description: 'Log a screening recorded on paper during an outage' },
  ],
  SCREENER: [
    { label: 'Screening Queue',     href: '/screenings/queue',           icon: ClipboardList, description: "Today's children awaiting screening" },
    { label: 'Search Children',     href: '/children/search',            icon: Search,        description: 'Find a child to screen' },
    { label: 'Correction Requests', href: '/corrections',                icon: FilePenLine,   description: 'View your flagged records' },
  ],
  SUPERVISOR: [
    { label: 'Quality Dashboard',   href: '/quality',                    icon: BarChart2,          description: 'Review KPIs and coverage rates' },
    { label: 'Action-Needed List',  href: '/quality/action-needed',      icon: AlertTriangle,      description: 'Children needing follow-up' },
    { label: 'Screening Queue',     href: '/screenings/queue',           icon: ClipboardList,      description: 'Site-wide screening worklist' },
    { label: 'Pending Surveys',     href: '/surveys/pending',            icon: MessageSquareWarning, description: 'Parent surveys awaiting SMS/WhatsApp response' },
    { label: 'Correction Requests', href: '/corrections',                icon: FilePenLine,        description: 'Review pending correction queue' },
    { label: 'Search Children',     href: '/children/search',            icon: Search,              description: 'Look up any child record' },
  ],
  RESEARCHER: [
    { label: 'Quality Dashboard',   href: '/quality',   icon: BarChart2, description: 'Aggregate programme metrics' },
    { label: 'Research Exports',    href: '/exports',   icon: Download,  description: 'Download de-identified datasets' },
  ],
  ADMIN: [
    { label: 'User Management',     href: '/admin/users',           icon: Users,               description: 'Manage staff accounts and roles' },
    { label: 'Quality Dashboard',   href: '/quality',               icon: BarChart2,           description: 'Programme-wide KPIs' },
    { label: 'Screening Queue',     href: '/screenings/queue',      icon: ClipboardList,       description: 'Site-wide screening worklist' },
    { label: 'Pending Surveys',     href: '/surveys/pending',       icon: MessageSquareWarning, description: 'Parent surveys awaiting response' },
    { label: 'Correction Requests', href: '/corrections',           icon: FilePenLine,         description: 'Full correction request queue' },
    { label: 'Paper Backup Form',   href: '/admin/paper-backup-form', icon: FileText,          description: 'Log a screening recorded on paper' },
    { label: 'Audit Log',           href: '/admin/audit-log',       icon: Search,              description: 'Review all system activity' },
  ],
};

/* ── API fetch with auth token ── */
async function apiFetch<T>(path: string): Promise<T | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const res = await fetch(`/api/v1/dashboard/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

/* ── Transforms ── */
function transformKPIs(s: Record<string, number> | null): KPI[] {
  if (!s) return [];
  const hasBirths = s.total_births > 0;
  const hasScreened = s.total_screened > 0;
  const hasReferrals = (s.referral_rate * s.total_screened) > 0;
  return [
    { key: 'coverage_rate',            label: 'Screening Coverage',      value: hasBirths ? s.coverage_rate : null, target: 0.95, unit: '%', description: 'Births screened ÷ total live births', inverted: false },
    { key: 'screened_by_1mo_rate',     label: 'Screened Before 1 Month', value: hasScreened ? s.screened_by_1mo_rate : null, target: 0.95, unit: '%', description: 'Screened within 30 days of birth', inverted: false },
    { key: 'referral_rate',            label: 'Referral Rate',           value: hasScreened ? s.referral_rate : null, target: 0.05, unit: '%', description: 'Referred to audiology ÷ total screened', inverted: true },
    { key: 'return_for_rescreen_rate', label: 'Return for Rescreen',     value: s.return_for_rescreen_rate < 1 ? s.return_for_rescreen_rate : null, target: 0.9, unit: '%', description: 'Completed Screen 2 ÷ those needing it', inverted: false },
    { key: 'diagnosis_by_3mo_rate',    label: 'Diagnosed by 3 Months',   value: hasReferrals ? s.diagnosis_by_3mo_rate : null, target: 0.9, unit: '%', description: 'Evaluated within 90 days ÷ referred to audiology', inverted: false },
    { key: 'intervention_by_6mo_rate', label: 'Intervention by 6 Months', value: s.intervention_by_6mo_rate < 1 ? s.intervention_by_6mo_rate : null, target: 0.9, unit: '%', description: 'Intervention within 180 days ÷ diagnosed with loss', inverted: false },
    { key: 'loss_to_followup_rate',    label: 'Loss to Follow-up',       value: hasScreened ? s.loss_to_followup_rate : null, target: 0.1, unit: '%', description: 'Lost to follow-up ÷ total in pathway', inverted: true },
  ];
}

function transformFunnel(f: { data: Array<{ name: string; value: number }> } | null): FunnelStage[] {
  if (!f?.data) return [];
  return f.data.map((d) => ({ label: d.name, count: d.value }));
}

function transformTrends(t: { data: Array<{ period: string; coverage: number; referral: number; ltfu: number }> } | null): TrendPoint[] {
  if (!t?.data) return [];
  return t.data.map((d) => ({
    period_start: d.period, period_end: d.period,
    coverage_rate: d.coverage, referral_rate: d.referral, loss_to_followup_rate: d.ltfu,
  }));
}

function transformOperational(b: { data: Array<Record<string, number>> } | null): { daily: DailyOperational[]; missed_breakdown: MissedBreakdown } {
  const empty = { daily: [] as DailyOperational[], missed_breakdown: { discharged_early: 0, refused: 0, equipment_down: 0, staff_absent: 0 } };
  if (!b?.data) return empty;
  const daily: DailyOperational[] = b.data.map((d) => ({ date: d.date, total_screened: d.screened, total_missed: d.missed }));
  const missed_breakdown = b.data.reduce(
    (acc, d) => ({
      discharged_early: acc.discharged_early + (d.missed_discharged_early ?? 0),
      refused: acc.refused + (d.missed_refused ?? 0),
      equipment_down: acc.equipment_down + (d.missed_equipment_down ?? 0),
      staff_absent: acc.staff_absent + (d.missed_staff_absent ?? 0),
    }),
    { discharged_early: 0, refused: 0, equipment_down: 0, staff_absent: 0 },
  );
  return { daily, missed_breakdown };
}

function transformActionNeeded(a: { data: Array<{ patient_id: string; research_id: string; flag: string; urgency: string; days_overdue: number }> } | null, role: string): ActionNeededItem[] | null {
  if (!a?.data || role === 'RESEARCHER') return role === 'RESEARCHER' ? null : [];
  return a.data.map((d) => ({
    patient_id: d.patient_id, research_id: d.research_id, issue: d.flag, days_overdue: d.days_overdue,
    pathway_status: d.urgency === 'Critical' ? 'LOST_TO_FOLLOWUP' : 'IN_PROGRESS',
  }));
}

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-surface-border rounded w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-surface-border" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-200 dark:bg-surface-border" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="h-80 rounded-xl bg-gray-200 dark:bg-surface-border" />
        <div className="h-80 rounded-xl bg-gray-200 dark:bg-surface-border" />
      </div>
    </div>
  );
}

/* ── Page ── */
export default function DashboardPage() {
  const [user, setUser]       = useState<StoredUser | null>(null);
  const [kpis, setKpis]       = useState<KPI[]>([]);
  const [funnel, setFunnel]   = useState<FunnelStage[]>([]);
  const [trends, setTrends]   = useState<TrendPoint[]>([]);
  const [daily, setDaily]     = useState<DailyOperational[]>([]);
  const [missed, setMissed]   = useState<MissedBreakdown>({ discharged_early: 0, refused: 0, equipment_down: 0, staff_absent: 0 });
  const [action, setAction]   = useState<ActionNeededItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const fetchedRef            = useRef(false);

  // Load user from localStorage — runs once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Fetch dashboard data — runs once after user is loaded
  useEffect(() => {
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [summary, funnelData, trendsData, barData, actionData] = await Promise.all([
          apiFetch<Record<string, number>>('summary'),
          apiFetch<{ data: Array<{ name: string; value: number }> }>('funnel'),
          apiFetch<{ data: Array<{ period: string; coverage: number; referral: number; ltfu: number }> }>('trends'),
          apiFetch<{ data: Array<Record<string, number>> }>('bar-charts'),
          apiFetch<{ data: Array<{ patient_id: string; research_id: string; flag: string; urgency: string; days_overdue: number }> }>('action-needed'),
        ]);

        if (cancelled) return;

        // If all returned null, token is missing or expired — redirect to login
        if (!summary && !funnelData && !trendsData && !barData && !actionData) {
          window.location.href = '/login';
          return;
        }

        setKpis(transformKPIs(summary));
        setFunnel(transformFunnel(funnelData));
        setTrends(transformTrends(trendsData));
        const ops = transformOperational(barData);
        setDaily(ops.daily);
        setMissed(ops.missed_breakdown);
        setAction(transformActionNeeded(actionData, user.role));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const badge   = ROLE_BADGE[user?.role ?? ''] ?? { label: '', color: 'bg-gray-100 text-gray-700', darkColor: 'bg-gray-800 text-gray-300 border border-gray-700' };
  const actions = QUICK_ACTIONS[user?.role ?? ''] ?? [];

  if (loading) return <Skeleton />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm text-gray-600 dark:text-fg-muted mb-4">{error}</p>
      <button onClick={() => { fetchedRef.current = false; }} className="px-4 py-2 text-xs font-semibold text-white bg-gray-800 dark:bg-accent rounded-lg hover:opacity-90">Retry</button>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-fg">
            Welcome, {user?.name.split(' ')[0]}
          </h1>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.darkColor}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-fg-muted">
          Mama Rachel Hospital · Newborn Hearing Screening System
        </p>
      </div>

      {/* Quick Actions */}
      {actions.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-fg-muted uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href}
                  className="group flex items-center gap-3 p-4 rounded-xl border transition-all duration-150
                             bg-white dark:bg-surface-card border-gray-200 dark:border-surface-border
                             hover:border-accent/40 dark:hover:border-accent/30 hover:shadow-lg dark:hover:shadow-accent/5">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-accent/10 flex items-center justify-center
                                  group-hover:bg-teal-100 dark:group-hover:bg-accent/20 transition-colors shrink-0">
                    <Icon size={18} className="text-teal-700 dark:text-accent-light" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-fg group-hover:text-teal-700 dark:group-hover:text-accent-light truncate">{a.label}</p>
                    <p className="text-xs text-gray-500 dark:text-fg-muted mt-0.5 truncate">{a.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* JCIH KPI Cards */}
      {kpis.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-fg-muted uppercase tracking-wider mb-3">JCIH 1-3-6 Indicators</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {kpis.map((kpi) => <KPICard key={kpi.key} kpi={kpi} />)}
          </div>
        </div>
      )}

      {/* Funnel + Trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FunnelChart data={funnel} />
        <TrendChart data={trends} />
      </div>

      {/* Operational Volume */}
      <OperationalChart daily={daily} missed_breakdown={missed} />

      {/* Action Needed */}
      {action !== null && <ActionNeededTable items={action} />}
    </div>
  );
}