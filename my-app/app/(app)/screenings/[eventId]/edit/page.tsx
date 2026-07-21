// app/(app)/screenings/[eventId]/edit/page.tsx
//
// Clerk-only correction window (48h) for non-clinical-outcome fields.
// `result`, `ear`, `stage`, `modality` are NOT editable here — see
// app/api/v1/screenings/[...route]/route.ts for why. Use "Flag for
// Correction" for those.
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ScreeningEventDetail {
  id: string;
  ear: string;
  stage: string;
  modality: string;
  result: string;
  equipment_id: string | null;
  probe_fit_quality: string | null;
  ambient_noise_level: string;
  attempts: number;
  duration_minutes: number;
  incomplete_reason: string | null;
  clinicalComment: string | null;
  recorded_at: string;
  patient_id: string;
}

export default function EditScreeningPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<ScreeningEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [equipmentId, setEquipmentId] = useState("");
  const [probeFitQuality, setProbeFitQuality] = useState("");
  const [ambientNoiseLevel, setAmbientNoiseLevel] = useState("");
  const [attempts, setAttempts] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [clinicalComment, setClinicalComment] = useState("");

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
        const res = await fetch(`/api/v1/screenings/${eventId}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load screening event");
        }
        const data = await res.json();
        const ev: ScreeningEventDetail = data.screening ?? data;
        setEvent(ev);
        setEquipmentId(ev.equipment_id ?? "");
        setProbeFitQuality(ev.probe_fit_quality ?? "");
        setAmbientNoiseLevel(ev.ambient_noise_level ?? "");
        setAttempts(ev.attempts ?? 1);
        setDurationMinutes(String(ev.duration_minutes ?? ""));
        setClinicalComment(ev.clinicalComment ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/screenings/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          equipment_id: equipmentId,
          probe_fit_quality: probeFitQuality || null,
          ambient_noise_level: ambientNoiseLevel,
          attempts,
          duration_minutes: parseFloat(durationMinutes) || 0,
          clinicalComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        return;
      }
      setSuccess(true);
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

  if (error && !event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">{error}</p>
          {eventId && (
            <Link href={`/screenings/${eventId}/flag`} className="mt-3 block text-sm text-blue-600 hover:underline">
              Edit window may have expired — flag for correction instead →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8">
          <h2 className="text-lg font-semibold text-emerald-900">Changes Saved</h2>
          <button
            onClick={() => router.push(`/children/${event?.patient_id}`)}
            className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Back to child profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => router.push(`/children/${event?.patient_id}`)}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to child profile
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Edit Screening Result</h1>
        <p className="mt-1 text-sm text-gray-500">
          {event?.ear} ear — {event?.stage?.replace(/_/g, " ")} — result: {event?.result}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          The clinical outcome, ear, and stage can&apos;t be changed here — that could desync the
          pathway state.{" "}
          <Link href={`/screenings/${eventId}/flag`} className="text-blue-600 hover:underline">
            Wrong outcome? Flag for correction instead.
          </Link>
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Equipment ID</label>
            <input
              type="text"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {event?.modality === "OAE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Probe Fit Quality</label>
              <select
                value={probeFitQuality}
                onChange={(e) => setProbeFitQuality(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select...</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Ambient Noise</label>
            <select
              value={ambientNoiseLevel}
              onChange={(e) => setAmbientNoiseLevel(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Attempts</label>
            <input
              type="number"
              min="1"
              max="20"
              value={attempts}
              onChange={(e) => setAttempts(parseInt(e.target.value) || 1)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Screener&apos;s Clinical Comment</label>
          <textarea
            value={clinicalComment}
            onChange={(e) => setClinicalComment(e.target.value)}
            rows={2}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Save Changes"}
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
    </div>
  );
}
