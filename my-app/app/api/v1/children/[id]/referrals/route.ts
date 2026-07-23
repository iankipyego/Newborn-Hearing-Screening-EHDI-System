// app/api/v1/children/[id]/referrals/route.ts
//
// POST /api/v1/children/[id]/referrals — manually record a referral.
//
// ReferralCreateSchema already existed in lib/validation/schemas.ts,
// defined but never wired to a route — this was the missing half, needed
// for the "+ Add Referral" link on the child profile page and the new
// referrals/new page to have somewhere real to submit to.
//
// This creates a plain referral row + audit log only. Unlike the
// auto-created HCP/audiology referrals in the screenings and
// visual-inspection routes, it does NOT call transitionEarState: those
// auto-referrals don't drive a transition from referral creation either —
// the transition happens from the *triggering event* (a screening result
// or visual-inspection outcome), and the referral is just the resulting
// record. A manually-created referral has no such triggering event to
// model, so this mirrors existing behavior rather than inventing a new
// one. If a manually-entered referral should also move an ear's pathway
// state (e.g. back-entering one that was already resolved on paper), that
// is a product decision for the pathway engine, not something to guess at
// here — flagging this as a known limitation rather than a silent gap.

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { ReferralCreateSchema } from "@/lib/validation/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = ReferralCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const d = parsed.data;

    if (d.status === "SEEN" && d.pe_tube_placed !== true) {
      return NextResponse.json(
        { error: 'status "SEEN" represents a PE-tube-placement outcome — set pe_tube_placed: true, or use "TREATED" for medically-treated otitis media.' },
        { status: 422 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.create({
        data: {
          patient_id: patientId,
          ear: d.ear,
          type: d.type,
          reason: d.reason,
          provider_name: d.provider_name,
          facility: d.facility,
          diagnosis_at_referral: d.diagnosis_at_referral ?? undefined,
          treatment_given: d.treatment_given ?? undefined,
          medical_clearance_given: d.medical_clearance_given ?? undefined,
          pe_tube_placed: d.pe_tube_placed ?? undefined,
          status: d.status,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          table_name: "referrals",
          record_id: referral.id,
          action: "INSERT",
          changed_by: user.id,
          before_value: undefined,
          after_value: { ear: d.ear, type: d.type, status: d.status },
        },
      });

      return referral;
    });

    return NextResponse.json({ referral: result }, { status: 201 });
  } catch (err) {
    return authErrResponse(err);
  }
}
