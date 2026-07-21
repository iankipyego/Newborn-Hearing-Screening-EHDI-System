// app/(app)/referrals/[referralId]/edit/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface ReferralDetail {
  id: string;
  ear: "LEFT" | "RIGHT";
  type: "HEALTH_CARE_PROVIDER" | "AUDIOLOGIST";
  reason: string;
  provider_name: string;
  facility: string;
  status: string;
  referred_at: string;
  patient: {
    id: string;
    research_id: string | null;
    mother_name: string | null;
  };
}

type Outcome = "CLEARED" | "TREATED" | "SEEN" | "NO_SHOW";

const OUTCOME_LABELS: Record<Outcome, string> = {
  CLEARED: "Cleared — no issue found",
  TREATED: "Treated — otitis media / middle ear fluid",
  SEEN: "Seen — PE tube placed",
  NO_SHOW: "No-show — family did not attend",
};

export default function ResolveReferralPage({
  params,
}: {
  params: Promise<{ referralId: string }>;
}) {
  const { referralId } = use(params);
  const router = useRouter();

  const [referral, setReferral] = useState<ReferralDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string } | null>(null);

  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [providerName, setProviderName] = useState("");
  const [facility, setFacility] = useState("");
  const [diagnosisAtReferral, setDiagnosisAtReferral] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [medicalClearanceGiven, setMedicalClearanceGiven] = useState(false);

  function authHeaders(): Record<string, string> {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("access_token="))
      ?.split("=")[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/referrals/${referralId}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load referral");
        }
        const data = await res.json();
        setReferral(data.referral);
        setProviderName(data.referral.provider_name ?? "");
        setFacility(data.referral.facility ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          status: outcome,
          provider_name: providerName || undefined,
          facility: facility || undefined,
          diagnosis_at_referral: diagnosisAtReferral || undefined,
          treatment_given: outcome === "TREATED" ? treatmentGiven || undefined : undefined,
          medical_clearance_given: outcome === "CLEARED" ? medicalClearanceGiven : undefined,
          pe_tube_placed: outcome === "SEEN" ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to resolve referral");
        return;
      }
      setSuccess({ message: data.message });
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (error && !referral) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{error}</p>
          <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 hover:underline">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-emerald-900">Referral Resolved</h2>
          <p className="mt-2 text-sm text-emerald-700">{success.message}</p>
          <button
            onClick={() => router.push(`/children/${referral?.patient.id}`)}
            className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Back to child profile
          </button>
        </div>
      </div>
    );
  }

  const isAudiology = referral?.type === "AUDIOLOGIST";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => router.push(`/children/${referral?.patient.id}`)}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to {referral?.patient.research_id ?? "child profile"}
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Resolve Referral</h1>
        <p className="mt-1 text-sm text-gray-500">
          {referral?.ear === "LEFT" ? "Left" : "Right"} ear —{" "}
          {referral?.type === "HEALTH_CARE_PROVIDER" ? "Health Care Provider" : "Audiologist"} —{" "}
          {referral?.reason}
        </p>
      </div>

      {isAudiology && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          This is an audiology referral — it resolves through a diagnostic evaluation, not a
          status change here. Use "Add Diagnostic Evaluation" on the child profile instead.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!isAudiology && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-700">Outcome</legend>
            <p className="mt-0.5 text-xs text-gray-400">
              What did the health care provider find or do?
            </p>
            <div className="mt-2 grid gap-2">
              {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    outcome === o
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider name</label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Facility</label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Diagnosis at referral
            </label>
            <select
              value={diagnosisAtReferral}
              onChange={(e) => setDiagnosisAtReferral(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select...</option>
              <option value="Otitis_media">Otitis media</option>
              <option value="Blockage">Blockage</option>
              <option value="Infection">Infection</option>
              <option value="Clear">Clear</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {outcome === "TREATED" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Treatment given</label>
              <input
                type="text"
                value={treatmentGiven}
                onChange={(e) => setTreatmentGiven(e.target.value)}
                placeholder="e.g. Amoxicillin, 10-day course"
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-gray-400">
                Rescreen will be scheduled after the treatment delay window.
              </p>
            </div>
          )}

          {outcome === "SEEN" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              PE tube placement will be recorded. Rescreen will be scheduled after the PE-tube
              delay window (shorter than the otitis-media treatment delay).
            </div>
          )}

          {outcome === "CLEARED" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={medicalClearanceGiven}
                onChange={(e) => setMedicalClearanceGiven(e.target.checked)}
                className="rounded border-gray-300"
              />
              Medical clearance given — proceed to rescreen immediately
            </label>
          )}

          {outcome === "NO_SHOW" && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              This will be logged as a no-show — the case stays open and HCP-referral reminders
              resume. It is not dropped.
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!outcome || submitting}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Resolve Referral"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
