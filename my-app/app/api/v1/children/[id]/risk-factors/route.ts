// app/api/v1/children/[id]/risk-factors/route.ts
//
// POST /api/v1/children/[id]/risk-factors — record or correct a patient's
// risk-factor record.
//
// Same gap as the sibling consent route: risk_factors has a @unique
// patient_id, and until now the only write path was the registration
// transaction. This upserts the row and recomputes risk_factor_count the
// same way the registration route does, so it has somewhere real to submit
// to.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RiskFactorUpsertSchema } from '@/lib/validation/schemas';
import { requireAuth, authErrResponse } from '@/lib/auth/requireAuth';
import { sanitiseNullable } from '@/lib/utils/sanitise';

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
    const parsed = RiskFactorUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;

    const riskFactorCount = [
      d.risk_nicu_admission,
      d.risk_prematurity_under_37wk,
      d.risk_hyperbilirubinemia_treated,
      d.risk_ototoxic_drug_exposure,
      d.risk_craniofacial_anomaly,
      d.risk_family_history_hearing_loss,
      d.risk_birth_asphyxia,
      d.risk_congenital_infection_torch,
      d.risk_syndrome_associated_with_hl,
      d.risk_mechanical_ventilation_over_5d,
      d.risk_bacterial_meningitis,
    ].filter(Boolean).length;

    const existing = await prisma.riskFactor.findUnique({ where: { patient_id: patientId } });

    const result = await prisma.$transaction(async (tx) => {
      const riskFactor = await tx.riskFactor.upsert({
        where: { patient_id: patientId },
        create: {
          patient_id: patientId,
          nicu_admission: d.risk_nicu_admission,
          prematurity_under_37wk: d.risk_prematurity_under_37wk,
          hyperbilirubinemia_treated: d.risk_hyperbilirubinemia_treated,
          ototoxic_drug_exposure: d.risk_ototoxic_drug_exposure,
          craniofacial_anomaly: d.risk_craniofacial_anomaly,
          family_history_hearing_loss: d.risk_family_history_hearing_loss,
          birth_asphyxia: d.risk_birth_asphyxia,
          congenital_infection_torch: d.risk_congenital_infection_torch,
          syndrome_associated_with_hl: d.risk_syndrome_associated_with_hl,
          mechanical_ventilation_over_5d: d.risk_mechanical_ventilation_over_5d,
          bacterial_meningitis: d.risk_bacterial_meningitis,
          additional_notes: sanitiseNullable(d.risk_additional_notes),
          risk_factor_count: riskFactorCount,
        },
        update: {
          nicu_admission: d.risk_nicu_admission,
          prematurity_under_37wk: d.risk_prematurity_under_37wk,
          hyperbilirubinemia_treated: d.risk_hyperbilirubinemia_treated,
          ototoxic_drug_exposure: d.risk_ototoxic_drug_exposure,
          craniofacial_anomaly: d.risk_craniofacial_anomaly,
          family_history_hearing_loss: d.risk_family_history_hearing_loss,
          birth_asphyxia: d.risk_birth_asphyxia,
          congenital_infection_torch: d.risk_congenital_infection_torch,
          syndrome_associated_with_hl: d.risk_syndrome_associated_with_hl,
          mechanical_ventilation_over_5d: d.risk_mechanical_ventilation_over_5d,
          bacterial_meningitis: d.risk_bacterial_meningitis,
          additional_notes: sanitiseNullable(d.risk_additional_notes),
          risk_factor_count: riskFactorCount,
        },
      });

      await tx.auditLog.create({
        data: {
          table_name: 'risk_factors',
          record_id: riskFactor.id,
          action: existing ? 'UPDATE' : 'INSERT',
          changed_by: user.id,
          before_value: existing ? { risk_factor_count: existing.risk_factor_count } : undefined,
          after_value: { risk_factor_count: riskFactorCount },
        },
      });

      return riskFactor;
    });

    return NextResponse.json(
      { risk_factors: result },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    return authErrResponse(err);
  }
}
