"use client";
// app/(app)/children/[id]/page.tsx
// Child Profile — full record, per-ear pathway timeline, all linked data.
// §46.2 Step 2, §48.2

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Patient {
  id: string;
  research_id: string;
  hospital_number: string | null;
  date_of_birth: string;
  sex: string;
  birth_weight_grams: number;
  gestational_age_weeks: number;
  delivery_type: string;
  apgar_score_5min: number | null;
  mother_name: string;
  mother_age: number;
  mother_phone: string;
  nicu_admitted: boolean;
  nicu_days: number | null;
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
  screening_events: Array<{
    id: string;
    ear: string;
    stage: string;
    modality: string;
    result: string;
    tested_at: string;
    incomplete_reason: string | null;
  }>;
  referrals: Array<{
    id: string;
    ear: string;
    type: string;
    status: string;
    referred_at: string;
    provider_name: string;
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
    screened_within_1_month: boolean;
    diagnosed_within_3_months: boolean;
    intervention_within_6_months: boolean;
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

const STATUS_COLORS: Record<string, string> = {
  PASSED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  REFERRED_AUDIOLOGY: "bg-amber-100 text-amber-800",
  DIAGNOSED: "bg-purple-100 text-purple-800",
  LOST_TO_FOLLOWUP: "bg-red-100 text-red-800",
};

const EAR_STATE_COLORS: Record<string, string> = {
  SCREEN_1_PASSED: "bg-green-100 text-green-700 border-green-200",
  SCREEN_2_PASSED: "bg-green-100 text-green-700 border-green-200",
  RESCREEN_PASSED: "bg-green-100 text-green-700 border-green-200",
  NOT_STARTED: "bg-gray-100 text-gray-600 border-gray-200",
  SCREEN_1_FAILED: "bg-amber-100 text-amber-700 border-amber-200",
  SCREEN_2_FAILED: "bg-orange-100 text-orange-700 border-orange-200",
  CLEARED_FOR_RESCREEN: "bg-blue-100 text-blue-700 border-blue-200",
  RESCREEN_FAILED: "bg-red-100 text-red-700 border-red-200",
  DIAGNOSED: "bg-purple-100 text-purple-700 border-purple-200",
  LOST_TO_FOLLOWUP: "bg-red-200 text-red-800 border-red-300",
};

function deriveEarState(screenings: Patient["screening_events"], referrals: Patient["referrals"], diagnostics: Patient["diagnostic_evaluations"], ear: "LEFT" | "RIGHT"): string {
  const earScreenings = screenings.filter((s) => s.ear === ear).sort((a, b) => new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime());
  const earReferrals = referrals.filter((r) => r.ear === ear);
  const earDiagnostics = diagnostics.filter((d) => d.ear === ear);

  if (earDiagnostics.length > 0) return "DIAGNOSED";

  const hasAudiologyReferral = earReferrals.some((r) => r.type === "AUDIOLOGIST");
  const lastScreening = earScreenings[earScreenings.length - 1];

  if (hasAudiologyReferral && lastScreening?.stage === "RESCREEN_POST_REFERRAL" && lastScreening?.result === "NOT_PASS") return "RESCREEN_FAILED";
  if (lastScreening?.stage === "RESCREEN_POST_REFERRAL" && lastScreening?.result === "PASS") return "RESCREEN_PASSED";

  const hcpReferral = earReferrals.find((r) => r.type === "HEALTH_CARE_PROVIDER");
  if (hcpReferral && ["CLEARED", "TREATED", "SEEN"].includes(hcpReferral.status)) return "CLEARED_FOR_RESCREEN";
  if (hcpReferral && hcpReferral.status === "PENDING") return "SCREEN_2_FAILED";

  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "PASS") return "SCREEN_2_PASSED";
  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "NOT_PASS") return "SCREEN_2_FAILED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "PASS") return "SCREEN_1_PASSED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "NOT_PASS") return "SCREEN_1_FAILED";

  return "NOT_STARTED";
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/patients/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Patient not found");
        return r.json();
      })
      .then(setPatient)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error ?? "Patient not found"}</p>
          <button onClick={() => router.push("/children/search")} className="mt-3 text-sm text-blue-600 hover:underline">
            ← Back to search
          </button>
        </div>
      </div>
    );
  }

  const leftEarState = deriveEarState(patient.screening_events, patient.referrals, patient.diagnostic_evaluations, "LEFT");
  const rightEarState = deriveEarState(patient.screening_events, patient.referrals, patient.diagnostic_evaluations, "RIGHT");
  const consentGiven = patient.consent_record?.status === "GIVEN";
  const pathwayStatus = patient.pathway_milestone?.final_status ?? "IN_PROGRESS";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{patient.research_id}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[pathwayStatus] ?? "bg-gray-100 text-gray-600"}`}>
              {pathwayStatus.replace(/_/g, " ")}
            </span>
            {!consentGiven && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                CONSENT {patient.consent_record?.status ?? "PENDING"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {patient.sex} · Born {new Date(patient.date_of_birth).toLocaleDateString("en-KE", { dateStyle: "long" })}
            {patient.hospital_number && ` · Hospital #${patient.hospital_number}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* Per-ear pathway state — shown prominently per §46.2 Step 2 */}
      <div className="grid grid-cols-2 gap-4">
        {(["LEFT", "RIGHT"] as const).map((ear) => {
          const state = ear === "LEFT" ? leftEarState : rightEarState;
          const earScreenings = patient.screening_events.filter((s) => s.ear === ear);
          const lastScreen = earScreenings[earScreenings.length - 1];
          const nicu = patient.nicu_admitted && (patient.nicu_days ?? 0) > 5;
          return (
            <div key={ear} className={`border rounded-xl p-4 ${EAR_STATE_COLORS[state] ?? "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{ear} EAR</span>
                {nicu && (
                  <span className="text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                    AABR
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold">{state.replace(/_/g, " ")}</p>
              {lastScreen && (
                <p className="text-xs mt-1 opacity-75">
                  Last: {lastScreen.stage.replace(/_/g, " ")} → {lastScreen.result}
                  {" "}({new Date(lastScreen.tested_at).toLocaleDateString()})
                </p>
              )}
              {state === "NOT_STARTED" && (
                <p className="text-xs mt-1 opacity-60">No screening recorded yet</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Demographics */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Demographics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          {[
            ["Weight", `${patient.birth_weight_grams}g`],
            ["Gestational age", `${patient.gestational_age_weeks} wks`],
            ["Delivery", patient.delivery_type.replace(/_/g, " ")],
            ["Apgar (5 min)", patient.apgar_score_5min ?? "—"],
            ["NICU", patient.nicu_admitted ? `Yes (${patient.nicu_days ?? "?"} days)` : "No"],
            ["Entry source", patient.entry_source],
            ["County", patient.residence_county],
            ["Sub-county", patient.residence_subcounty],
            ["Nearest town", patient.nearest_town],
            ["Mother age", patient.mother_age],
            ["Mother phone", patient.mother_phone],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span className="text-gray-500 text-xs">{label}</span>
              <p className="font-medium text-gray-900">{String(value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">Mother Name</span>
          <p className="font-medium text-gray-900">{patient.mother_name}</p>
        </div>
      </section>

      {/* Consent */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Consent</h2>
        {patient.consent_record ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <p className={`font-semibold ${patient.consent_record.status === "GIVEN" ? "text-green-700" : "text-red-700"}`}>
                {patient.consent_record.status}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Form version</span>
              <p className="font-medium">{patient.consent_record.consent_form_version}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Recorded at</span>
              <p className="font-medium">{new Date(patient.consent_record.consented_at).toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-amber-600 text-sm">No consent record found</p>
            <Link href={`/children/${id}/consent`} className="text-sm text-blue-600 hover:underline">
              Record consent →
            </Link>
          </div>
        )}
      </section>

      {/* Risk factors */}
      {patient.risk_factors && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Risk Factors
            <span className="ml-2 text-xs font-normal text-gray-500">
              ({patient.risk_factors.risk_factor_count as number} present)
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(patient.risk_factors)
              .filter(([k, v]) => typeof v === "boolean" && v && k !== "risk_factor_count")
              .map(([key]) => (
                <span key={key} className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                  {key.replace(/^risk_/, "").replace(/_/g, " ")}
                </span>
              ))}
            {Object.values(patient.risk_factors).filter((v) => typeof v === "boolean" && v).length === 0 && (
              <p className="text-sm text-gray-500">No risk factors recorded</p>
            )}
          </div>
        </section>
      )}

      {/* Screening history */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Screening History</h2>
          <Link href={`/children/${id}/screenings/new`} className="text-sm text-blue-600 hover:underline">
            + Add result
          </Link>
        </div>
        {patient.screening_events.length === 0 ? (
          <p className="text-sm text-gray-500">No screening events recorded yet</p>
        ) : (
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
                    <td className="py-2 pr-4 text-gray-600">{new Date(se.tested_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 font-medium">{se.ear}</td>
                    <td className="py-2 pr-4 text-gray-600">{se.stage.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4">{se.modality}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        se.result === "PASS" ? "bg-green-100 text-green-700" :
                        se.result === "NOT_PASS" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {se.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Referrals */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Referrals</h2>
          <Link href={`/children/${id}/referrals/new`} className="text-sm text-blue-600 hover:underline">
            + Add referral
          </Link>
        </div>
        {patient.referrals.length === 0 ? (
          <p className="text-sm text-gray-500">No referrals recorded</p>
        ) : (
          <div className="space-y-3">
            {patient.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{r.ear} ear — {r.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{r.facility} · {new Date(r.referred_at).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  r.status === "CLEARED" ? "bg-green-100 text-green-700" :
                  r.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                  r.status === "NO_SHOW" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Diagnostic evaluations */}
      {patient.diagnostic_evaluations.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Diagnostic Evaluations</h2>
          <div className="space-y-3">
            {patient.diagnostic_evaluations.map((de) => (
              <div key={de.id} className="border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-medium">{de.ear} ear — {de.diagnosis.replace(/_/g, " ")}</p>
                {de.degree && <p className="text-xs text-gray-500">Degree: {de.degree}</p>}
                <p className="text-xs text-gray-500">{de.audiologist_name} · {new Date(de.evaluated_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notifications log */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Notifications (last 50)</h2>
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
                    <td className="py-1.5 pr-3 text-gray-500">{new Date(n.sent_at).toLocaleDateString()}</td>
                    <td className="py-1.5 pr-3">{n.channel}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{n.trigger_reason.replace(/_/g, " ")}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        n.delivery_status === "DELIVERED" ? "bg-green-50 text-green-700" :
                        n.delivery_status === "FAILED" ? "bg-red-50 text-red-700" :
                        "bg-gray-50 text-gray-600"
                      }`}>
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

      {/* Parent survey */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Parent Survey</h2>
        {patient.parent_survey ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <p className={`font-semibold ${patient.parent_survey.status === "COMPLETED" ? "text-green-700" : patient.parent_survey.status === "NO_RESPONSE" ? "text-red-700" : "text-amber-700"}`}>
                {patient.parent_survey.status}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Channel</span>
              <p className="font-medium">{patient.parent_survey.delivery_channel_preference}</p>
            </div>
            {patient.parent_survey.satisfaction_score && (
              <div>
                <span className="text-xs text-gray-500">Satisfaction</span>
                <p className="font-medium">{patient.parent_survey.satisfaction_score}/5</p>
              </div>
            )}
          </div>
        ) : (
          <Link href={`/children/${id}/survey`} className="text-sm text-blue-600 hover:underline">
            Record survey →
          </Link>
        )}
      </section>
    </div>
  );
}
