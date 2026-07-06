// lib/search/fuzzyMatch.ts
// Fuse.js wrapper for child name search (§47.3).
// ZERO database calls — receives an array, returns ranked results.
// AI-callable: this function has no DB or network dependency by design (§53.2).

import Fuse from "fuse.js";

export interface PatientSearchRecord {
  id: string;
  research_id: string;
  hospital_number: string | null;
  mother_name: string;
  mother_phone: string;
  date_of_birth: string; // ISO string
  sex: string;
  pathway_status: string;
}

export interface FuzzyMatchResult {
  item: PatientSearchRecord;
  score: number; // 0 = perfect match, 1 = no match
}

/**
 * Rank a pre-fetched list of patients against a search string.
 * Handles transpositions, typos, and spelling variants common with
 * Kenyan names transcribed across languages (§47.3).
 *
 * @param records - Full list fetched from DB by the caller
 * @param query   - Free-text search string from the UI
 * @returns Ranked array, best match first
 */
export function fuzzyMatch(
  records: PatientSearchRecord[],
  query: string
): FuzzyMatchResult[] {
  if (!query.trim()) return records.map((item) => ({ item, score: 0 }));

  const fuse = new Fuse(records, {
    // §47.3: threshold 0.4 per spec
    threshold: 0.4,
    includeScore: true,
    keys: [
      { name: "mother_name", weight: 2 }, // primary key for name search
    ],
    // Minimum character match — avoids noisy single-char matches
    minMatchCharLength: 2,
    // Distance controls how far apart matched characters can be
    distance: 100,
  });

  const results = fuse.search(query);
  return results.map((r) => ({
    item: r.item,
    score: r.score ?? 1,
  }));
}

/**
 * Exact-match search for research_id, hospital_number, phone, or DOB.
 * Returns all records that match on any exact field.
 * Called before fuzzy name search — exact matches are always shown first.
 */
export function exactMatch(
  records: PatientSearchRecord[],
  query: string
): PatientSearchRecord[] {
  const q = query.trim().toLowerCase();

  // research_id: MRH-YYYY-NNNNN format
  if (/^mrh-/i.test(q)) {
    return records.filter((r) => r.research_id.toLowerCase() === q);
  }

  // Date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    return records.filter((r) => r.date_of_birth.startsWith(q));
  }

  // Phone: starts with 07, 01, +254, or is all digits ≥ 7 chars
  if (/^(07|01|\+254|\d{7,})/.test(q)) {
    const normalized = q.replace(/\D/g, "");
    return records.filter(
      (r) =>
        r.mother_phone.replace(/\D/g, "").includes(normalized)
    );
  }

  // Hospital number: pure numeric
  if (/^\d+$/.test(q)) {
    return records.filter((r) => r.hospital_number === q);
  }

  return [];
}