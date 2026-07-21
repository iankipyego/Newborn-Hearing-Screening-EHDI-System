import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  transitionEarState,
  guardScreening,
  getExpectedStage,
  derivePatientStatus,
  getModality,
  type EarStateValue,
  type Ear,
} from '@/lib/pathway';
import { requireAuth, authErrResponse } from '@/lib/auth/requireAuth';

/**
 * POST /api/v1/children/[id]/screenings
 *
 * Creates a screening event and runs the pathway engine.
 * Handles single ear or both ears in one request.
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

  // ── Validate patient exists ──
const patient = await prisma.patient.findUnique({
  where: { id: patientId },
  include: {
    ear_pathway_states: true,
    pathway_milestone: true,
  },
});

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // ── Determine which ears to process ──
  const ears: Ear[] = body.ear === 'BOTH' ? ['LEFT', 'RIGHT'] : [body.ear];
  if (!ears.length || !['LEFT', 'RIGHT'].includes(ears[0])) {
    return NextResponse.json(
      { error: 'Invalid ear value. Must be LEFT, RIGHT, or BOTH.' },
      { status: 422 }
    );
  }

  // ── Assign modality (locked per §17.1) ──
  const lockedModality = getModality(patient.nicu_days);

  // If the body sends a different modality, reject it
  if (body.modality && body.modality !== lockedModality) {
    return NextResponse.json(
      {
        error: `Modality mismatch. This patient requires ${lockedModality} (NICU ${patient.nicu_days ?? 0} days). Modality is system-locked per JCIH protocol.`,
      },
      { status: 422 }
    );
  }

  const results: Array<{
    ear: Ear;
    success: boolean;
    id?: string;
    newState?: string;
    message?: string;
    error?: string;
  }> = [];

// ── Process each ear ──
for (const ear of ears) {
  // Get current ear state
  let earState = await prisma.earPathwayState.findUnique({
    where: { patientId_ear: { patientId, ear } },
  });

  const currentState: EarStateValue = (earState?.state as EarStateValue) ?? 'NOT_STARTED';

  // ── Guard: out-of-order protection (§17.4) ──
  const stage = body.stage;
  if (!stage || !['SCREEN_1', 'SCREEN_2', 'RESCREEN_POST_REFERRAL'].includes(stage)) {
    results.push({ ear, success: false, error: `Invalid stage: "${stage}".` });
    continue;
  }

  const guardError = guardScreening(currentState, stage as any);
  if (guardError) {
    results.push({ ear, success: false, error: guardError });
    continue;
  }

  // ── Required-field validation (equipment cannot be null — schema is non-nullable) ──
  if (!body.equipment_id) {
    results.push({
      ear,
      success: false,
      error: 'equipment_id is required. Select or scan the screening device before saving.',
    });
    continue;
  }

  if (!body.screener_id) {
    results.push({
      ear,
      success: false,
      error: 'screener_id is required. Select the screener who performed this test.',
    });
    continue;
  }

  // ── Determine tested_at per §6 governance rule ──
  const entrySource = body.entry_source ?? body.entrySource ?? 'LIVE';
  const now = new Date();

  let testedAt: Date;
  if (entrySource === 'PAPER_BACKUP') {
    if (!body.tested_at) {
      results.push({ ear, success: false, error: 'tested_at is required for PAPER_BACKUP entries.' });
      continue;
    }
    const parsed = new Date(body.tested_at);
    if (isNaN(parsed.getTime())) {
      results.push({ ear, success: false, error: `Invalid tested_at value: "${body.tested_at}".` });
      continue;
    }
    testedAt = parsed;
  } else {
    testedAt = now; // LIVE: system-generated, never trust client input (§6)
  }

  // ── Create screening event ──
  const screeningEvent = await prisma.screeningEvent.create({
    data: {
      patient_id: patientId,
      ear,
      stage: stage as any,
      modality: lockedModality,
      equipment_id: body.equipment_id,           // now guaranteed non-null above
      probe_fit_quality: lockedModality === 'OAE' ? normalizeEnumCasing(body.probe_fit_quality) : null,
      ambient_noise_level: normalizeEnumCasing(body.ambient_noise_level) ?? 'Medium',
      attempts: body.attempts ?? 1,
      screener_id: body.screener_id,              // now guaranteed non-null above
      duration_minutes: body.duration_minutes ?? 0,
      result: body.result as any,
      incomplete_reason: body.result === 'INCOMPLETE' ? body.incomplete_reason : null,
      clinicalComment: body.clinical_comment ?? body.clinicalComment ?? null,
      tested_at: testedAt,
      recorded_at: now,                          // required, no schema default
      entrySource,
      createdById: userId,
    },
  });
    // ── Run pathway engine (pure logic) ──
    const transition = transitionEarState(currentState, {
      type: 'SCREENING_SAVED',
      stage: stage as any,
      result: body.result as any,
    });

    // ── Update ear pathway state (upsert) ──
    await prisma.earPathwayState.upsert({
      where: { patientId_ear: { patientId, ear } },
      create: {
        patientId,
        ear,
        state: transition.nextState,
        modality: lockedModality,
      },
      update: {
        state: transition.nextState,
      },
    });

    // ── Handle side effects ──
    // (Phase 2 will execute notification side effects here.
    //  For Phase 1B, we just log them and handle milestones.)
    for (const effect of transition.sideEffects) {
      if (effect.kind === 'AUTO_CREATE_HCP_REFERRAL') {
        await prisma.referral.create({
          data: {
            patient_id: patientId,
            ear,
            type: 'HEALTH_CARE_PROVIDER',
            reason: `Screen 2 NOT_PASS — ${lockedModality} screening`,
            provider_name: 'To be assigned',
            facility: 'To be assigned',
            status: 'PENDING',
            createdById: userId,
          },
        });
      }

      if (effect.kind === 'AUTO_CREATE_AUDIOLOGY_REFERRAL') {
        await prisma.referral.create({
          data: {
            patient_id: patientId,
            ear,
            type: 'AUDIOLOGIST',
            reason: `Rescreen NOT_PASS — ${lockedModality} screening`,
            provider_name: 'To be assigned',
            facility: 'To be assigned',
            status: 'PENDING',
            createdById: userId,
          },
        });
      }
    }

    // ── Recompute patient-level status ──
    const leftState = await getEarState(prisma, patientId, 'LEFT');
    const rightState = await getEarState(prisma, patientId, 'RIGHT');
    const newPatientStatus = derivePatientStatus(leftState, rightState);

    // §4.7 — days from birth to first screening, and whether it met the 1-month target
    const firstScreen = await prisma.screeningEvent.findFirst({
      where: { patient_id: patientId },
      orderBy: { tested_at: 'asc' },
    });
    const daysBirthToFirstScreen = firstScreen
      ? Math.floor((firstScreen.tested_at.getTime() - patient.date_of_birth.getTime()) / 86400000)
      : 0;

    await prisma.pathwayMilestone.upsert({
      where: { patient_id: patientId },
      create: {
        patient_id: patientId,
        days_birth_to_first_screen: daysBirthToFirstScreen,
        screened_within_1_month: daysBirthToFirstScreen <= 30,
        diagnosed_within_3_months: false,
        intervention_within_6_months: false,
        final_status: newPatientStatus as any,
        computed_at: new Date(),
      },
      update: {
        final_status: newPatientStatus as any,
        computed_at: new Date(),
      },
    });

    results.push({
      ear,
      success: true,
      id: screeningEvent.id,
      newState: transition.nextState,
      message: buildConfirmationMessage(ear, stage, body.result, transition.nextState),
    });
  }

  // ── Build overall confirmation message (§46.2 Step 4) ──
  const allPassed = results.every(
    (r) => r.success && r.newState?.includes('PASSED')
  );
  const leftResult = results.find((r) => r.ear === 'LEFT');
  const rightResult = results.find((r) => r.ear === 'RIGHT');

  let summaryMessage: string;
  if (allPassed && ears.length === 2) {
    summaryMessage =
      'Both ears passed — pathway complete.';
  } else if (allPassed && ears.length === 1) {
    const otherEar = ears[0] === 'LEFT' ? 'RIGHT' : 'LEFT';
    const otherState = await getEarState(prisma, patientId, otherEar);
    const otherResolved = otherState.includes('PASSED');
    summaryMessage = otherResolved
      ? `Both ears passed — pathway complete.`
      : `${ears[0]} ear: ${body.result}. Check ${otherEar} ear status.`;
  } else {
    summaryMessage = results
      .map((r) => `${r.ear} ear: ${r.error ?? r.message}`)
      .join('. ');
  }

  // ── Check for errors ──
  const hasErrors = results.some((r) => !r.success);
  if (hasErrors) {
    return NextResponse.json(
      { results, summary: summaryMessage },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      results,
      summary: summaryMessage,
      screeningEventIds: results.map((r) => r.id).filter((id): id is string => Boolean(id)),
    },
    { status: 201 }
  );
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Prisma enums like AmbientNoiseLevel ("Low"|"Medium"|"High") and
 * ProbeFitQuality ("Good"|"Fair"|"Poor") only accept exact casing.
 * The frontend UI currently sends all-caps values (e.g. "MEDIUM"),
 * so normalize to Prisma's expected Title Case before writing.
 */
function normalizeEnumCasing(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

async function getEarState(
  prisma: typeof import('@/lib/prisma').prisma,
  patientId: string,
  ear: Ear
): Promise<EarStateValue> {
  const eps = await prisma.earPathwayState.findUnique({
    where: { patientId_ear: { patientId, ear } },
  });
  return (eps?.state as EarStateValue) ?? 'NOT_STARTED';
}

function buildConfirmationMessage(
  ear: Ear,
  stage: string,
  result: string,
  newState: string
): string {
  const stageLabel =
    stage === 'SCREEN_1'
      ? 'Screen 1'
      : stage === 'SCREEN_2'
        ? 'Screen 2'
        : 'Rescreen';
  return `${stageLabel} result saved — ${ear.toLowerCase()} ear: ${result}. State: ${newState.replace(/_/g, ' ')}.`;
}