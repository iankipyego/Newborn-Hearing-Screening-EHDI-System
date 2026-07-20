// app/(app)/children/[id]/screenings/new/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getExpectedStage,
  getEarStateLabel,
  getModality,
  type EarStateValue,
  type Ear,
  type ScreeningStage,
} from "@/lib/pathway";

interface EarPathwayState {
  ear: "LEFT" | "RIGHT";
  state: string;
  modality: string;
}

interface PatientContext {
  id: string;
  research_id: string | null;
  date_of_birth: string;
  sex: string;
  mother_name: string | null;
  nicu_days: number | null;
  ear_pathway_states: EarPathwayState[];
}

interface Screener {
  id: string;
  name: string;
}

const STAGE_LABELS: Record<ScreeningStage, string> = {
  SCREEN_1: "Screen 1",
  SCREEN_2: "Screen 2",
  RESCREEN_POST_REFERRAL: "Rescreen",
};

export default function NewScreeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<PatientContext | null>(null);
  const [screeners, setScreeners] = useState<Screener[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    results: any[];
    summary: string;
  } | null>(null);

  // Form state
  const [ear, setEar] = useState<Ear | "BOTH">("LEFT");
  const [stage, setStage] = useState<ScreeningStage>("SCREEN_1");
  const [modality, setModality] = useState<string>("OAE");
  const [screenerId, setScreenerId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [probeFitQuality, setProbeFitQuality] = useState("");
  const [ambientNoiseLevel, setAmbientNoiseLevel] = useState("MEDIUM");
  const [attempts, setAttempts] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [result, setResult] = useState<"PASS" | "NOT_PASS" | "INCOMPLETE" | "">("");
  const [incompleteReason, setIncompleteReason] = useState("");
  const [clinicalComment, setClinicalComment] = useState("");
  const [testedAt, setTestedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // ── Load patient + screeners ──
  useEffect(() => {
    async function load() {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("access_token="))
          ?.split("=")[1];

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [patientRes, screenersRes] = await Promise.all([
          fetch(`/api/v1/patients/${id}`, {
            headers,
            cache: "no-store",
          }),
          fetch("/api/v1/users?role=SCREENER", {
            headers,
            cache: "no-store",
          }),
        ]);

        if (!patientRes.ok) {
          const body = await patientRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load patient");
        }

        const patientData = await patientRes.json();
        const p: PatientContext = patientData.patient ?? patientData;
        setPatient(p);

        // Set modality from pathway engine (locked)
        const lockedModality = getModality(p.nicu_days);
        setModality(lockedModality);

        // Set ear/stage from URL params if present
        const urlParams = new URLSearchParams(window.location.search);
        const earParam = urlParams.get("ear") as Ear | "BOTH" | null;
        const stageParam = urlParams.get("stage") as ScreeningStage | null;

        if (earParam && ["LEFT", "RIGHT", "BOTH"].includes(earParam)) {
          setEar(earParam);
        }
        if (
          stageParam &&
          ["SCREEN_1", "SCREEN_2", "RESCREEN_POST_REFERRAL"].includes(
            stageParam
          )
        ) {
          setStage(stageParam);
        }

        // If no stage from URL, infer from ear state
        if (!stageParam) {
          const targetEar = earParam === "RIGHT" ? "RIGHT" : "LEFT";
          const earState = p.ear_pathway_states?.find(
            (e) => e.ear === targetEar
          );
          const currentState = (earState?.state as EarStateValue) ?? "NOT_STARTED";
          const expected = getExpectedStage(currentState);
          if (expected) setStage(expected);
        }

        // Screeners
        if (screenersRes.ok) {
          const screenersData = await screenersRes.json();
          setScreeners(screenersData.users ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── When ear changes, auto-set stage ──
  function handleEarChange(newEar: Ear | "BOTH") {
    setEar(newEar);
    if (patient && newEar !== "BOTH") {
      const earState = patient.ear_pathway_states?.find(
        (e) => e.ear === newEar
      );
      const currentState = (earState?.state as EarStateValue) ?? "NOT_STARTED";
      const expected = getExpectedStage(currentState);
      if (expected) setStage(expected);
    }
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !screenerId) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("access_token="))
        ?.split("=")[1];

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/children/${id}/screenings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ear,
          stage,
          modality,
          equipment_id: equipmentId || null,
          probe_fit_quality:
            modality === "OAE" ? probeFitQuality || null : null,
          ambient_noise_level: ambientNoiseLevel,
          attempts,
          duration_minutes: parseFloat(durationMinutes) || 0,
          result,
          incomplete_reason:
            result === "INCOMPLETE" ? incompleteReason : null,
          clinical_comment: clinicalComment || null,
          tested_at: new Date(testedAt).toISOString(),
          screener_id: screenerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle per-ear errors
        if (data.results) {
          const errorMessages = data.results
            .filter((r: any) => !r.success)
            .map((r: any) => r.error)
            .join(". ");
          setError(errorMessages || data.error || "Failed to save");
        } else {
          setError(data.error ?? "Failed to save screening result");
        }
        return;
      }

      setSuccess(data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.push(`/children/${id}`)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to child profile
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-7 w-7 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-emerald-900">
            Result Saved
          </h2>
          <p className="mt-2 text-sm text-emerald-700">{success.summary}</p>

          {success.results?.map((r: any, i: number) => (
            <p key={i} className="mt-1 text-xs text-emerald-600">
              {r.ear} ear → {r.newState?.replace(/_/g, " ")}
            </p>
          ))}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => router.push(`/children/${id}`)}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Back to child profile
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setResult("");
                setClinicalComment("");
                setIncompleteReason("");
              }}
              className="rounded-lg border border-emerald-300 px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Add another result
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAABR = modality === "AABR";
  const selectedEarState = patient?.ear_pathway_states?.find(
    (e) => e.ear === (ear === "BOTH" ? "LEFT" : ear)
  );
  const currentStateLabel = selectedEarState
    ? getEarStateLabel(selectedEarState.state as EarStateValue)
    : "Not Started";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back link */}
      <button
        onClick={() => router.push(`/children/${id}`)}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
        Back to {patient?.research_id ?? "child profile"}
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Add Screening Result
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {patient?.mother_name ?? "Unknown"} — {patient?.research_id ?? "Draft"}
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Ear selector ── */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Ear</legend>
          <p className="mt-0.5 text-xs text-gray-400">
            Current state: {currentStateLabel}
          </p>
          <div className="mt-2 flex gap-3">
            {(["LEFT", "RIGHT", "BOTH"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handleEarChange(e)}
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                  ear === e
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {e === "BOTH" ? "Both Ears" : e === "LEFT" ? "← Left" : "Right →"}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Stage (auto-suggested, editable) ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Stage</label>
          <p className="mt-0.5 text-xs text-gray-400">
            Auto-suggested from pathway state — verify before saving
          </p>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as ScreeningStage)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="SCREEN_1">Screen 1</option>
            <option value="SCREEN_2">Screen 2</option>
            <option value="RESCREEN_POST_REFERRAL">
              Rescreen (post-referral)
            </option>
          </select>
        </div>

        {/* ── Modality (LOCKED) ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Modality
          </label>
          <div
            className={`mt-1.5 flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold ${
              isAABR
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            {modality}
            {isAABR && (
              <span className="text-xs font-normal text-amber-600">
                — locked (NICU {patient?.nicu_days ?? 0} days)
              </span>
            )}
          </div>
        </div>

        {/* ── Screener ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Screener <span className="text-red-500">*</span>
          </label>
          <select
            value={screenerId}
            onChange={(e) => setScreenerId(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select screener...</option>
            {screeners.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── Test details grid ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Equipment ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Equipment ID
            </label>
            <input
              type="text"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder="e.g. OAE-001"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Probe fit quality (OAE only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Probe Fit Quality
              {isAABR && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (OAE only)
                </span>
              )}
            </label>
            <select
              value={probeFitQuality}
              onChange={(e) => setProbeFitQuality(e.target.value)}
              disabled={isAABR}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select...</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </div>

          {/* Ambient noise */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ambient Noise
            </label>
            <div className="mt-1.5 flex gap-2">
              {["LOW", "MEDIUM", "HIGH"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setAmbientNoiseLevel(level)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    ambientNoiseLevel === level
                      ? level === "LOW"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : level === "HIGH"
                          ? "border-red-400 bg-red-50 text-red-700"
                          : "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Attempts */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Attempts
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={attempts}
              onChange={(e) => setAttempts(parseInt(e.target.value) || 1)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="e.g. 5.5"
              required
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Tested at */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tested at
            </label>
            <input
              type="datetime-local"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
              required
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* ── RESULT — the key clinical outcome ── */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Result</legend>
          <p className="mt-0.5 text-xs text-gray-400">
            Reported by screener — this is the clinical outcome
          </p>
          <div className="mt-2 flex gap-3">
            {(["PASS", "NOT_PASS", "INCOMPLETE"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(r)}
                className={`flex-1 rounded-lg border-2 py-4 text-sm font-bold transition-colors ${
                  result === r
                    ? r === "PASS"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : r === "NOT_PASS"
                        ? "border-red-500 bg-red-50 text-red-800"
                        : "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                {r === "PASS"
                  ? "✓ PASS"
                  : r === "NOT_PASS"
                    ? "✗ NOT PASS"
                    : "◐ INCOMPLETE"}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Incomplete reason (conditional) ── */}
        {result === "INCOMPLETE" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Incomplete Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              placeholder="e.g. Baby unsettled, equipment malfunction"
              required
              className="mt-1.5 block w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        )}

        {/* ── Clinical comment ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Screener&apos;s Clinical Comment
            <span className="ml-1 text-xs font-normal text-gray-400">
              (optional — not exported as coded variable)
            </span>
          </label>
          <textarea
            value={clinicalComment}
            onChange={(e) => setClinicalComment(e.target.value)}
            rows={2}
            placeholder='e.g. "Baby was unsettled, may need to retest"'
            className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!result || submitting || !screenerId}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving..." : `Save ${STAGE_LABELS[stage]} Result`}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/children/${id}`)}
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}