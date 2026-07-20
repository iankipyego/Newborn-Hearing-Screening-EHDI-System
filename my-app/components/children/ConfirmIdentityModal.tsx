"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConfirmIdentityModalProps {
  patient: {
    id: string;
    research_id: string | null;
    date_of_birth: string;
    mother_name: string | null;
    hospital_number: string | null;
  };
  onClose: () => void;
}

export function ConfirmIdentityModal({
  patient,
  onClose,
}: ConfirmIdentityModalProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const dobFormatted = new Date(patient.date_of_birth).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  function handleConfirm() {
    setLoading(true);
    router.push(`/children/${patient.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Confirm Identity
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          You are about to open this child&apos;s record. Please verify:
        </p>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Research ID</span>
              <span className="font-mono font-medium text-gray-900">
                {patient.research_id ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date of birth</span>
              <span className="font-medium text-gray-900">
                {dobFormatted}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Mother&apos;s name</span>
              <span className="font-medium text-gray-900">
                {patient.mother_name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hospital number</span>
              <span className="font-medium text-gray-900">
                {patient.hospital_number ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-gray-700">
          Is this correct?
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            No, search again
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Opening..." : "Yes, open record"}
          </button>
        </div>
      </div>
    </div>
  );
}