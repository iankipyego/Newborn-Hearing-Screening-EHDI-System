// app/api/v1/children/search/route.ts
// Replace the entire file with this:

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fuzzyMatch } from '@/lib/search/fuzzyMatch';
import { decrypt, decryptNullable } from '@/lib/utils/encryption';

const prisma = new PrismaClient();

const SELECT_FIELDS = {
  id: true,
  research_id: true,
  date_of_birth: true,
  sex: true,
  mother_name: true,
  hospital_number: true,
  pathway_milestone: { select: { final_status: true } },
};

const PHONE_SELECT_FIELDS = {
  ...SELECT_FIELDS,
  mother_phone: true,
  guardian_phone_alt: true,
  whatsapp_number: true,
};

/**
 * Safe decrypt — handles both encrypted (iv:authTag:cipher) and
 * plaintext values (seeded data). Your decrypt() throws on plaintext,
 * so we catch and return the raw value instead of crashing the query.
 */
function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    // Not encrypted (seeded data) or corrupt — return as-is
    return value;
  }
}

function safeDecryptNullable(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptNullable(value);
  } catch {
    return value;
  }
}

function decryptRow(r: any) {
  return {
    id: r.id,
    research_id: r.research_id,
    date_of_birth: r.date_of_birth instanceof Date ? r.date_of_birth.toISOString() : r.date_of_birth,
    sex: r.sex,
    child_name: null,
    mother_name: safeDecrypt(r.mother_name),
    hospital_number: r.hospital_number,
    pathway_status: r.pathway_milestone?.final_status ?? 'IN_PROGRESS',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    // ═══ LOAD ALL ═══
    if (q === '*') {
      const raw = await prisma.patient.findMany({
        select: SELECT_FIELDS,
        take: 500,
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json({ results: raw.map(decryptRow) });
    }

    // ═══ RESEARCH ID ═══
    if (/^MRH-\d{4}-\d{4,5}$/i.test(q)) {
      const raw = await prisma.patient.findMany({
        where: { research_id: q.toUpperCase() },
        select: SELECT_FIELDS,
        take: 5,
      });
      return NextResponse.json({ results: raw.map(decryptRow) });
    }

    // ═══ DATE ═══
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const start = new Date(q + 'T00:00:00.000Z');
      const end = new Date(q + 'T23:59:59.999Z');
      const raw = await prisma.patient.findMany({
        where: { date_of_birth: { gte: start, lte: end } },
        select: SELECT_FIELDS,
        take: 50,
        orderBy: { date_of_birth: 'desc' },
      });
      return NextResponse.json({ results: raw.map(decryptRow) });
    }

    // ═══ PHONE ═══
    if (/^0\d{9,10}$/.test(q.replace(/[\s\-]/g, ''))) {
      const phone = q.replace(/[\s\-]/g, '');
      const raw = await prisma.patient.findMany({
        select: PHONE_SELECT_FIELDS,
        take: 500,
      });
      const results = raw
        .map((r) => ({
          ...decryptRow(r),
          mother_phone: safeDecryptNullable(r.mother_phone),
          guardian_phone_alt: safeDecryptNullable(r.guardian_phone_alt),
          whatsapp_number: safeDecryptNullable(r.whatsapp_number),
        }))
        .filter((r) =>
          r.mother_phone?.startsWith(phone) ||
          r.guardian_phone_alt?.startsWith(phone) ||
          r.whatsapp_number?.startsWith(phone)
        );
      return NextResponse.json({ results });
    }

    // ═══ HOSPITAL NUMBER ═══
    if (/^\d+$/.test(q)) {
      const raw = await prisma.patient.findMany({
        where: { hospital_number: q },
        select: SELECT_FIELDS,
        take: 5,
      });
      return NextResponse.json({ results: raw.map(decryptRow) });
    }

    // ═══ NAME — fuzzy on decrypted mother_name ═══
    const raw = await prisma.patient.findMany({
      select: SELECT_FIELDS,
      take: 500,
    });
    const decrypted = raw.map(decryptRow);
    const ranked = fuzzyMatch(decrypted, q, {
      keys: ['mother_name'],
      threshold: 0.4,
    });
    return NextResponse.json({ results: ranked.map((r) => r.item) });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}