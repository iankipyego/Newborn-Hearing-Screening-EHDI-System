// lib/utils/researchId.ts
// Generates research IDs in the format MRH-YYYY-NNNNN (§4.1).
// Padded to 5 digits — supports up to 99,999 patients per year per site.
// Called only from the patients POST route inside a transaction so the
// sequence query and insert are atomic (no gap in numbering on rollback).

import { prisma } from "@/lib/prisma";

/**
 * Generate the next research_id for the current calendar year.
 * Counts existing patients whose research_id starts with MRH-{year}-
 * and increments by 1. Safe inside a Prisma transaction.
 *
 * Example: MRH-2026-00001, MRH-2026-00002, …
 */
export async function generateResearchId(
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MRH-${year}-`;

  const db = tx ?? prisma;

  const count = await db.patient.count({
    where: {
      research_id: { startsWith: prefix },
    },
  });

  const next = count + 1;
  const padded = String(next).padStart(5, "0");
  return `${prefix}${padded}`;
}