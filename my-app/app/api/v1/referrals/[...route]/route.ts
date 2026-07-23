// app/api/v1/referrals/[...route]/route.ts
//
// GET   /api/v1/referrals/:id            — fetch one referral (for the resolution form)
// PATCH /api/v1/referrals/:id            — resolve a referral (CLEARED/TREATED/SEEN/NO_SHOW)
//
// This is the closing half of the Screen 2 / Rescreen -> referral loop.
// The pathway engine already auto-creates a PENDING referral when an ear
// fails Screen 2 (-> HCP) or a post-referral rescreen (-> audiologist), via
// AUTO_CREATE_HCP_REFERRAL / AUTO_CREATE_AUDIOLOGY_REFERRAL side effects in
// app/api/v1/children/[id]/screenings/route.ts. Until now nothing ever
// wrote a *resolution* back onto that referral, so an ear that failed
// Screen 2 had no way to reach CLEARED_FOR_RESCREEN — this endpoint is
// what runs transitionEarState's REFERRAL_UPDATED event and unblocks it.
//
// Only HEALTH_CARE_PROVIDER referrals resolve through this state-changing
// path (§17.2 rows 7-10). An AUDIOLOGIST referral is closed by a
// diagnostic evaluation instead (RESCREEN_FAILED -> DIAGNOSED), not by a
// status change here — see the diagnostic-evaluations route.
//
// Manual referral creation (POST) lives at
// app/api/v1/children/[id]/referrals/route.ts instead of here — route[0]
// in this file means a referral ID for GET/PATCH, so reusing that same
// position as a patient ID for POST would make the same path segment mean
// two different kinds of entity depending on HTTP verb.

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { ReferralUpdateSchema } from "@/lib/validation/schemas";
import { transitionEarState, derivePatientStatus, type EarStateValue } from "@/lib/pathway";
import type { Prisma } from "@prisma/client";

async function getEarState(patientId: string, ear: "LEFT" | "RIGHT"): Promise<EarStateValue> {
  const eps = await prisma.earPathwayState.findUnique({
    where: { patientId_ear: { patientId, ear } },
  });
  return (eps?.state as EarStateValue) ?? "NOT_STARTED";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ route: string[] }> }
) {
  try {
    await requireAuth(request, ["DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const { route } = await params;
    const referralId = route?.[0];
    if (!referralId) return NextResponse.json({ error: "Referral ID required" }, { status: 400 });

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: { patient: { select: { id: true, research_id: true, mother_name: true, nicu_days: true } } },
    });
    if (!referral) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

    return NextResponse.json({ referral });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ route: string[] }> }
) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const { route } = await params;
    const referralId = route?.[0];
    if (!referralId) return NextResponse.json({ error: "Referral ID required" }, { status: 400 });

    const body = await request.json();
    const parsed = ReferralUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }
    const d = parsed.data;

    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

    if (referral.status !== "PENDING") {
      return NextResponse.json(
        { error: `Referral already resolved (status: ${referral.status}). Resolving twice would desync the pathway state.` },
        { status: 422 }
      );
    }

    // PE-tube outcome (status "SEEN") only makes sense with pe_tube_placed
    // set — that boolean is what tells the confirmation message and the
    // clinical record which delay window applied.
    if (d.status === "SEEN" && d.pe_tube_placed !== true) {
      return NextResponse.json(
        { error: 'status "SEEN" represents a PE-tube-placement outcome — set pe_tube_placed: true, or use "TREATED" for medically-treated otitis media.' },
        { status: 422 }
      );
    }

    // Only HCP referrals drive a pathway transition here — see file header.
    // Two distinct HCP-referral origins reach this same PATCH: a Screen 2
    // failure (currentState === "SCREEN_2_FAILED") and a pre-screening
    // visual-inspection block (currentState ===
    // "PENDING_MEDICAL_CLEARANCE_PRESCREEN", §2.1). Both resolve the same
    // way (CLEARED/TREATED/SEEN/NO_SHOW) but land in different next states
    // — see handleReferralUpdated in lib/pathway/engine.ts.
    let transition: ReturnType<typeof transitionEarState> | null = null;
    let currentState: EarStateValue | null = null;
    if (referral.type === "HEALTH_CARE_PROVIDER") {
      currentState = await getEarState(referral.patient_id, referral.ear);
      if (
        currentState !== "SCREEN_2_FAILED" &&
        currentState !== "PENDING_MEDICAL_CLEARANCE_PRESCREEN"
      ) {
        return NextResponse.json(
          {
            error: `Ear is in state "${currentState}", not "SCREEN_2_FAILED" or "PENDING_MEDICAL_CLEARANCE_PRESCREEN" — this referral no longer matches the ear's current pathway position. Check for a newer referral on this ear.`,
          },
          { status: 422 }
        );
      }
      transition = transitionEarState(currentState, {
        type: "REFERRAL_UPDATED",
        referralStatus: d.status as "CLEARED" | "TREATED" | "SEEN" | "NO_SHOW",
      });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.referral.update({
        where: { id: referralId },
        data: {
          status: d.status,
          diagnosis_at_referral: d.diagnosis_at_referral ?? undefined,
          treatment_given: d.treatment_given ?? undefined,
          medical_clearance_given: d.medical_clearance_given ?? undefined,
          pe_tube_placed: d.pe_tube_placed ?? undefined,
          provider_name: d.provider_name ?? undefined,
          facility: d.facility ?? undefined,
          resolved_at: d.status === "NO_SHOW" ? null : new Date(),
        },
      });

      if (transition && currentState) {
        await tx.earPathwayState.upsert({
          where: { patientId_ear: { patientId: referral.patient_id, ear: referral.ear } },
          create: {
            patientId: referral.patient_id,
            ear: referral.ear,
            state: transition.nextState,
            modality: "OAE", // modality is locked at intake and unaffected by referral resolution
          },
          update: { state: transition.nextState },
        });

        const otherEar = referral.ear === "LEFT" ? "RIGHT" : "LEFT";
        const otherState = await getEarState(referral.patient_id, otherEar);
        const newPatientStatus = derivePatientStatus(
          referral.ear === "LEFT" ? transition.nextState : otherState,
          referral.ear === "RIGHT" ? transition.nextState : otherState
        );

        await tx.pathwayMilestone.updateMany({
          where: { patient_id: referral.patient_id },
          data: { final_status: newPatientStatus, computed_at: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          table_name: "referrals",
          record_id: referralId,
          action: "UPDATE",
          changed_by: user.id,
          before_value: { status: referral.status },
          after_value: { status: d.status, ear_next_state: transition?.nextState ?? null },
        },
      });

      return updated;
    });

    const message = transition
      ? transition.nextState === "CLEARED_FOR_RESCREEN"
        ? `Referral resolved (${d.status}) — ${referral.ear.toLowerCase()} ear cleared for rescreen.`
        : transition.nextState === "NOT_STARTED"
          ? `Referral resolved (${d.status}) — ${referral.ear.toLowerCase()} ear cleared. Screen 1 can now be recorded.`
          : `Referral marked ${d.status} — no-show logged, HCP notification series resumed. Ear remains at ${currentState === "PENDING_MEDICAL_CLEARANCE_PRESCREEN" ? "pre-screening referral" : "Screen 2 failed"} pending follow-up.`
      : `Referral marked ${d.status}.`;

    return NextResponse.json({ referral: result, next_state: transition?.nextState ?? null, message });
  } catch (err) {
    return authErrResponse(err);
  }
}
