// app/api/v1/children/[id]/consent/route.ts
//
// POST /api/v1/children/[id]/consent — record or correct a patient's
// consent record.
//
// This route did not exist before this change. consent_records has a
// @unique patient_id (one row per patient), and until now the ONLY place
// that ever wrote to it was the atomic registration transaction in
// app/api/v1/patients/[[...route]]/route.ts — there was no way to record
// consent for a patient who reached the system without one (e.g. a
// PAPER_BACKUP entry backfilled later) or to correct a wrong status. This
// upserts the row so the "Record consent →" link on the child profile page
// has somewhere real to submit to.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConsentUpsertSchema } from '@/lib/validation/schemas';
import { requireAuth, authErrResponse } from '@/lib/auth/requireAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request, ['DATA_CLERK', 'SUPERVISOR', 'ADMIN']);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = ConsentUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;

    const existing = await prisma.consentRecord.findUnique({ where: { patient_id: patientId } });

    const result = await prisma.$transaction(async (tx) => {
      const consentRecord = await tx.consentRecord.upsert({
        where: { patient_id: patientId },
        create: {
          patient_id: patientId,
          status: d.consent_status,
          consent_form_version: d.consent_form_version,
          consented_at: new Date(),
          consented_by_clerk_id: user.id,
          witness_name: d.witness_name ?? null,
        },
        update: {
          status: d.consent_status,
          consent_form_version: d.consent_form_version,
          witness_name: d.witness_name ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          table_name: 'consent_records',
          record_id: consentRecord.id,
          action: existing ? 'UPDATE' : 'INSERT',
          changed_by: user.id,
          before_value: existing ? { status: existing.status } : undefined,
          after_value: { status: d.consent_status, consent_form_version: d.consent_form_version },
        },
      });

      return consentRecord;
    });

    return NextResponse.json(
      { consent_record: result },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    return authErrResponse(err);
  }
}
