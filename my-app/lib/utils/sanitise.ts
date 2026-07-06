// lib/utils/sanitise.ts
// Strips HTML/script tags from free-text fields before DB write (§31).
// Called from Zod preprocessors for all free-text columns.
// Uses a simple regex approach — isomorphic-dompurify alternative if needed.

export function sanitiseText(input: string): string {
  // Remove HTML tags and script content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function sanitiseNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return sanitiseText(value);
}