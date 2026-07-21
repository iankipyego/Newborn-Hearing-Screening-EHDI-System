import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  transitionEarState,
  guardVisualInspection,
  type EarStateValue,
  type Ear,
} from '@/lib/pathway';
import { VisualInspectionCreateSchema } from '@/lib/validation/schemas';
import { requireAuth, authErrResponse } from '@/lib/auth/requireAuth';

/**
 * POST /api/v1/children/[id]/visual-inspection
 *
 * Records the pre-OAE "Visual Inspection and Case History" step
 * (ECHO protocol p.2) for one or both ears, and runs the pathway
 * engine. REFER_MEDICAL blocks that ear's Screen 1 until the
 * resulting HCP referral is resolved (PATCH the referral, which
 * transitions the ear back to NOT_STARTED).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    const user = await requireAuth(request, ['SCREENER', 'DATA_CLERK', 'ADMIN']);
    userId = user.id;
  } catch (err) {
    return authErrResponse(err);
  }

  const { id: patientId } = await params;
  const body = await request.json();

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const ears: Ear[] = body.ear === 'BOTH' ? ['LEFT', 'RIGHT'] : [body.ear];
  if (!ears.length || !['LEFT', 'RIGHT'].includes(ears[0])) {
    return NextResponse.json(
      { error: 'Invalid ear value. Must be LEFT, RIGHT, or BOTH.' },
      { status: 422 }
    );
  }

  const results: Array<{
    ear: Ear;
    success: boolean;
    id?: string;
    newState?: string;
    error?: string;
  }> = [];

  for (const ear of ears) {
    const parsed = VisualInspectionCreateSchema.safeParse({ ...body, ear });
    if (!parsed.success) {
      results.push({
        ear,
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
      continue;
    }
    const data = parsed.data;

    const earState = await prisma.earPathwayState.findUnique({
      where: { patientId_ear: { patientId, ear } },
    });
    const currentState: EarStateValue = (earState?.state as EarStateValue) ?? 'NOT_STARTED';

    // ── Guard: visual inspection must be the FIRST thing recorded (§2.1) ──
    const guardError = guardVisualInspection(currentState);
    if (guardError) {
      results.push({ ear, success: false, error: guardError });
      continue;
    }

    const now = new Date();
    const inspectedAt = new Date(data.inspected_at);

    const visualInspection = await prisma.visualInspection.create({
      data: {
        patient_id: patientId,
        ear,
        outcome: data.outcome,
        finding_note: data.finding_note ?? null,
        screener_id: data.screener_id,
        inspected_at: inspectedAt,
        recorded_at: now,
        entrySource: data.entry_source,
        createdById: userId,
      },
    });

    // ── Run pathway engine (pure logic) ──
    const transition = transitionEarState(currentState, {
      type: 'VISUAL_INSPECTION_SAVED',
      outcome: data.outcome,
    });

    // NOT_STARTED is the DB default — only upsert when the state
    // actually needs to record something other than the default,
    // or when a row already exists.
    if (transition.nextState !== 'NOT_STARTED' || earState) {
      await prisma.earPathwayState.upsert({
        where: { patientId_ear: { patientId, ear } },
        create: {
          patientId,
          ear,
          state: transition.nextState,
          modality: earState?.modality ?? 'OAE',
        },
        update: { state: transition.nextState },
      });
    }

    // ── Handle side effects that require a referral record ──
    for (const effect of transition.sideEffects) {
      if (effect.kind === 'AUTO_CREATE_HCP_REFERRAL_PRESCREEN') {
        await prisma.referral.create({
          data: {
            patient_id: patientId,
            ear,
            type: 'HEALTH_CARE_PROVIDER',
            reason: `Visual inspection referral — ${data.finding_note ?? 'blockage/infection/malformation noted'}`,
            provider_name: 'To be assigned',
            facility: 'To be assigned',
            status: 'PENDING',
            createdById: userId,
          },
        });
      }
      // SCHEDULE_PRESCREEN_HCP_REFERRAL_NOTIFICATIONS: Phase 2 will wire
      // this into lib/notifications/scheduler.ts, same as the existing
      // SCHEDULE_HCP_REFERRAL_NOTIFICATIONS side effect for Screen 2.
    }

    results.push({
      ear,
      success: true,
      id: visualInspection.id,
      newState: transition.nextState,
    });
  }

  const hasErrors = results.some((r) => !r.success);
  return NextResponse.json(
    { results },
    { status: hasErrors ? 422 : 201 }
  );
}
