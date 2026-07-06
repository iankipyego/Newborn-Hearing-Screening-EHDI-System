"use client";
// app/(app)/corrections/page.tsx
// Correction requests queue — §11.2, §20.3, §46.3
// Clerk sees own requests. Screener sees own flags. Supervisor/Admin see all.

import { useEffect, useState } from "react";
import Link from "next/link";

interface CorrectionRequest {
  id: string;
  requested_at: string;
  table_name: string;
  record_id: string;
  reason: string;
  proposed_value: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewer_note: string | null;
  reviewed_at: string | null;
  requester: { name: string; role: string };
  reviewer: { name: string } | null;
}

const STATUS_COLORS = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function Page() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<CorrectionRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/corrections").then((r) => r.json()),
      fetch("/api/v1/auth/me").then((r) => r.json()).catch(() => ({})),
    ]).then(([c, me]) => {
      setRequests(c.data ?? []);
      setUserRole(me.role ?? "");
      setLoading(false);
    });
  }, []);

  async function handleReview(decision: "APPROVED" | "REJECTED") {
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      await fetch(`/api/v1/corrections/${reviewTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewer_note: reviewNote }),
      });
      setRequests((prev) =>
        prev.map((r) => r.id === reviewTarget.id ? { ...r, status: decision, reviewer_note: reviewNote } : r)
      );
      setReviewTarget(null);
      setReviewNote("");
    } finally {
      setSubmittingReview(false);
    }
  }

  const isSupervisor = ["SUPERVISOR", "ADMIN"].includes(userRole);
  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Correction Requests</h1>
          {pending.length > 0 && (
            <p className="text-sm text-amber-600 mt-1 font-medium">{pending.length} pending review</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No correction requests yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((req) => (
                  <div key={req.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {req.table_name}
                          </span>
                          <span className="text-xs text-gray-400">#{req.record_id.slice(0, 8)}</span>
                          <span className="text-xs text-gray-400">
                            by {req.requester.name} · {new Date(req.requested_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{req.reason}</p>
                        {Object.keys(req.proposed_value).length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Proposed: {JSON.stringify(req.proposed_value)}
                          </p>
                        )}
                      </div>
                      {isSupervisor && (
                        <button
                          onClick={() => { setReviewTarget(req); setReviewNote(""); }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Resolved ({resolved.length})
              </h2>
              <div className="space-y-2">
                {resolved.map((req) => (
                  <div key={req.id} className="border border-gray-100 bg-white rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[req.status]}`}>
                            {req.status}
                          </span>
                          <span className="text-xs text-gray-400">{req.table_name}</span>
                          <span className="text-xs text-gray-400">by {req.requester.name}</span>
                        </div>
                        <p className="text-sm text-gray-700">{req.reason}</p>
                        {req.reviewer_note && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            Reviewer: &ldquo;{req.reviewer_note}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Review Correction Request</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-2">
              <p><span className="text-gray-500">Table:</span> {reviewTarget.table_name}</p>
              <p><span className="text-gray-500">Reason:</span> {reviewTarget.reason}</p>
              {Object.keys(reviewTarget.proposed_value).length > 0 && (
                <p><span className="text-gray-500">Proposed:</span> {JSON.stringify(reviewTarget.proposed_value)}</p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer note (optional)</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Explain the decision…"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setReviewTarget(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview("REJECTED")}
                disabled={submittingReview}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleReview("APPROVED")}
                disabled={submittingReview}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
