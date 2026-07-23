"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowUpDown, ChevronUp, ChevronDown, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
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

type SortField = "research_id" | "date_of_birth" | "sex" | "mother_name" | "hospital_number" | "pathway_status";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { field: SortField; dir: SortDir; label: string }[] = [
  { field: "research_id", dir: "asc", label: "Research ID (A–Z)" },
  { field: "research_id", dir: "desc", label: "Research ID (Z–A)" },
  { field: "date_of_birth", dir: "desc", label: "Date of Birth (Newest)" },
  { field: "date_of_birth", dir: "asc", label: "Date of Birth (Oldest)" },
  { field: "mother_name", dir: "asc", label: "Mother (A–Z)" },
  { field: "mother_name", dir: "desc", label: "Mother (Z–A)" },
  { field: "hospital_number", dir: "asc", label: "Hospital # (A–Z)" },
  { field: "pathway_status", dir: "asc", label: "Status (A–Z)" },
];

export default function ChildSearchPage() {
  const router = useRouter();
  const [allRecords, setAllRecords] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmPatient, setConfirmPatient] = useState<SearchResult | null>(null);
  const [sortField, setSortField] = useState<SortField>("research_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
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

  // ── Client-side filter — instant, no API calls, so no reason to wait for a 2nd character ──
  const displayRecords = query.length >= 1
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
  const isFiltering = query.length >= 1;

  // ── Client-side sort — same records, no backend involved ──
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sortedRecords = [...displayRecords].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "research_id": cmp = (a.research_id ?? "").localeCompare(b.research_id ?? ""); break;
      case "date_of_birth": cmp = a.date_of_birth.localeCompare(b.date_of_birth); break;
      case "sex": cmp = a.sex.localeCompare(b.sex); break;
      case "mother_name": cmp = (a.mother_name ?? "").localeCompare(b.mother_name ?? ""); break;
      case "hospital_number": cmp = (a.hospital_number ?? "").localeCompare(b.hospital_number ?? ""); break;
      case "pathway_status": cmp = a.pathway_status.localeCompare(b.pathway_status); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortHeader({ field, label, align }: { field: SortField; label: string; align?: "right" }) {
    const active = sortField === field;
    return (
      <th
        className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded
                      ${active ? "text-gray-700 dark:text-fg" : "text-gray-500 dark:text-fg-muted"}
                      hover:text-gray-700 dark:hover:text-fg`}
        >
          {label}
          {active
            ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
            : <ArrowUpDown size={12} className="opacity-40" />}
        </button>
      </th>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-fg">Children</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-fg-muted">
            {loading
              ? "Loading records..."
              : `${allRecords.length} total records`}
            {isFiltering &&
              ` — showing ${displayRecords.length} match${displayRecords.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push("/children/new")}>
          <UserPlus size={16} />
          Register Child
        </Button>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="h-5 w-5 text-gray-400 dark:text-fg-muted" strokeWidth={2} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by ID, name, hospital number, date..."
          className="w-full rounded-lg border border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card
                     py-3 pl-12 pr-10 text-sm text-gray-900 dark:text-fg placeholder:text-gray-400 dark:placeholder:text-fg-muted
                     focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          autoComplete="off"
        />
        {query.length >= 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 !px-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 dark:border-surface-border border-t-accent" />
          <p className="mt-3 text-sm text-gray-400 dark:text-fg-muted">Loading children...</p>
        </div>
      )}

      {/* Empty — no records at all */}
      {!loading && !error && allRecords.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-surface-border py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
          <p className="mt-3 text-sm text-gray-500 dark:text-fg-muted">No children registered yet</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push("/children/new")}>
            Register the first child →
          </Button>
        </div>
      )}

      {/* Filtered — no matches */}
      {!loading && isFiltering && !hasResults && (
        <div className="rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-fg-muted">
            No children found matching &quot;{query}&quot;
          </p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setQuery("")}>
            Clear filter
          </Button>
        </div>
      )}

      {/* Mobile sort control — no table headers to click on phone */}
      {!loading && hasResults && (
        <div className="md:hidden mb-3">
          <label htmlFor="mobile-sort" className="sr-only">Sort by</label>
          <select
            id="mobile-sort"
            value={`${sortField}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":") as [SortField, SortDir];
              setSortField(field);
              setSortDir(dir);
            }}
            className="w-full rounded-lg border border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card
                       py-2 px-3 text-sm text-gray-700 dark:text-fg
                       focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.field}:${opt.dir}`} value={`${opt.field}:${opt.dir}`}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Results table */}
      {!loading && hasResults && (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-surface-border bg-gray-50 dark:bg-white/[0.02] text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-fg-muted">
                  <SortHeader field="research_id" label="Research ID" />
                  <SortHeader field="date_of_birth" label="Date of Birth" />
                  <SortHeader field="sex" label="Sex" />
                  <SortHeader field="mother_name" label="Mother" />
                  <SortHeader field="hospital_number" label="Hospital #" />
                  <SortHeader field="pathway_status" label="Status" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-surface-border/50">
                {sortedRecords.map((patient) => (
                  <tr
                    key={patient.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View record for ${patient.research_id ?? patient.mother_name ?? "patient"}`}
                    onClick={() => setConfirmPatient(patient)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConfirmPatient(patient); }
                    }}
                    className="cursor-pointer hover:bg-accent/5 dark:hover:bg-white/[0.02] transition-colors
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-fg">
                      {patient.research_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-fg-muted">
                      {new Date(patient.date_of_birth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-fg-muted">{patient.sex}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-fg truncate max-w-[200px]">
                      {patient.mother_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-fg-muted font-mono text-xs">
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
          <div className="md:hidden divide-y divide-gray-100 dark:divide-surface-border/50">
            {sortedRecords.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setConfirmPatient(patient)}
                className="w-full p-4 text-left hover:bg-accent/5 dark:hover:bg-white/[0.02] transition-colors
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-900 dark:text-fg">
                      {patient.research_id ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-fg-muted">
                      {new Date(patient.date_of_birth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {patient.sex}
                    </p>
                    <p className="mt-1 truncate text-sm text-gray-700 dark:text-fg">
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
