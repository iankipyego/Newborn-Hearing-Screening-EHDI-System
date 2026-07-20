// app/api/v1/patients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { decrypt, decryptNullable } from "@/lib/utils/encryption";

const prisma = new PrismaClient();

const ENCRYPTED_FIELDS = [
  "mother_name",
  "mother_phone",
  "guardian_phone_alt",
  "whatsapp_number",
  "email",
] as const;

function decryptRecord<T extends Record<string, unknown>>(record: T): T {
  const out = { ...record };
  for (const field of ENCRYPTED_FIELDS) {
    if (field in out && out[field] != null) {
      (out as Record<string, unknown>)[field] = decryptNullable(
        out[field] as string
      );
    }
  }
  return out;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      consent_record: true,
      risk_factors: true,
      ear_pathway_states: true,
      pathway_milestone: true,
      screening_events: {
        orderBy: [{ tested_at: "asc" }, { ear: "asc" }],
      },
      referrals: {
        orderBy: { referred_at: "asc" },
      },
      diagnostic_evaluations: true,
      notifications_log: {
        take: 50,
        orderBy: { sent_at: "desc" },
      },
      parent_survey: true,
    },
  });

  if (!patient) {
    return NextResponse.json(
      { error: "Patient not found" },
      { status: 404 }
    );
  }

  // Decrypt PII before sending to frontend
  const decrypted = decryptRecord(patient);

  return NextResponse.json({ patient: decrypted });
}