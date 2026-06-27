// lib/auth/lockout.ts
// Brute-force protection per §12.1:
//   Lock after 5 failed attempts, exponential backoff on locked_until.
//   Reset counter + clear lock on successful full login.

import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;

function lockoutMinutes(failCount: number): number {
  if (failCount <= 5) return 5;
  if (failCount === 6) return 15;
  if (failCount === 7) return 30;
  return 60;
}

export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failed_login_count: true },
  });
  if (!user) return;

  const newCount   = user.failed_login_count + 1;
  const lockedUntil =
    newCount >= MAX_ATTEMPTS
      ? new Date(Date.now() + lockoutMinutes(newCount) * 60 * 1000)
      : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: { failed_login_count: newCount, ...(lockedUntil ? { locked_until: lockedUntil } : {}) },
  });
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failed_login_count: 0, locked_until: null, last_login_at: new Date() },
  });
}

/** Returns a human-readable message if locked, null if not */
export function getLockoutMessage(lockedUntil: Date | null): string | null {
  if (!lockedUntil || lockedUntil <= new Date()) return null;
  const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
  return `Account temporarily locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
