"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmIdentityModal } from "@/components/children/ConfirmIdentityModal";
import { getPatientStatusLabel } from "@/lib/pathway";
import type { PatientPathwayStatus } from "@/lib/pathway";

interface SearchResult {
  id: string;
  research_id: string | null;
  date_of_birth: string;
  sex: string;
  child_name: string | null;
  mother_name: string | null;
  hospital_number: string | null;
  pathway_status: string;
}

export default function ChildSearchPage() {
  const [allRecords, setAllRecords] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmPatient, setConfirmPatient] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load all records on mount ──
  useEffect(() => {
    async function loadAll() {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("access_token="))
          ?.split("=")[1];

        const res = await fetch("/api/v1/children/search?q=*", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        setAllRecords(data.results ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load records");
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
    loadAll();
  }, []);

  // ── Client-side filter — instant, no API calls ──
  const displayRecords = query.length >= 2
    ? allRecords.filter((r) => {
        const q = query.toLowerCase();
        return (
          (r.research_id ?? "").toLowerCase().includes(q) ||
          (r.mother_name ?? "").toLowerCase().includes(q) ||
          (r.child_name ?? "").toLowerCase().includes(q) ||
          (r.hospital_number ?? "").toLowerCase().includes(q) ||
          r.date_of_birth.includes(q) ||
          r.sex.toLowerCase().includes(q)
        );
      })
    : allRecords;

  const hasResults = displayRecords.length > 0;
  const isFiltering = query.length >= 2;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Children</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? "Loading records..."
              : `${allRecords.length} total records`}
            {isFiltering &&
              ` — showing ${displayRecords.length} match${displayRecords.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        <a
          href="/children/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Register Child
        </a>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by ID, name, hospital number, date..."
          className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-12 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          autoComplete="off"
        />
        {query.length >= 2 && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-400">Loading children...</p>
        </div>
      )}

      {/* Empty — no records at all */}
      {!loading && !error && allRecords.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No children registered yet</p>
          <a href="/children/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Register the first child →
          </a>
        </div>
      )}

      {/* Filtered — no matches */}
      {!loading && isFiltering && !hasResults && (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">
            No children found matching &quot;{query}&quot;
          </p>
          <button
            onClick={() => setQuery("")}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Results table */}
      {!loading && hasResults && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Research ID</th>
                  <th className="px-4 py-3">Date of Birth</th>
                  <th className="px-4 py-3">Sex</th>
                  <th className="px-4 py-3">Mother</th>
                  <th className="px-4 py-3">Hospital #</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayRecords.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => setConfirmPatient(patient)}
                    className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      {patient.research_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(patient.date_of_birth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{patient.sex}</td>
                    <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]">
                      {patient.mother_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {patient.hospital_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={getPatientStatusLabel(
                          (patient.pathway_status ?? "IN_PROGRESS") as PatientPathwayStatus
                        )}
                        patientStatus={
                          (patient.pathway_status ?? "IN_PROGRESS") as PatientPathwayStatus
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {displayRecords.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setConfirmPatient(patient)}
                className="w-full p-4 text-left hover:bg-blue-50/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      {patient.research_id ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(patient.date_of_birth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {patient.sex}
                    </p>
                    <p className="mt-1 truncate text-sm text-gray-700">
                      {patient.mother_name ?? "—"}
                    </p>
                  </div>
                  <StatusBadge
                    label={getPatientStatusLabel(
                      (patient.pathway_status ?? "IN_PROGRESS") as PatientPathwayStatus
                    )}
                    patientStatus={
                      (patient.pathway_status ?? "IN_PROGRESS") as PatientPathwayStatus
                    }
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Identity Modal */}
      {confirmPatient && (
        <ConfirmIdentityModal
          patient={confirmPatient}
          onClose={() => setConfirmPatient(null)}
        />
      )}
    </div>
  );
}