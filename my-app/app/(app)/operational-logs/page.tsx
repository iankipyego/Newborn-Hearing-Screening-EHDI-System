"use client";
// app/(app)/operational-logs/page.tsx
// Operational log list — §4.9, §48.2

import { useEffect, useState } from "react";
import Link from "next/link";

interface OperationalLog {
  id: string;
  log_date: string;
  total_births: number;
  total_screened: number;
  total_missed: number;
  avg_screening_time_minutes: number;
  staff_on_duty_count: number;
  missed_discharged_early: number;
  missed_refused: number;
  missed_equipment_down: number;
  missed_staff_absent: number;
}

export default function Page() {
  const [logs, setLogs] = useState<OperationalLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/operational-logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Operational Log</h1>
        <Link
          href="/operational-logs/new"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + Add Today&apos;s Log
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No operational logs recorded yet.</p>
          <Link href="/operational-logs/new" className="mt-2 inline-block text-blue-600 text-sm hover:underline">
            Add the first log →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b bg-gray-50">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">Births</th>
                <th className="text-right py-3 px-4">Screened</th>
                <th className="text-right py-3 px-4">Missed</th>
                <th className="text-right py-3 px-4">Coverage</th>
                <th className="text-right py-3 px-4">Avg Time (min)</th>
                <th className="text-right py-3 px-4">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const coverage = log.total_births > 0
                  ? Math.round((log.total_screened / log.total_births) * 100)
                  : 0;
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">
                      {new Date(log.log_date).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                    </td>
                    <td className="py-3 px-4 text-right">{log.total_births}</td>
                    <td className="py-3 px-4 text-right text-green-700 font-medium">{log.total_screened}</td>
                    <td className="py-3 px-4 text-right text-red-600">{log.total_missed}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${coverage >= 95 ? "bg-green-100 text-green-700" : coverage >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {coverage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{Number(log.avg_screening_time_minutes).toFixed(1)}</td>
                    <td className="py-3 px-4 text-right">{log.staff_on_duty_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
