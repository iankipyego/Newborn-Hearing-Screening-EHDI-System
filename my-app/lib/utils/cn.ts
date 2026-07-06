import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind classes with conditional logic
 * Used by all UI components for className composition
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}