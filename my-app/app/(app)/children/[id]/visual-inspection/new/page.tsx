// app/(app)/children/[id]/visual-inspection/new/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import type { Ear } from "@/lib/pathway";

interface Screener {
  id: string;
  name: string;
}

type Outcome = "PASS" | "MINOR_ANOMALY" | "PE_TUBE" | "REFER_MEDICAL";

const OUTCOME_OPTIONS: Array<{
  value: Outcome;
  label: string;
  helper: string;
}> = [
  {
    value: "PASS",
    label: "Passes visual inspection",
    helper: "Document and proceed with the OAE screening.",
  },
  {
    value: "MINOR_ANOMALY",
    label: "Pits, skin tags, or other minimal malformation",
    helper: "Does not affect the ear canal opening — proceed with OAE screening.",
  },
  {
    value: "PE_TUBE",
    label: "PE tube present",
    helper: "Adjust screening equipment if your model requires it, then proceed with OAE.",
  },
  {
    value: "REFER_MEDICAL",
    label: "Blockage, signs of infection, or a significant malformation",
    helper:
      "Refer to medical follow-up. OAE screening is blocked until medical clearance is recorded on the referral.",
  },
];

function authHeaders(): Record<string, string> {
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="))
    ?.split("=")[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function NewVisualInspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [screeners, setScreeners] = useState<Screener[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [ear, setEar] = useState<Ear | "BOTH">("LEFT");
  const [outcome, setOutcome] = useState<Outcome>("PASS");
  const [findingNote, setFindingNote] = useState("");
  const [screenerId, setScreenerId] = useState("");
  const [inspectedAt, setInspectedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const earParam = urlParams.get("ear") as Ear | "BOTH" | null;
    if (earParam && ["LEFT", "RIGHT", "BOTH"].includes(earParam)) {
      setEar(earParam);
    }

    async function loadScreeners() {
      try {
        const res = await fetch("/api/v1/users?role=SCREENER", {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setScreeners(data.users ?? []);
        }
      } catch {
        // Non-fatal — screener select just stays empty.
      } finally {
        setLoading(false);
      }
    }
    loadScreeners();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenerId) return;
    if (outcome === "REFER_MEDICAL" && !findingNote.trim()) {
      setError("A finding note is required when referring for medical follow-up.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/children/${id}/visual-inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ear,
          outcome,
          finding_note: findingNote || null,
          screener_id: screenerId,
          inspected_at: new Date(inspectedAt).toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const messages = (data.results ?? [])
          .filter((r: any) => !r.success)
          .map((r: any) => r.error)
          .join(". ");
        setError(messages || data.error || "Failed to save visual inspection");
        return;
      }

      const blocksScreening = outcome === "REFER_MEDICAL";

      setSuccess(
        blocksScreening
          ? "Visual inspection saved. This ear is now awaiting medical clearance — an HCP referral was created automatically."
          : "Visual inspection saved. Taking you to the OAE Screen 1 form…"
      );

      const destination = blocksScreening
        ? `/children/${id}`
        : `/children/${id}/screenings/new?ear=${ear}&stage=SCREEN_1`;
      setTimeout(() => router.push(destination), blocksScreening ? 1500 : 900);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-lg font-semibold text-gray-900">
        Visual Inspection &amp; Case History
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Required before the first OAE screening (ECHO protocol, §2.1). Each
        ear is assessed independently.
      </p>

      {success ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
          {success}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Ear</label>
            <div className="mt-2 flex gap-2">
              {(["LEFT", "RIGHT", "BOTH"] as const).map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setEar(opt)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    ear === opt
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt === "BOTH" ? "Both ears" : opt.charAt(0) + opt.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Finding</label>
            <div className="mt-2 space-y-2">
              {OUTCOME_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    outcome === opt.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    className="mt-1"
                    checked={outcome === opt.value}
                    onChange={() => setOutcome(opt.value)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-gray-500">{opt.helper}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Finding note{" "}
              {outcome === "REFER_MEDICAL" && (
                <span className="text-red-600">(required)</span>
              )}
            </label>
            <textarea
              value={findingNote}
              onChange={(e) => setFindingNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. wax occlusion, PE tube left ear, pit above tragus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Screener</label>
            <select
              value={screenerId}
              onChange={(e) => setScreenerId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select screener…</option>
              {screeners.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Inspected at</label>
            <input
              type="datetime-local"
              value={inspectedAt}
              onChange={(e) => setInspectedAt(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !screenerId}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Visual Inspection"}
          </button>
        </form>
      )}
    </div>
  );
}
