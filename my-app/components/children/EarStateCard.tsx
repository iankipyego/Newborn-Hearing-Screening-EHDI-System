'use client';

import Link from 'next/link';
import {
  type EarStateValue,
  type Ear,
  getEarStateLabel,
  getExpectedStage,
  isEarResolved,
} from '@/lib/pathway';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface EarStateCardProps {
  ear: Ear;
  state: EarStateValue;
  modality: string;
  patientId: string;
  /** Whether a visual inspection has been recorded for this ear (§2.1). */
  hasVisualInspection: boolean;
}

const EAR_ICONS = {
  LEFT: (
    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
    </svg>
  ),
  RIGHT: (
    <svg className="h-8 w-8 text-gray-400 scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
    </svg>
  ),
};

export function EarStateCard({ ear, state, modality, patientId, hasVisualInspection }: EarStateCardProps) {
  const resolved = isEarResolved(state);
  const expectedStage = getExpectedStage(state);
  // Screen 1 cannot be recorded until the pre-OAE visual inspection (§2.1)
  // has been done — guardVisualInspection/guardScreening enforce this
  // server-side too; this just keeps the button honest.
  const needsVisualInspectionFirst =
    state === 'NOT_STARTED' && !hasVisualInspection;
  const canAddScreening = expectedStage !== null && !needsVisualInspectionFirst;

  return (
    <div
      className={`rounded-lg border-2 p-5 ${
        resolved
          ? 'border-emerald-200 bg-emerald-50/30'
          : state === 'NOT_STARTED'
            ? 'border-gray-200 bg-white'
            : 'border-amber-200 bg-amber-50/30'
      }`}
    >
      {/* Header: Ear label + icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {EAR_ICONS[ear]}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {ear === 'LEFT' ? 'Left Ear' : 'Right Ear'}
            </h3>
            <p className="text-xs text-gray-500">
              Modality:{' '}
              <span className="font-semibold text-gray-700">{modality}</span>
              {modality === 'AABR' && (
                <span className="ml-1 text-xs text-amber-700">(NICU &gt;5 days — locked)</span>
              )}
            </p>
          </div>
        </div>
        <StatusBadge label={getEarStateLabel(state)} earState={state} />
      </div>

      {/* Next action */}
      <div className="mt-4">
        {resolved ? (
          <p className="text-sm text-emerald-700 font-medium">
            ✓ Ear resolved — no further action needed
          </p>
        ) : needsVisualInspectionFirst ? (
          <Link
            href={`/children/${patientId}/visual-inspection/new?ear=${ear}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Record Visual Inspection
          </Link>
        ) : canAddScreening ? (
          <Link
            href={`/children/${patientId}/screenings/new?ear=${ear}&stage=${expectedStage}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add {expectedStage === 'SCREEN_1' ? 'Screen 1' : expectedStage === 'SCREEN_2' ? 'Screen 2' : 'Rescreen'} Result
          </Link>
        ) : (
          <p className="text-sm text-gray-500">
            {state === 'RESCREEN_FAILED'
              ? 'Awaiting diagnostic evaluation'
              : state === 'SCREEN_2_FAILED'
                ? 'Awaiting HCP referral resolution'
                : state === 'PENDING_MEDICAL_CLEARANCE_PRESCREEN'
                  ? 'Visual inspection flagged this ear — awaiting HCP referral resolution before screening can begin'
                  : state === 'PENDING_LTFU'
                    ? 'Pending LTFU review by supervisor'
                    : state === 'LOST_TO_FOLLOWUP'
                      ? 'Case closed — lost to follow-up'
                      : state === 'DIAGNOSED'
                        ? 'Diagnostic evaluation complete'
                        : 'No action available in current state'}
          </p>
        )}
      </div>
    </div>
  );
}