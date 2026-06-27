'use client';
// components/layout/Breadcrumb.tsx
// §50.4 — shows path deeper than top level, last item not clickable

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string; // omit for current (last) page
}

interface BreadcrumbProps {
  crumbs: Crumb[];
}

export default function Breadcrumb({ crumbs }: BreadcrumbProps) {
  if (crumbs.length <= 1) return null; // top-level pages don't show breadcrumb

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-gray-400 shrink-0" />}
            {isLast || !crumb.href ? (
              <span
                className={isLast ? 'text-gray-800 font-medium' : 'text-gray-500'}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-teal-700 hover:text-teal-900 hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
