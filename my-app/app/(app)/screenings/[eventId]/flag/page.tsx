// app/(app)/screenings/[eventId]/flag/page.tsx
"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";

export default function FlagScreeningPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function authHeaders(): Record<string, string> {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("access_token="))
      ?.split("=")[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please describe what's wrong (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/screenings/${eventId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit flag");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8">
          <h2 className="text-lg font-semibold text-emerald-900">Flag Submitted</h2>
          <p className="mt-2 text-sm text-emerald-700">
            A supervisor will review this and action a correction if needed. The original record
            is unchanged.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button onClick={() => router.back()} className="mb-6 text-sm text-gray-500 hover:text-gray-700">
        ← Back
      </button>

      <h1 className="text-xl font-bold text-gray-900">Flag for Correction</h1>
      <p className="mt-1 text-sm text-gray-500">
        This does not edit the record. It creates a request for the Data Clerk / Supervisor to
        review and correct.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            What's wrong with this record? <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
            placeholder='e.g. "Clerk recorded left ear but I tested right ear"'
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit Flag"}
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
