// app/api/v1/screenings/[...route]/route.ts
// POST /api/v1/patients/:id/screenings — add screening result
// PATCH /api/v1/screenings/:eventId — edit within window
// POST /api/v1/screenings/:eventId/flag — screener flag for correction

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { ScreeningEventCreateSchema } from "@/lib/validation/schemas";
import { transitionState, checkOrderViolation, derivePatientStatus } from "@/lib/pathway/engine";
import type { EarStateValue, PathwayEvent } from "@/lib/pathway/types";

// Helper: derive current ear state from DB records
async function getEarState(patientId: string, ear: "LEFT" | "RIGHT"): Promise<EarStateValue> {
  const screenings = await prisma.screeningEvent.findMany({
    where: { patient_id: patientId, ear },
    orderBy: { tested_at: "asc" },
  });
  const referrals = await prisma.referral.findMany({
    where: { patient_id: patientId, ear },
    orderBy: { referred_at: "asc" },
  });
  const diagnostics = await prisma.diagnosticEvaluation.findMany({
    where: { patient_id: patientId, ear },
  });

  if (diagnostics.length > 0) return "DIAGNOSED";

  const hasAudiologyReferral = referrals.some((r) => r.type === "AUDIOLOGIST");
  const lastScreening = screenings[screenings.length - 1];

  if (hasAudiologyReferral && lastScreening?.stage === "RESCREEN_POST_REFERRAL" && lastScreening?.result === "NOT_PASS") return "RESCREEN_FAILED";
  if (lastScreening?.stage === "RESCREEN_POST_REFERRAL" && lastScreening?.result === "PASS") return "RESCREEN_PASSED";

  const hcpReferral = referrals.find((r) => r.type === "HEALTH_CARE_PROVIDER");
  if (hcpReferral && ["CLEARED", "TREATED", "SEEN"].includes(hcpReferral.status)) return "CLEARED_FOR_RESCREEN";
  if (hcpReferral && hcpReferral.status === "PENDING") return "SCREEN_2_FAILED";

  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "PASS") return "SCREEN_2_PASSED";
  if (lastScreening?.stage === "SCREEN_2" && lastScreening?.result === "NOT_PASS") return "SCREEN_2_FAILED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "PASS") return "SCREEN_1_PASSED";
  if (lastScreening?.stage === "SCREEN_1" && lastScreening?.result === "NOT_PASS") return "SCREEN_1_FAILED";

  return "NOT_STARTED";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const route = params.route ?? [];

  // POST /api/v1/screenings/:eventId/flag
  if (route.length === 2 && route[1] === "flag") {
    return handleFlag(request, route[0]);
  }

  // POST from /api/v1/patients/:id/screenings — route has patient_id
  // But this file is mounted at /api/v1/screenings/[...route]
  // The patient route calls /api/v1/patients/:id/screenings which is handled by patients route
  // This handles direct POST to /api/v1/screenings with patient_id in body

  try {
    const user = await requireAuth(request, ["DATA_CLERK", "ADMIN"]);
    const body = await request.json();
    const { patient_id, ...rest } = body;

    if (!patient_id) {
      return NextResponse.json({ error: "patient_id required" }, { status: 422 });
    }

    const parsed = ScreeningEventCreateSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const d = parsed.data;
    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // §17.4 out-of-order protection
    const currentState = await getEarState(patient_id, d.ear as "LEFT" | "RIGHT");
    const stageKey = d.stage === "SCREEN_1" ? "SCREEN_1"
      : d.stage === "SCREEN_2" ? "SCREEN_2"
      : "RESCREEN_POST_REFERRAL";

    const violation = checkOrderViolation(currentState, stageKey);
    if (violation) {
      return NextResponse.json({
        error: `Out-of-order entry: ${violation.replace(/_/g, " ")}`,
        current_state: currentState,
      }, { status: 422 });
    }

    // §17.1 NICU modality enforcement
    const nicuDays = patient.nicu_days ?? 0;
    if (patient.nicu_admitted && nicuDays > 5 && d.modality !== "AABR") {
      return NextResponse.json({
        error: "NICU > 5 days: modality must be AABR (§17.1). OAE alone cannot detect auditory neuropathy.",
      }, { status: 422 });
    }

    const event: PathwayEvent = {
      type: "SCREENING_SAVED",
      stage: d.stage,
      result: d.result,
    };

    const transition = transitionState(currentState, event);

    const result = await prisma.$transaction(async (tx) => {
      const screening = await tx.screeningEvent.create({
        data: {
          patient_id,
          ear: d.ear,
          stage: d.stage,
          modality: d.modality,
          equipment_id: d.equipment_id,
          probe_fit_quality: d.probe_fit_quality ?? null,
          ambient_noise_level: d.ambient_noise_level,
          attempts: d.attempts,
          screener_id: d.screener_id,
          duration_minutes: d.duration_minutes,
          result: d.result,
          incomplete_reason: d.incomplete_reason ?? null,
          tested_at: new Date(d.tested_at),
          recorded_at: new Date(),
        },
      });

      // Auto-create HCP referral if pathway engine says so
      if (transition.sideEffects.includes("AUTO_CREATE_HCP_REFERRAL")) {
        await tx.referral.create({
          data: {
            patient_id,
            ear: d.ear,
            type: "HEALTH_CARE_PROVIDER",
            reason: `Auto-created: Screen 2 NOT_PASS for ${d.ear} ear`,
            provider_name: "To be assigned",
            facility: "To be assigned",
            status: "PENDING",
          },
        });
      }

      // Auto-create audiology referral
      if (transition.sideEffects.includes("AUTO_CREATE_AUDIOLOGY_REFERRAL")) {
        await tx.referral.create({
          data: {
            patient_id,
            ear: d.ear,
            type: "AUDIOLOGIST",
            reason: `Auto-created: Rescreen NOT_PASS for ${d.ear} ear`,
            provider_name: "To be assigned",
            facility: "To be assigned",
            status: "PENDING",
          },
        });
      }

      // Recompute pathway milestones
      const otherEar: "LEFT" | "RIGHT" = d.ear === "LEFT" ? "RIGHT" : "LEFT";
      const otherEarState = await getEarState(patient_id, otherEar);
      const newEarState = transition.nextState;
      const patientStatus = derivePatientStatus(
        d.ear === "LEFT" ? newEarState : otherEarState,
        d.ear === "RIGHT" ? newEarState : otherEarState,
      );

      // Map to Prisma enum
      const finalStatusMap: Record<string, string> = {
        PASSED: "PASSED",
        IN_PROGRESS: "IN_PROGRESS",
        REFERRED_AUDIOLOGY: "REFERRED_AUDIOLOGY",
        DIAGNOSED: "DIAGNOSED",
        LOST_TO_FOLLOWUP: "LOST_TO_FOLLOWUP",
      };

      const birthDate = patient.date_of_birth;
      const firstScreen = await tx.screeningEvent.findFirst({
        where: { patient_id },
        orderBy: { tested_at: "asc" },
      });
      const daysBirthToFirstScreen = firstScreen
        ? Math.floor((firstScreen.tested_at.getTime() - birthDate.getTime()) / 86400000)
        : 0;

      await tx.pathwayMilestone.upsert({
        where: { patient_id },
        create: {
          patient_id,
          days_birth_to_first_screen: daysBirthToFirstScreen,
          screened_within_1_month: daysBirthToFirstScreen <= 30,
          diagnosed_within_3_months: false,
          intervention_within_6_months: false,
          final_status: finalStatusMap[patientStatus] as never,
          computed_at: new Date(),
        },
        update: {
          final_status: finalStatusMap[patientStatus] as never,
          computed_at: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          table_name: "screening_events",
          record_id: screening.id,
          action: "INSERT",
          changed_by: user.id,
          after_value: { screening_id: screening.id, ear: d.ear, result: d.result },
        },
      });

      return screening;
    });

    // Build confirmation message for clerk (§46.2 Step 4)
    let msg = `${d.stage.replace(/_/g, " ")} result saved — ${d.ear} ear: ${d.result}.`;
    if (transition.sideEffects.includes("AUTO_CREATE_HCP_REFERRAL")) {
      msg += " HCP referral auto-created.";
    }
    if (transition.sideEffects.includes("AUTO_CREATE_AUDIOLOGY_REFERRAL")) {
      msg += " Audiology referral auto-created.";
    }
    if (transition.sideEffects.includes("MARK_EAR_RESOLVED")) {
      msg += " Ear pathway resolved.";
    }
    if (transition.warning) {
      msg += ` ⚠ ${transition.warning}`;
    }

    return NextResponse.json({ id: result.id, message: msg, next_state: transition.nextState }, { status: 201 });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const eventId = params.route?.[0];
    if (!eventId) return NextResponse.json({ error: "Event ID required" }, { status: 400 });

    const event = await prisma.screeningEvent.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "DATA_CLERK") {
      const hours = (Date.now() - event.recorded_at.getTime()) / 3600000;
      if (hours > 48) {
        return NextResponse.json({ error: "Edit window expired — submit a correction request" }, { status: 403 });
      }
    }

    const body = await request.json();
    const before = { ...event };

    await prisma.$transaction(async (tx) => {
      await tx.screeningEvent.update({ where: { id: eventId }, data: body });
      await tx.auditLog.create({
        data: {
          table_name: "screening_events",
          record_id: eventId,
          action: "UPDATE",
          changed_by: user.id,
          before_value: before,
          after_value: body,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrResponse(err);
  }
}

async function handleFlag(request: NextRequest, eventId: string) {
  try {
    const user = await requireAuth(request, ["SCREENER", "DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const body = await request.json();
    if (!body.reason || body.reason.length < 5) {
      return NextResponse.json({ error: "reason is required (min 5 chars)" }, { status: 422 });
    }

    const event = await prisma.screeningEvent.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Screening event not found" }, { status: 404 });

    await prisma.correctionRequest.create({
      data: {
        requested_by: user.id,
        table_name: "screening_events",
        record_id: event.id as unknown as string,
        reason: body.reason,
        proposed_value: body.proposed_value ?? {},
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, message: "Flag submitted — supervisor will review." }, { status: 201 });
  } catch (err) {
    return authErrResponse(err);
  }
}