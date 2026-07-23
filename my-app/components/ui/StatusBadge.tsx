'use client';

import type { PatientPathwayStatus, EarStateValue } from '@/lib/pathway';

type BadgeVariant = 'green' | 'blue' | 'amber' | 'purple' | 'red' | 'gray';

const patientStatusColors: Record<PatientPathwayStatus, BadgeVariant> = {
  PASSED: 'green',
  IN_PROGRESS: 'blue',
  REFERRED_AUDIOLOGY: 'amber',
  DIAGNOSED: 'purple',
  LOST_TO_FOLLOWUP: 'red',
};

const earStateColors: Record<EarStateValue, BadgeVariant> = {
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
  green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/40',
  gray: 'bg-gray-50 dark:bg-surface-hover text-gray-600 dark:text-fg-muted border-gray-200 dark:border-surface-border',
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
  patientStatus?: PatientPathwayStatus;
  earState?: EarStateValue;
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
    variant ??
    (patientStatus
      ? patientStatusColors[patientStatus]
      : earState
        ? earStateColors[earState]
        : 'gray');

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