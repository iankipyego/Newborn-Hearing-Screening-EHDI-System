"use client";
// app/(app)/children/[id]/screenings/new/page.tsx
// Add Screening Result — §46.2 Step 3, §17.4 out-of-order protection.
// Auto-suggests stage from pathway state. Locks modality for NICU>5d babies.

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScreeningEventCreateSchema, type ScreeningEventCreateInput } from "@/lib/validation/schemas";

interface PatientSummary {
  id: string;
  research_id: string;
  mother_name: string;
  date_of_birth: string;
  nicu_admitted: boolean;
  nicu_days: number | null;
  screening_events: Array<{ ear: string; stage: string; result: string; tested_at: string }>;
  referrals: Array<{ ear: string; type: string; status: string }>;
}

interface ScreenerUser {
  id: string;
  name: string;
  role: string;
}

function deriveEarStage(patient: PatientSummary, ear: "LEFT" | "RIGHT"): string {
  const earScreenings = patient.screening_events.filter((s) => s.ear === ear);
  const last = earScreenings[earScreenings.length - 1];
  const hcpReferral = patient.referrals.find(
    (r) => r.ear === ear && r.type === "HEALTH_CARE_PROVIDER" && ["CLEARED", "TREATED", "SEEN"].includes(r.status)
  );
  if (hcpReferral) return "RESCREEN_POST_REFERRAL";
  if (!last) return "SCREEN_1";
  if (last.stage === "SCREEN_1" && last.result === "NOT_PASS") return "SCREEN_2";
  if (last.stage === "SCREEN_1" && last.result === "INCOMPLETE") return "SCREEN_1";
  if (last.stage === "SCREEN_2" && last.result === "INCOMPLETE") return "SCREEN_2";
  return "SCREEN_1"; // fallback
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPaperBackup = searchParams.get("source") === "paper";

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [screeners, setScreeners] = useState<ScreenerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScreeningEventCreateInput>({
    resolver: zodResolver(ScreeningEventCreateSchema),
    defaultValues: {
      entry_source: isPaperBackup ? "PAPER_BACKUP" : "LIVE",
      tested_at: new Date().toISOString().slice(0, 16),
      attempts: 1,
      ambient_noise_level: "Low",
    },
  });

  const selectedEar = watch("ear");
  const selectedResult = watch("result");
  const entrySource = watch("entry_source");

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/patients/${id}`).then((r) => r.json()),
      fetch(`/api/v1/users?role=SCREENER`).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([p, u]) => {
      setPatient(p);
      setScreeners(u.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto-suggest stage when ear changes
  useEffect(() => {
    if (!patient || !selectedEar) return;
    const suggestedStage = deriveEarStage(patient, selectedEar as "LEFT" | "RIGHT");
    setValue("stage", suggestedStage as ScreeningEventCreateInput["stage"]);

    // Lock modality for NICU>5d babies (§17.1)
    const nicuDays = patient.nicu_days ?? 0;
    if (patient.nicu_admitted && nicuDays > 5) {
      setValue("modality", "AABR");
    }
  }, [selectedEar, patient, setValue]);

  const nicuDays = patient?.nicu_days ?? 0;
  const modalityLocked = patient?.nicu_admitted && nicuDays > 5;
  const suggestedStage = patient && selectedEar
    ? deriveEarStage(patient, selectedEar as "LEFT" | "RIGHT")
    : null;

  async function onSubmit(data: ScreeningEventCreateInput) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/patients/${id}/screenings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tested_at: new Date(data.tested_at).toISOString() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save screening result");
      }
      const json = await res.json();
      setSuccessMsg(json.message ?? "Screening result saved successfully.");
      setTimeout(() => router.push(`/children/${id}`), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!patient) {
    return <div className="p-8 text-red-600">Patient not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Context header — who we are entering for */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
        <p className="text-sm font-semibold text-blue-900">
          Entering result for: {patient.research_id} — {patient.mother_name}
        </p>
        <p className="text-xs text-blue-600 mt-0.5">
          DOB: {new Date(patient.date_of_birth).toLocaleDateString("en-KE", { dateStyle: "long" })}
        </p>
        {isPaperBackup && (
          <p className="text-xs text-amber-700 font-semibold mt-1">
            📄 PAPER BACKUP ENTRY — Enter the actual test time from the paper form
          </p>
        )}
      </div>

      {successMsg && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-800 font-medium">✓ {successMsg}</p>
          <p className="text-xs text-green-600 mt-1">Redirecting to patient profile…</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-6">Add Screening Result</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Ear */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ear <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {(["LEFT", "RIGHT"] as const).map((ear) => (
              <label key={ear} className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-3 cursor-pointer transition-colors ${
                selectedEar === ear ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="radio" value={ear} {...register("ear")} className="sr-only" />
                <span className="text-sm font-medium">{ear}</span>
              </label>
            ))}
          </div>
          {errors.ear && <p className="text-red-500 text-xs mt-1">{errors.ear.message}</p>}
        </div>

        {/* Stage — auto-suggested */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage <span className="text-red-500">*</span>
          </label>
          {suggestedStage && (
            <p className="text-xs text-blue-600 mb-1">
              ⚡ Auto-suggested from pathway state: {suggestedStage.replace(/_/g, " ")}
            </p>
          )}
          <select
            {...register("stage")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select stage</option>
            <option value="SCREEN_1">Screen 1</option>
            <option value="SCREEN_2">Screen 2</option>
            <option value="RESCREEN_POST_REFERRAL">Rescreen (post-referral)</option>
          </select>
          {errors.stage && <p className="text-red-500 text-xs mt-1">{errors.stage.message}</p>}
        </div>

        {/* Modality — locked for NICU>5d */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Modality <span className="text-red-500">*</span>
          </label>
          {modalityLocked ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <span className="text-sm font-semibold text-amber-800">AABR (locked)</span>
              <span className="text-xs text-amber-600">NICU &gt; 5 days — OAE cannot rule out auditory neuropathy (§17.1)</span>
              <input type="hidden" {...register("modality")} value="AABR" />
            </div>
          ) : (
            <div className="flex gap-3">
              {(["OAE", "AABR"] as const).map((mod) => (
                <label key={mod} className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2.5 cursor-pointer transition-colors ${
                  watch("modality") === mod ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" value={mod} {...register("modality")} className="sr-only" />
                  <span className="text-sm font-medium">{mod}</span>
                </label>
              ))}
            </div>
          )}
          {errors.modality && <p className="text-red-500 text-xs mt-1">{errors.modality.message}</p>}
        </div>

        {/* Result — the key clinical outcome */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Result <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {(["PASS", "NOT_PASS", "INCOMPLETE"] as const).map((r) => (
              <label key={r} className={`flex-1 flex items-center justify-center border rounded-lg py-3 cursor-pointer font-medium text-sm transition-colors ${
                selectedResult === r
                  ? r === "PASS" ? "border-green-500 bg-green-50 text-green-700"
                  : r === "NOT_PASS" ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-500 bg-gray-50 text-gray-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}>
                <input type="radio" value={r} {...register("result")} className="sr-only" />
                {r === "PASS" ? "✓ PASS" : r === "NOT_PASS" ? "✗ NOT PASS" : "— INCOMPLETE"}
              </label>
            ))}
          </div>
          {errors.result && <p className="text-red-500 text-xs mt-1">{errors.result.message}</p>}
        </div>

        {/* Incomplete reason — required if INCOMPLETE */}
        {selectedResult === "INCOMPLETE" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for incomplete result <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register("incomplete_reason")}
              placeholder="e.g. Baby unsettled, ambient noise too high, probe fit poor"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {errors.incomplete_reason && <p className="text-red-500 text-xs mt-1">{errors.incomplete_reason.message}</p>}
          </div>
        )}

        {/* Equipment ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Equipment ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register("equipment_id")}
            placeholder="e.g. OAE-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {errors.equipment_id && <p className="text-red-500 text-xs mt-1">{errors.equipment_id.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Probe fit — OAE only */}
          {watch("modality") === "OAE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Probe Fit Quality
              </label>
              <select
                {...register("probe_fit_quality")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          )}

          {/* Ambient noise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ambient Noise Level <span className="text-red-500">*</span>
            </label>
            <select
              {...register("ambient_noise_level")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Attempts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Attempts <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              {...register("attempts", { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.5"
              min={0}
              {...register("duration_minutes", { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Screener ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Screener <span className="text-red-500">*</span>
          </label>
          {screeners.length > 0 ? (
            <select
              {...register("screener_id")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Select screener</option>
              {screeners.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              {...register("screener_id")}
              placeholder="Screener user ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          )}
          {errors.screener_id && <p className="text-red-500 text-xs mt-1">{errors.screener_id.message}</p>}
        </div>

        {/* Tested at — two fields for paper backup */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isPaperBackup ? "Actual Test Time (from paper form)" : "Time Test Was Performed"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register("tested_at")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {isPaperBackup && (
            <p className="text-xs text-amber-600 mt-1">
              Enter the time written on the paper backup form. System will record current time as
              &ldquo;recorded_at&rdquo; automatically.
            </p>
          )}
          {errors.tested_at && <p className="text-red-500 text-xs mt-1">{errors.tested_at.message}</p>}
        </div>

        {/* Paper backup confirmation checkbox */}
        {isPaperBackup && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <input
              type="checkbox"
              id="paper-confirm"
              required
              className="h-4 w-4 mt-0.5 rounded border-gray-300 text-amber-600"
            />
            <label htmlFor="paper-confirm" className="text-sm text-amber-800">
              I confirm I am entering this record from a paper backup form completed during system downtime.
              The &ldquo;tested at&rdquo; time above matches the handwritten time on that form.
            </label>
          </div>
        )}

        <div className="pt-4 border-t flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/children/${id}`)}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !!successMsg}
            className="flex-1 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Screening Result →"}
          </button>
        </div>
      </form>
    </div>
  );
}
