// app/api/v1/corrections/[...route]/route.ts
// GET  /api/v1/corrections     — list (role-filtered)
// POST /api/v1/corrections     — create request
// PATCH /api/v1/corrections/:id — review (Supervisor, Admin)

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { CorrectionRequestCreateSchema, CorrectionRequestReviewSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SCREENER", "SUPERVISOR", "ADMIN"]);

    const isSupervisor = ["SUPERVISOR", "ADMIN"].includes(user.role);

    const requests = await prisma.correctionRequest.findMany({
      where: isSupervisor ? {} : { requested_by: user.id },
      include: {
        requester: { select: { name: true, role: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { requested_at: "desc" },
    });

    return NextResponse.json({ data: requests });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SCREENER", "SUPERVISOR", "ADMIN"]);
    const body = await request.json();

    const parsed = CorrectionRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const d = parsed.data;
    const req = await prisma.correctionRequest.create({
      data: {
        requested_by: user.id,
        table_name: d.table_name,
        record_id: d.record_id as unknown as string,
        reason: d.reason,
        proposed_value: d.proposed_value,
        status: "PENDING",
      },
    });

    return NextResponse.json({ id: req.id }, { status: 201 });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  try {
    const user = await requireAuth(request, ["SUPERVISOR", "ADMIN"]);
    const id = params.route?.[0];
    if (!id) return NextResponse.json({ error: "Request ID required" }, { status: 400 });

    const body = await request.json();
    const parsed = CorrectionRequestReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const corrReq = await prisma.correctionRequest.findUnique({ where: { id } });
    if (!corrReq) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (corrReq.status !== "PENDING") {
      return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.correctionRequest.update({
        where: { id },
        data: {
          status: parsed.data.decision,
          reviewed_by: user.id,
          reviewed_at: new Date(),
          reviewer_note: parsed.data.reviewer_note ?? null,
        },
      });

      // If approved — apply the proposed change to the target record
      if (parsed.data.decision === "APPROVED" && Object.keys(corrReq.proposed_value as object).length > 0) {
        const tableMap: Record<string, keyof typeof prisma> = {
          screening_events: "screeningEvent",
          patients: "patient",
          referrals: "referral",
          risk_factors: "riskFactor",
        };
        const modelKey = tableMap[corrReq.table_name];
        if (modelKey && (tx as Record<string, unknown>)[modelKey as string]) {
          await (tx as Record<string, { update: (args: unknown) => Promise<unknown> }>)[modelKey as string].update({
            where: { id: corrReq.record_id },
            data: corrReq.proposed_value as object,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          table_name: "correction_requests",
          record_id: id,
          action: "UPDATE",
          changed_by: user.id,
          before_value: { status: "PENDING" },
          after_value: { status: parsed.data.decision, reviewer_note: parsed.data.reviewer_note },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrResponse(err);
  }
}