'use client';

// components/children/PatientIdentityBar.tsx
// SAFER patient-identification block (Rule 4): name + date of birth/age + a
// stable ID (research ID, with hospital number as a second identifier when
// on file) shown together in one block, near the top of every screen that
// reads or writes to a specific child's record — never just one identifier
// alone.

interface PatientIdentitySummary {
  id: string;
  research_id: string;
  hospital_number?: string | null;
  child_name?: string | null;
  date_of_birth: string;
  mother_name?: string | null;
}

function formatAge(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const days = Math.floor((now.getTime() - dob.getTime()) / 86_400_000);
  if (days < 0) return '';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} old`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} old`;
}

export function PatientIdentityBar({
  patient,
  className = '',
}: {
  patient: PatientIdentitySummary;
  className?: string;
}) {
  const dobFormatted = new Date(patient.date_of_birth).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const age = formatAge(patient.date_of_birth);

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-base font-semibold text-gray-900 dark:text-fg">
          {patient.child_name ?? (
            <span className="text-sm font-normal italic text-amber-600 dark:text-amber-400">
              Name not yet provided
            </span>
          )}
        </span>
        <span className="font-mono text-sm font-medium text-teal-700 dark:text-accent-light">
          {patient.research_id}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-fg-muted">
        <span>
          DOB:{' '}
          <span className="font-medium text-gray-700 dark:text-fg">
            {dobFormatted}
          </span>
          {age && <span className="text-gray-400 dark:text-fg-muted"> ({age})</span>}
        </span>
        {patient.hospital_number && (
          <span>
            Hosp #:{' '}
            <span className="font-medium text-gray-700 dark:text-fg">
              {patient.hospital_number}
            </span>
          </span>
        )}
        {patient.mother_name && (
          <span>
            Mother:{' '}
            <span className="font-medium text-gray-700 dark:text-fg">
              {patient.mother_name}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
