"use client";
// app/(app)/quality/action-needed/page.tsx
// Action-needed list — §8.1, §19 overdue thresholds
// Clicking a row opens the child profile.

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActionItem {
  patient_id: string;
  research_id: string;
  flag: string;
  urgency: "High" | "Critical";
  days_overdue: number;
}

const URGENCY_STYLES = {
  High: "bg-amber-50 border-amber-200 text-amber-800",
  Critical: "bg-red-50 border-red-200 text-red-800",
};

const URGENCY_BADGE = {
  High: "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
};

export default function Page() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  function load() {
    setLoading(true);
    fetch("/api/v1/dashboard/action-needed")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.data ?? []);
        setLastRefreshed(new Date());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const critical = items.filter((i) => i.urgency === "Critical");
  const high = items.filter((i) => i.urgency === "High");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Action-Needed List</h1>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Last refreshed: {lastRefreshed.toLocaleTimeString()} · Thresholds per §19 (early-warning, before JCIH limits)
      </p>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-700 font-semibold text-lg">✓ No overdue actions</p>
          <p className="text-green-600 text-sm mt-1">All patients are within their follow-up windows.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {critical.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
                  Critical ({critical.length})
                </h2>
                <span className="text-xs text-red-500">— requires immediate supervisor attention</span>
              </div>
              <div className="space-y-2">
                {critical.map((item, i) => (
                  <Link
                    key={`${item.patient_id}-${i}`}
                    href={`/children/${item.patient_id}`}
                    className={`flex items-center justify-between border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow ${URGENCY_STYLES.Critical}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{item.research_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${URGENCY_BADGE.Critical}`}>
                          CRITICAL
                        </span>
                      </div>
                      <p className="text-sm">{item.flag}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-lg font-bold">{item.days_overdue}d</p>
                      <p className="text-xs opacity-70">overdue</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {high.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                  High Priority ({high.length})
                </h2>
              </div>
              <div className="space-y-2">
                {high.map((item, i) => (
                  <Link
                    key={`${item.patient_id}-${i}`}
                    href={`/children/${item.patient_id}`}
                    className={`flex items-center justify-between border rounded-xl px-4 py-3 hover:shadow-sm transition-shadow ${URGENCY_STYLES.High}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{item.research_id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${URGENCY_BADGE.High}`}>
                          HIGH
                        </span>
                      </div>
                      <p className="text-sm">{item.flag}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-lg font-bold">{item.days_overdue}d</p>
                      <p className="text-xs opacity-70">overdue</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
