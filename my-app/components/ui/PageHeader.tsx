// components/ui/PageHeader.tsx
//
// Standard header for every inner page: title, optional description, and at
// most ONE primary action. This exists specifically to stop pages from
// growing two competing "primary-looking" buttons side by side — if a
// screen genuinely needs a second action, pass it as `secondaryAction` and
// it will always render visually subordinate (Button `variant="secondary"`
// or `"ghost"`), never as a second primary button.

import type { ReactNode } from 'react';

interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** The single primary action for this screen, rendered with Button variant="primary". */
  primaryAction?: PageHeaderAction;
  /** Optional secondary action, rendered visually subordinate — never primary. */
  secondaryAction?: PageHeaderAction;
  /** Optional breadcrumb or back-link content, rendered above the title. */
  eyebrow?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  primaryAction,
  secondaryAction,
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-xl font-bold text-gray-900 dark:text-fg truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-fg-muted">{description}</p>
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex shrink-0 items-center gap-2">
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
          {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
        </div>
      )}
    </div>
  );
}

// Renders as a Link if `href` is given, otherwise a button with `onClick`.
// Kept inline (rather than importing next/link at the top level) so this
// component has no hard Next.js router dependency for the onClick-only case.
function ActionButton({
  action,
  variant,
}: {
  action: PageHeaderAction;
  variant: 'primary' | 'secondary';
}) {
  const classes =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-light shadow-sm shadow-accent/20'
      : 'border border-gray-300 dark:border-surface-border text-gray-700 dark:text-fg bg-white dark:bg-surface-card hover:bg-gray-50 dark:hover:bg-surface-hover';

  const sharedClasses = `inline-flex items-center gap-2 h-11 px-4 rounded-lg text-sm font-medium
    transition-colors duration-150 whitespace-nowrap
    focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
    ${classes}`;

  if (action.href) {
    return (
      <a href={action.href} className={sharedClasses}>
        {action.icon}
        {action.label}
      </a>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={sharedClasses}>
      {action.icon}
      {action.label}
    </button>
  );
}