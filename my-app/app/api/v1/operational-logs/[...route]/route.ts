// app/api/v1/operational-logs/[...route]/route.ts
// GET  /api/v1/operational-logs — list (Supervisor, Admin)
// POST /api/v1/operational-logs — create (Clerk, Admin)
// PATCH /api/v1/operational-logs/:id — update same-day (Clerk, Supervisor)

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { OperationalLogCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["SUPERVISOR", "ADMIN", "DATA_CLERK"]);
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const logs = await prisma.operationalLog.findMany({
      where: {
        site_id: user.site_id,
        ...(dateFrom || dateTo ? {
          log_date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        } : {}),
      },
      orderBy: { log_date: "desc" },
      include: { recorded_by_user: { select: { name: true } } },
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    return authErrResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "ADMIN"]);
    const body = await request.json();

    const parsed = OperationalLogCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const d = parsed.data;

    // Check for duplicate log on same date+site
    const existing = await prisma.operationalLog.findFirst({
      where: { log_date: new Date(d.log_date), site_id: user.site_id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An operational log for this date already exists. Use PATCH to update it." },
        { status: 409 }
      );
    }

    const log = await prisma.operationalLog.create({
      data: {
        log_date: new Date(d.log_date),
        site_id: user.site_id,
        total_births: d.total_births,
        total_screened: d.total_screened,
        total_missed: d.total_missed,
        missed_discharged_early: d.missed_discharged_early,
        missed_refused: d.missed_refused,
        missed_equipment_down: d.missed_equipment_down,
        missed_staff_absent: d.missed_staff_absent,
        avg_screening_time_minutes: d.avg_screening_time_minutes,
        equipment_downtime_minutes: d.equipment_downtime_minutes,
        power_outage_minutes: d.power_outage_minutes,
        probes_replaced: d.probes_replaced,
        consumable_cost: d.consumable_cost,
        staff_on_duty_count: d.staff_on_duty_count,
        recorded_by: user.id,
      },
    });

    return NextResponse.json({ id: log.id }, { status: 201 });
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
    const id = params.route?.[0];
    if (!id) return NextResponse.json({ error: "Log ID required" }, { status: 400 });

    const log = await prisma.operationalLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "DATA_CLERK") {
      const logDate = new Date(log.log_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (logDate < today) {
        return NextResponse.json({ error: "Clerks can only edit today's log" }, { status: 403 });
      }
    }

    const body = await request.json();
    await prisma.operationalLog.update({ where: { id }, data: body });
    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrResponse(err);
  }
}