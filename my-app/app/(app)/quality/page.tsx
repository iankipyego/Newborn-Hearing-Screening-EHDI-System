"use client";
// app/(app)/quality/page.tsx
// Quality Dashboard — §8.1, §8, KPI cards + funnel + trends + bar charts
// Uses Recharts. Researcher role sees aggregate only (no patient drill-down).

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList,
} from "recharts";
import Link from "next/link";

interface KPISummary {
  coverage_rate: number;
  screened_by_1mo_rate: number;
  referral_rate: number;
  return_for_rescreen_rate: number;
  diagnosis_by_3mo_rate: number;
  intervention_by_6mo_rate: number;
  loss_to_followup_rate: number;
  total_patients: number;
  total_screened: number;
}

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface TrendPoint {
  period: string;
  coverage: number;
  referral: number;
  ltfu: number;
}

interface BarData {
  date: string;
  screened: number;
  missed: number;
}

const JCIH_TARGETS: Record<string, number> = {
  coverage_rate: 0.95,
  screened_by_1mo_rate: 0.95,
  referral_rate: 0.05,
  return_for_rescreen_rate: 0.90,
  diagnosis_by_3mo_rate: 0.90,
  intervention_by_6mo_rate: 0.90,
  loss_to_followup_rate: 0.10,
};

const KPI_LABELS: Record<string, string> = {
  coverage_rate: "Screening Coverage",
  screened_by_1mo_rate: "Screened by 1 Month",
  referral_rate: "Referral Rate",
  return_for_rescreen_rate: "Return for Rescreen",
  diagnosis_by_3mo_rate: "Diagnosis by 3 Months",
  intervention_by_6mo_rate: "Intervention by 6 Months",
  loss_to_followup_rate: "Loss to Follow-up",
};

function KPICard({ label, value, target, lowerIsBetter = false }: {
  label: string;
  value: number;
  target: number;
  lowerIsBetter?: boolean;
}) {
  const pct = Math.round(value * 100);
  const tgtPct = Math.round(target * 100);
  const isGood = lowerIsBetter ? value <= target : value >= target;
  const isWarn = !isGood && (lowerIsBetter ? value <= target * 1.5 : value >= target * 0.8);

  const color = isGood ? "text-green-700 bg-green-50 border-green-200"
    : isWarn ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

  const badge = isGood ? "✓ On target" : isWarn ? "⚠ Below target" : "✗ Off target";
  const badgeColor = isGood ? "bg-green-100 text-green-700"
    : isWarn ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold mb-2">{pct}%</p>
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-60">JCIH target: {lowerIsBetter ? "<" : "≥"}{tgtPct}%</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
      </div>
      <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isGood ? "bg-green-500" : isWarn ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.min(lowerIsBetter ? Math.max(0, 100 - pct) : pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Page() {
  const [kpis, setKpis] = useState<KPISummary | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [barData, setBarData] = useState<BarData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/dashboard/summary").then((r) => r.json()),
      fetch("/api/v1/dashboard/funnel").then((r) => r.json()),
      fetch("/api/v1/dashboard/trends").then((r) => r.json()),
      fetch("/api/v1/dashboard/bar-charts").then((r) => r.json()),
    ]).then(([summary, funnel, trends, bars]) => {
      setKpis(summary);
      setFunnelData(funnel.data ?? []);
      setTrendData(trends.data ?? []);
      setBarData(bars.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">JCIH 2019 quality indicators — live from pathway data</p>
        </div>
        <Link
          href="/quality/action-needed"
          className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
        >
          ⚠ Action Needed →
        </Link>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">JCIH Key Performance Indicators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.keys(KPI_LABELS).map((key) => (
              <KPICard
                key={key}
                label={KPI_LABELS[key]}
                value={(kpis as unknown as Record<string, number>)[key] ?? 0}
                target={JCIH_TARGETS[key]}
                lowerIsBetter={key === "referral_rate" || key === "loss_to_followup_rate"}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Based on {kpis.total_patients} enrolled patients · {kpis.total_screened} screened
          </p>
        </section>
      )}

      {/* Pathway Funnel */}
      {funnelData.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Pathway Funnel</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={300}>
              <FunnelChart>
                <Tooltip formatter={(v) => [`${v} patients`, ""]} />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#374151" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Trend lines */}
      {trendData.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Monthly Trends</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${Math.round(v * 100)}%`]} />
                <Line type="monotone" dataKey="coverage" stroke="#2563eb" strokeWidth={2} dot={false} name="Coverage" />
                <Line type="monotone" dataKey="referral" stroke="#f59e0b" strokeWidth={2} dot={false} name="Referral rate" />
                <Line type="monotone" dataKey="ltfu" stroke="#ef4444" strokeWidth={2} dot={false} name="LTFU rate" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-blue-600 inline-block" /> Coverage</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-amber-400 inline-block" /> Referral rate</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-red-500 inline-block" /> LTFU rate</span>
            </div>
          </div>
        </section>
      )}

      {/* Bar charts */}
      {barData.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Daily Screening Volume</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData.slice(-30)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="screened" fill="#2563eb" name="Screened" radius={[3, 3, 0, 0]} />
                <Bar dataKey="missed" fill="#fca5a5" name="Missed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
