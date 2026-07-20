'use client';

import type { PatientFinalStatus, EarState } from '@/lib/pathway';

type BadgeVariant = 'green' | 'blue' | 'amber' | 'purple' | 'red' | 'gray';

const patientStatusColors: Record<PatientFinalStatus, BadgeVariant> = {
  PASSED: 'green',
  IN_PROGRESS: 'blue',
  REFERRED_AUDIOLOGY: 'amber',
  DIAGNOSED: 'purple',
  LOST_TO_FOLLOWUP: 'red',
};

const earStateColors: Record<EarState, BadgeVariant> = {
  NOT_STARTED: 'gray',
  SCREEN_1_PASSED: 'green',
  SCREEN_1_FAILED: 'amber',
  SCREEN_2_PASSED: 'green',
  SCREEN_2_FAILED: 'amber',
  CLEARED_FOR_RESCREEN: 'blue',
  RESCREEN_PASSED: 'green',
  RESCREEN_FAILED: 'purple',
  DIAGNOSED: 'purple',
  PENDING_LTFU: 'red',
  LOST_TO_FOLLOWUP: 'red',
};

const bgColors: Record<BadgeVariant, string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  gray: 'bg-gray-50 text-gray-600 border-gray-200',
};

const dotColors: Record<BadgeVariant, string> = {
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  patientStatus?: PatientFinalStatus;
  earState?: EarState;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  label,
  variant,
  patientStatus,
  earState,
  size = 'sm',
}: StatusBadgeProps) {
  const resolvedVariant: BadgeVariant =
    variant ?? patientStatus
      ? patientStatusColors[patientStatus]
      : earState
        ? earStateColors[earState]
        : 'gray';

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${bgColors[resolvedVariant]} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[resolvedVariant]}`} />
      {label}
    </span>
  );
}