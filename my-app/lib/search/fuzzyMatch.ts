import Fuse from "fuse.js";

export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

export interface PatientSearchRecord {
  id: string;
  research_id: string | null;
  date_of_birth: Date;
  sex: string;
  child_name: string | null;              // NEW: direct identifier, decrypted before search
  mother_name: string | null;
  hospital_number: string | null;
  pathway_milestone: { final_status: string } | null;
}

export type SearchRouteType =
  | "RESEARCH_ID"
  | "HOSPITAL_NUMBER"
  | "PHONE"
  | "NAME"
  | "DATE_OF_BIRTH"
  | "LIST_ALL"
  | "UNKNOWN";

export interface SearchRoute {
  type: SearchRouteType;
  value: string;
}

export function exactMatch<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T,
  value: string
): T[] {
  return items.filter((item) => String(item[field] ?? "") === value);
}

export function fuzzyMatch<T extends Record<string, unknown>>(
  query: string,
  items: T[],
  options?: {
    keys?: string[];
    threshold?: number;
  }
): FuzzyMatchResult<T>[] {
  const { keys = ["name"], threshold = 0.4 } = options ?? {};
  const fuse = new Fuse(items, { keys, threshold, includeScore: true });
  return fuse.search(query).map((r) => ({ item: r.item, score: r.score ?? 1 }));
}

export function routeSearchQuery(raw: string): SearchRoute {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "UNKNOWN", value: "" };

  if (trimmed === "*") return { type: "LIST_ALL", value: "" };

  if (/^MRH-\d{4}-\d{4,5}$/i.test(trimmed)) {
    return { type: "RESEARCH_ID", value: trimmed.toUpperCase() };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { type: "DATE_OF_BIRTH", value: trimmed };
  }

  const digitsOnly = trimmed.replace(/[\s\-]/g, "");
  if (/^0\d{9,10}$/.test(digitsOnly)) {
    return { type: "PHONE", value: digitsOnly };
  }

  if (/^\d+$/.test(trimmed)) {
    return { type: "HOSPITAL_NUMBER", value: trimmed };
  }

  return { type: "NAME", value: trimmed };
}