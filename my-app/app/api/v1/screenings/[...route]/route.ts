// app/api/v1/screenings/[...route]/route.ts
//
// PATCH /api/v1/screenings/:eventId        — edit a screening event within the edit window
// POST  /api/v1/screenings/:eventId/flag   — screener flag-for-correction (§46.3)
//
// NOTE: creating a new screening result is handled by
// POST /api/v1/children/[id]/screenings (that route runs the pathway engine
// and is the single source of truth for SCREENING_SAVED events). This file
// used to duplicate that logic against an older version of the pathway
// engine's API (transitionState/checkOrderViolation, string side effects) —
// that API no longer exists (see lib/pathway/engine.ts, which now exports
// transitionEarState/guardScreening with object side effects), so the
// duplicate creation logic here was deleted rather than fixed twice.

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Fields safe to correct within the edit window without touching the
// pathway. `result`, `ear`, `stage`, and `modality` drive the state
// machine — changing them after the fact would desync ear_pathway_states
// from the screening_events history without re-running the engine, so
// they are deliberately excluded. A wrong result/ear/stage goes through
// "Flag for Correction" (§46.3) instead, which routes to a human review
// rather than a silent state-machine skip.
const EDITABLE_FIELDS = new Set([
  "equipment_id",
  "probe_fit_quality",
  "ambient_noise_level",
  "attempts",
  "duration_minutes",
  "incomplete_reason",
  "clinicalComment",
  "tested_at",
]);

const EDIT_WINDOW_HOURS = 48;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ route: string[] }> }
) {
  try {
    await requireAuth(request, ["DATA_CLERK", "SCREENER", "SUPERVISOR", "ADMIN"]);
    const { route } = await params;
    const eventId = route?.[0];
    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const screening = await prisma.screeningEvent.findUnique({ where: { id: eventId } });
    if (!screening) return NextResponse.json({ error: "Screening event not found" }, { status: 404 });

    return NextResponse.json({ screening });
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
    const eventId = route?.[0];
    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const event = await prisma.screeningEvent.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Screening event not found" }, { status: 404 });

    if (user.role === "DATA_CLERK") {
      const hours = (Date.now() - event.recorded_at.getTime()) / 3600000;
      if (hours > EDIT_WINDOW_HOURS) {
        return NextResponse.json(
          { error: `Edit window (${EDIT_WINDOW_HOURS}h) has expired — submit a Flag for Correction instead.` },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const rejected = Object.keys(body).filter((k) => !EDITABLE_FIELDS.has(k));
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: `These fields cannot be edited directly because they drive the pathway state machine: ${rejected.join(", ")}. Use "Flag for Correction" instead so a supervisor can review and, if needed, re-run the pathway.`,
        },
        { status: 422 }
      );
    }

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      data[key] = key === "tested_at" ? new Date(body[key]) : body[key];
    }

    const before = { ...event };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.screeningEvent.update({ where: { id: eventId }, data });
      await tx.auditLog.create({
        data: {
          table_name: "screening_events",
          record_id: eventId,
          action: "UPDATE",
          changed_by: user.id,
          before_value: before,
          after_value: data,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ route: string[] }> }
) {
  const { route } = await params;

  if (route?.length === 2 && route[1] === "flag") {
    return handleFlag(request, route[0]);
  }

  return NextResponse.json(
    { error: "Not found. Use POST /api/v1/children/:id/screenings to create a result, or POST /api/v1/screenings/:eventId/flag to flag one for correction." },
    { status: 404 }
  );
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
        record_id: event.id,
        reason: body.reason,
        proposed_value: body.proposed_value ?? {},
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { success: true, message: "Flag submitted — supervisor will review." },
      { status: 201 }
    );
  } catch (err) {
    return authErrResponse(err);
  }
}
