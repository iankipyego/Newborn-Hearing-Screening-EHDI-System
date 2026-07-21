"use client";
// app/(app)/children/[id]/page.tsx
// Child Profile — full record, per-ear pathway timeline, all linked data.
// §46.2 Step 2, §48.2

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EarStateCard } from "@/components/children/EarStateCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getPatientStatusLabel, type EarStateValue } from "@/lib/pathway";

// ═══════════════════════════════════════════════════════════════
// TYPES — snake_case to match Prisma default JSON output
// ═══════════════════════════════════════════════════════════════

interface Patient {
  id: string;
  research_id: string;
  hospital_number: string | null;
  date_of_birth: string;
  sex: string;
  child_name: string | null;                          // NEW
  birth_weight_grams: number;
  gestational_age_weeks: number;
  delivery_type: string;
  apgar_score_5min: number | null;
  mother_name: string;
  mother_age: number;
  mother_phone: string;
  nicu_admitted: boolean;
  nicu_days: number | null;
  screened_at_birth: boolean | null;                  // NEW
  residence_county: string;
  residence_subcounty: string;
  nearest_town: string;
  entry_source: string;
  created_at: string;
  consent_record: {
    status: string;
    consent_form_version: string;
    consented_at: string;
  } | null;
  risk_factors: Record<string, boolean | number | string | null> | null;
  ear_pathway_states: Array<{
    ear: "LEFT" | "RIGHT";
    state: string;
    modality: string;
  }> | null;
  visual_inspections: Array<{
    id: string;
    ear: "LEFT" | "RIGHT";
    outcome: string;
    finding_note: string | null;
    inspected_at: string;
  }> | null;
  screening_events: Array<{
    id: string;
    ear: string;
    stage: string;
    modality: string;
    result: string;
    tested_at: string;
    incomplete_reason: string | null;
    attempts: number;
    duration_minutes: string;
    clinical_comment: string | null;
  }>;
  referrals: Array<{
    id: string;
    ear: string;
    type: string;
    status: string;
    referred_at: string;
    resolved_at: string | null;
    provider_name: string | null;
    facility: string;
  }>;
  diagnostic_evaluations: Array<{
    id: string;
    ear: string;
    diagnosis: string;
    degree: string | null;
    evaluated_at: string;
    audiologist_name: string;
  }>;
  pathway_milestone: {
    final_status: string;
    days_birth_to_first_screen: number | null;
    screened_within_1_month: boolean | null;
    diagnosed_within_3_months: boolean | null;
    intervention_within_6_months: boolean | null;
  } | null;
  notifications_log: Array<{
    id: string;
    channel: string;
    trigger_reason: string;
    delivery_status: string;
    sent_at: string;
  }>;
  parent_survey: {
    status: string;
    delivery_channel_preference: string;
    satisfaction_score: number | null;
  } | null;
}

// ═══════════════════════════════════════════════════════════════
// EAR STATE DERIVATION
// Uses DB state (ear_pathway_states) if available,
// falls back to deriving from raw events for backward compat.
// ═══════════════════════════════════════════════════════════════

function resolveEarState(
  patient: Patient,
  ear: "LEFT" | "RIGHT"
): EarStateValue {
  // Prefer the stored pathway state if it exists
  const stored = patient.ear_pathway_states?.find((e) => e.ear === ear);
  if (stored) return stored.state as EarStateValue;

  // Fallback: derive from raw events
  return deriveEarStateFromEvents(
    patient.screening_events,
    patient.referrals,
    patient.diagnostic_evaluations,
    ear
  );
}

function deriveEarStateFromEvents(
  screenings: Patient["screening_events"],
  referrals: Patient["referrals"],
  diagnostics: Patient["diagnostic_evaluations"],
  ear: "LEFT" | "RIGHT"
): EarStateValue {
  const earScreenings = screenings
    .filter((s) => s.ear === ear)
    .sort((a, b) => new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime());
  const earReferrals = referrals.filter((r) => r.ear === ear);
  const earDiagnostics = diagnostics.filter((d) => d.ear === ear);

  if (earDiagnostics.length > 0) return "DIAGNOSED";

  const hasAudiologyReferral = earReferrals.some(
    (r) => r.type === "AUDIOLOGIST"
  );
  const lastScreening = earScreenings[earScreenings.length - 1];

  if (
    hasAudiologyReferral &&
    lastScreening?.stage === "RESCREEN_POST_REFERRAL" &&
    lastScreening?.result === "NOT_PASS"
  )
    return "RESCREEN_FAILED";
  if (
    lastScreening?.stage === "RESCREEN_POST_REFERRAL" &&
    lastScreening?.result === "PASS"
  )
    return "RESCREEN_PASSED";

  const hcpReferral = earReferrals.find(
    (r) => r.type === "HEALTH_CARE_PROVIDER"
  );
  if (hcpReferral && ["CLEARED", "TREATED", "SEEN"].includes(hcpReferral.status))
    return "CLEARED_FOR_RESCREEN";
  if (hcpReferral && hcpReferral.status === "PENDING") return "SCREEN_2_FAILED";

  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "PASS")
    return "SCREEN_2_PASSED";
  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "NOT_PASS")
    return "SCREEN_2_FAILED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "PASS")
    return "SCREEN_1_PASSED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "NOT_PASS")
    return "SCREEN_1_FAILED";

  return "NOT_STARTED";
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const STAGE_LABELS: Record<string, string> = {
  SCREEN_1: "Screen 1",
  SCREEN_2: "Screen 2",
  RESCREEN_POST_REFERRAL: "Rescreen",
};

function formatResultBadge(result: string): string {
  if (result === "PASS") return "bg-green-100 text-green-700";
  if (result === "NOT_PASS") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function formatReferralBadge(status: string): string {
  if (status === "CLEARED" || status === "TREATED")
    return "bg-green-100 text-green-700";
  if (status === "PENDING") return "bg-amber-100 text-amber-700";
  if (status === "NO_SHOW") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function formatDeliveryStatus(status: string): string {
  if (status === "DELIVERED") return "bg-green-50 text-green-700";
  if (status === "FAILED") return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-600";
}

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function ChildProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/patients/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Patient not found");
        return r.json();
      })
      .then((data) => setPatient(data.patient ?? data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Error ──
  if (error || !patient) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error ?? "Patient not found"}</p>
          <button
            onClick={() => router.push("/children/search")}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to search
          </button>
        </div>
      </div>
    );
  }

  // ── Derived data ──
  const leftEarState = resolveEarState(patient, "LEFT");
  const rightEarState = resolveEarState(patient, "RIGHT");
  const leftModality =
    patient.ear_pathway_states?.find((e) => e.ear === "LEFT")?.modality ??
    (patient.nicu_admitted && (patient.nicu_days ?? 0) > 5 ? "AABR" : "OAE");
  const rightModality =
    patient.ear_pathway_states?.find((e) => e.ear === "RIGHT")?.modality ??
    (patient.nicu_admitted && (patient.nicu_days ?? 0) > 5 ? "AABR" : "OAE");
  const consentGiven = patient.consent_record?.status === "GIVEN";
  const pathwayStatus =
    patient.pathway_milestone?.final_status ?? "IN_PROGRESS";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* ── Back link ── */}
      <button
        onClick={() => router.push("/children/search")}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        Back to search
      </button>

      {/* ════════════════════════════════════════════════════════
          HEADER — research ID, child name, status badge, actions
          ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.research_id}
              </h1>
              <StatusBadge
                label={getPatientStatusLabel(
                  pathwayStatus as import("@/lib/pathway").PatientPathwayStatus
                )}
                patientStatus={pathwayStatus as import("@/lib/pathway").PatientPathwayStatus}
                size="md"
              />
              {!consentGiven && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  CONSENT {patient.consent_record?.status ?? "PENDING"}
                </span>
              )}
            </div>

            {/* NEW: Child's name — primary identity line */}
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {patient.child_name ?? (
                <span className="text-sm font-normal italic text-amber-600">
                  Name not yet provided
                </span>
              )}
            </p>

            {/* Mother — secondary line */}
            <p className="text-sm text-gray-500">
              Mother:{" "}
              <span className="font-medium text-gray-700">
                {patient.mother_name}
              </span>
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>
              Born{" "}
              {new Date(patient.date_of_birth).toLocaleDateString("en-KE", {
                dateStyle: "long",
              })}
            </p>
            <p>
              {patient.sex} · {patient.birth_weight_grams}g ·{" "}
              {patient.gestational_age_weeks} wks GA
              {patient.hospital_number &&
                ` · Hosp #${patient.hospital_number}`}
            </p>
          </div>
        </div>

        {/* Key info row */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span>
            Delivery:{" "}
            <span className="text-gray-700">
              {patient.delivery_type.replace(/_/g, " ")}
            </span>
          </span>
          <span>
            Apgar 5min:{" "}
            <span className="text-gray-700">
              {patient.apgar_score_5min ?? "—"}
            </span>
          </span>
          <span>
            NICU:{" "}
            <span className="text-gray-700">
              {patient.nicu_admitted
                ? `Yes (${patient.nicu_days ?? "?"} days)`
                : "No"}
            </span>
          </span>

          {/* NEW: Screened at birth */}
          <span>
            Screened at birth:{" "}
            <span className="text-gray-700">
              {patient.screened_at_birth === true
                ? "Yes"
                : patient.screened_at_birth === false
                  ? "No"
                  : "Unknown"}
            </span>
          </span>

          <span>
            Entry:{" "}
            <span className="text-gray-700">{patient.entry_source}</span>
          </span>
          {patient.pathway_milestone?.days_birth_to_first_screen != null && (
  <span>
    Days to 1st screen:{" "}
    <span className="text-gray-700">
      {patient.pathway_milestone?.days_birth_to_first_screen}
    </span>
    {patient.pathway_milestone?.screened_within_1_month === false && (
                <span className="ml-1 text-amber-600">
                  (outside 1-month target)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/children/${id}/screenings/new`}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + Add Screening Result
          </Link>
          <Link
            href={`/children/${id}/referrals/new`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            + Add Referral
          </Link>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          PER-EAR PATHWAY STATE — most prominent element (§46.2)
          ════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EarStateCard
          ear="LEFT"
          state={leftEarState}
          modality={leftModality}
          patientId={patient.id}
          hasVisualInspection={Boolean(
            patient.visual_inspections?.some((v) => v.ear === "LEFT")
          )}
        />
        <EarStateCard
          ear="RIGHT"
          state={rightEarState}
          modality={rightModality}
          patientId={patient.id}
          hasVisualInspection={Boolean(
            patient.visual_inspections?.some((v) => v.ear === "RIGHT")
          )}
        />
      </div>

      {/* ════════════════════════════════════════════════════════
          DEMOGRAPHICS
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Demographics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          {(
            [
              ["Child's name", patient.child_name ?? "Not yet provided"],       // NEW
              ["Weight", `${patient.birth_weight_grams}g`],
              ["Gestational age", `${patient.gestational_age_weeks} wks`],
              ["Delivery", patient.delivery_type.replace(/_/g, " ")],
              ["Apgar (5 min)", patient.apgar_score_5min ?? "—"],
              [
                "NICU",
                patient.nicu_admitted
                  ? `Yes (${patient.nicu_days ?? "?"} days)`
                  : "No",
              ],
              ["Screened at birth",                                              // NEW
                patient.screened_at_birth === true
                  ? "Yes"
                  : patient.screened_at_birth === false
                    ? "No"
                    : "Unknown"],
              ["Entry source", patient.entry_source],
              ["County", patient.residence_county],
              ["Sub-county", patient.residence_subcounty],
              ["Nearest town", patient.nearest_town],
              ["Mother age", patient.mother_age],
              ["Mother phone", patient.mother_phone],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span className="text-gray-500 text-xs">{label}</span>
              <p className={`font-medium ${label === "Child's name" && !patient.child_name ? "italic text-amber-600" : "text-gray-900"}`}>
                {String(value)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">Mother Name</span>
          <p className="font-medium text-gray-900">{patient.mother_name}</p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CONSENT
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Consent</h2>
        {patient.consent_record ? (
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <p
                className={`font-semibold ${
                  patient.consent_record.status === "GIVEN"
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {patient.consent_record.status}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Form version</span>
              <p className="font-medium">
                {patient.consent_record.consent_form_version}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Recorded at</span>
              <p className="font-medium">
                {new Date(
                  patient.consent_record.consented_at
                ).toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-amber-600 text-sm">No consent record found</p>
            <Link
              href={`/children/${id}/consent`}
              className="text-sm text-blue-600 hover:underline"
            >
              Record consent →
            </Link>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          RISK FACTORS
          ════════════════════════════════════════════════════════ */}
      {patient.risk_factors && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Risk Factors
            <span className="ml-2 text-xs font-normal text-gray-500">
              (
              {(patient.risk_factors.risk_factor_count as number) ?? 0}{" "}
              present)
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(patient.risk_factors)
              .filter(
                ([k, v]) => typeof v === "boolean" && v && k !== "risk_factor_count"
              )
              .map(([key]) => (
                <span
                  key={key}
                  className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full"
                >
                  {key
                    .replace(/^risk_/, "")
                    .replace(/_/g, " ")}
                </span>
              ))}
            {Object.values(patient.risk_factors).filter(
              (v) => typeof v === "boolean" && v
            ).length === 0 && (
              <p className="text-sm text-gray-500">
                No risk factors recorded
              </p>
            )}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          SCREENING HISTORY (collapsible timeline)
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-2 text-base font-semibold text-gray-800 hover:text-gray-900"
          >
            <svg
              className={`h-4 w-4 transition-transform ${
                showTimeline ? "rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
            Screening History ({patient.screening_events.length} event
            {patient.screening_events.length !== 1 ? "s" : ""})
          </button>
          <Link
            href={`/children/${id}/screenings/new`}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add result
          </Link>
        </div>

        {!showTimeline && patient.screening_events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left pb-2 pr-4">Date</th>
                  <th className="text-left pb-2 pr-4">Ear</th>
                  <th className="text-left pb-2 pr-4">Stage</th>
                  <th className="text-left pb-2 pr-4">Modality</th>
                  <th className="text-left pb-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patient.screening_events.map((se) => (
                  <tr key={se.id}>
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(se.tested_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 font-medium">{se.ear}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {STAGE_LABELS[se.stage] ?? se.stage.replace(/_/g, " ")}
                    </td>
                    <td className="py-2 pr-4">{se.modality}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formatResultBadge(se.result)}`}
                      >
                        {se.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showTimeline && (
          <div className="space-y-3">
            {patient.screening_events.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">
                No screening events recorded yet
              </p>
            )}

            {patient.screening_events.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 uppercase">
                        {event.ear}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {STAGE_LABELS[event.stage] ??
                          event.stage.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">
                        {event.modality}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(event.tested_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" — "}
                      {event.attempts} attempt
                      {event.attempts !== 1 ? "s" : ""}
                      {", "}
                      {event.duration_minutes} min
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${formatResultBadge(event.result)}`}
                  >
                    {event.result}
                  </span>
                </div>
                {event.clinical_comment && (
                  <p className="mt-2 text-xs italic text-gray-500">
                    &quot;{event.clinical_comment}&quot;
                  </p>
                )}
                {event.incomplete_reason && (
                  <p className="mt-1 text-xs text-amber-600">
                    Reason: {event.incomplete_reason}
                  </p>
                )}
              </div>
            ))}

            {/* Referrals nested under timeline */}
            {patient.referrals.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                  Referrals
                </p>
                {patient.referrals.map((r) => (
                  <div
                    key={r.id}
                    className="mb-2 rounded-lg border border-purple-100 bg-purple-50/30 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {r.ear} —{" "}
                        {r.type === "HEALTH_CARE_PROVIDER"
                          ? "HCP"
                          : "Audiology"}{" "}
                        Referral
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${formatReferralBadge(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Referred:{" "}
                      {new Date(r.referred_at).toLocaleDateString("en-GB")}
                      {r.provider_name && ` — ${r.provider_name}`}
                      {r.facility && ` (${r.facility})`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          DIAGNOSTIC EVALUATIONS
          ════════════════════════════════════════════════════════ */}
      {patient.diagnostic_evaluations.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Diagnostic Evaluations
          </h2>
          <div className="space-y-3">
            {patient.diagnostic_evaluations.map((de) => (
              <div
                key={de.id}
                className="border border-gray-100 rounded-lg p-3"
              >
                <p className="text-sm font-medium">
                  {de.ear} ear — {de.diagnosis.replace(/_/g, " ")}
                </p>
                {de.degree && (
                  <p className="text-xs text-gray-500">
                    Degree: {de.degree}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {de.audiologist_name} ·{" "}
                  {new Date(de.evaluated_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          REFERRALS (standalone section — always visible)
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Referrals</h2>
          <Link
            href={`/children/${id}/referrals/new`}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add referral
          </Link>
        </div>
        {patient.referrals.length === 0 ? (
          <p className="text-sm text-gray-500">No referrals recorded</p>
        ) : (
          <div className="space-y-3">
            {patient.referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-gray-100 rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {r.ear} ear — {r.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.facility} · {new Date(r.referred_at).toLocaleDateString()}
                    {r.resolved_at &&
                      ` · Resolved ${new Date(r.resolved_at).toLocaleDateString()}`}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formatReferralBadge(r.status)}`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          NOTIFICATIONS LOG
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Notifications (last 50)
        </h2>
        {patient.notifications_log.length === 0 ? (
          <p className="text-sm text-gray-500">No notifications sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-left pb-2 pr-3">Channel</th>
                  <th className="text-left pb-2 pr-3">Trigger</th>
                  <th className="text-left pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {patient.notifications_log.map((n) => (
                  <tr key={n.id}>
                    <td className="py-1.5 pr-3 text-gray-500">
                      {new Date(n.sent_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 pr-3">{n.channel}</td>
                    <td className="py-1.5 pr-3 text-gray-500">
                      {n.trigger_reason.replace(/_/g, " ")}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${formatDeliveryStatus(n.delivery_status)}`}
                      >
                        {n.delivery_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          PARENT SURVEY
          ════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Parent Survey
        </h2>
        {patient.parent_survey ? (
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <p
                className={`font-semibold ${
                  patient.parent_survey.status === "COMPLETED"
                    ? "text-green-700"
                    : patient.parent_survey.status === "NO_RESPONSE"
                      ? "text-red-700"
                      : "text-amber-700"
                }`}
              >
                {patient.parent_survey.status}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Channel</span>
              <p className="font-medium">
                {patient.parent_survey.delivery_channel_preference}
              </p>
            </div>
            {patient.parent_survey.satisfaction_score && (
              <div>
                <span className="text-xs text-gray-500">Satisfaction</span>
                <p className="font-medium">
                  {patient.parent_survey.satisfaction_score}/5
                </p>
              </div>
            )}
          </div>
        ) : (
          <Link
            href={`/children/${id}/survey`}
            className="text-sm text-blue-600 hover:underline"
          >
            Record survey →
          </Link>
        )}
      </section>
    </div>
  );
}