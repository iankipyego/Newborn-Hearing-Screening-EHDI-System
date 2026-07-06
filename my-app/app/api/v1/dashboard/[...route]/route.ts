// app/api/v1/dashboard/[...route]/route.ts
// GET /api/v1/dashboard/summary      — KPI cards (§8)
// GET /api/v1/dashboard/funnel       — pathway funnel counts
// GET /api/v1/dashboard/trends       — monthly trends from quality_snapshots
// GET /api/v1/dashboard/bar-charts   — daily volume
// GET /api/v1/dashboard/action-needed — overdue patients (§19)

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  try {
    const user = await requireAuth(request);
    const subRoute = params.route?.[0] ?? "summary";

    switch (subRoute) {
      case "summary": return getSummary(user.site_id);
      case "funnel": return getFunnel(user.site_id);
      case "trends": return getTrends();
      case "bar-charts": return getBarCharts(user.site_id);
      case "action-needed": return getActionNeeded(user.site_id);
      default: return NextResponse.json({ error: "Unknown dashboard route" }, { status: 404 });
    }
  } catch (err) {
    return authErrResponse(err);
  }
}

// §8 — JCIH KPI formulas
async function getSummary(siteId: string) {
  const [totalPatients, consentedPatients, milestones, logs] = await Promise.all([
    prisma.patient.count({ where: { site_id: siteId } }),
    prisma.consentRecord.count({ where: { status: "GIVEN", patient: { site_id: siteId } } }),
    prisma.pathwayMilestone.findMany({
      where: { patient: { site_id: siteId } },
      select: {
        final_status: true,
        screened_within_1_month: true,
        diagnosed_within_3_months: true,
        intervention_within_6_months: true,
      },
    }),
    prisma.operationalLog.aggregate({
      where: { site_id: siteId },
      _sum: { total_births: true, total_screened: true },
    }),
  ]);

  const totalBirths = logs._sum.total_births ?? 0;
  const totalScreened = logs._sum.total_screened ?? 0;
  const totalMilestones = milestones.length;

  // Referrals to audiology
  const referredToAudiology = await prisma.referral.count({
    where: { type: "AUDIOLOGIST", patient: { site_id: siteId } },
  });

  // Returned for Screen 2
  const neededScreen2 = await prisma.screeningEvent.count({
    where: { stage: "SCREEN_1", result: "NOT_PASS", patient: { site_id: siteId } },
  });
  const completedScreen2 = await prisma.screeningEvent.count({
    where: { stage: "SCREEN_2", patient: { site_id: siteId } },
  });

  const ltfuCount = milestones.filter((m) => m.final_status === "LOST_TO_FOLLOWUP").length;
  const screened1mo = milestones.filter((m) => m.screened_within_1_month).length;
  const diagnosed3mo = milestones.filter((m) => m.diagnosed_within_3_months).length;
  const intervention6mo = milestones.filter((m) => m.intervention_within_6_months).length;

  const diagnosedCount = milestones.filter((m) => m.final_status === "DIAGNOSED").length;

  return NextResponse.json({
    coverage_rate: totalBirths > 0 ? totalScreened / totalBirths : 0,
    screened_by_1mo_rate: totalMilestones > 0 ? screened1mo / totalMilestones : 0,
    referral_rate: totalScreened > 0 ? referredToAudiology / totalScreened : 0,
    return_for_rescreen_rate: neededScreen2 > 0 ? completedScreen2 / neededScreen2 : 1,
    diagnosis_by_3mo_rate: referredToAudiology > 0 ? diagnosed3mo / referredToAudiology : 1,
    intervention_by_6mo_rate: diagnosedCount > 0 ? intervention6mo / diagnosedCount : 1,
    loss_to_followup_rate: totalMilestones > 0 ? ltfuCount / totalMilestones : 0,
    total_patients: totalPatients,
    total_screened: totalScreened,
    total_births: totalBirths,
    consented: consentedPatients,
  });
}

async function getFunnel(siteId: string) {
  const [totalPatients, consented, screen1done, screen2done, rescreenDone, audiologyReferral, diagnosed] = await Promise.all([
    prisma.patient.count({ where: { site_id: siteId } }),
    prisma.consentRecord.count({ where: { status: "GIVEN", patient: { site_id: siteId } } }),
    prisma.screeningEvent.groupBy({ by: ["patient_id"], where: { stage: "SCREEN_1", patient: { site_id: siteId } } }).then((r) => r.length),
    prisma.screeningEvent.groupBy({ by: ["patient_id"], where: { stage: "SCREEN_2", patient: { site_id: siteId } } }).then((r) => r.length),
    prisma.screeningEvent.groupBy({ by: ["patient_id"], where: { stage: "RESCREEN_POST_REFERRAL", patient: { site_id: siteId } } }).then((r) => r.length),
    prisma.referral.groupBy({ by: ["patient_id"], where: { type: "AUDIOLOGIST", patient: { site_id: siteId } } }).then((r) => r.length),
    prisma.diagnosticEvaluation.groupBy({ by: ["patient_id"], where: { patient: { site_id: siteId } } }).then((r) => r.length),
  ]);

  return NextResponse.json({
    data: [
      { name: "Total enrolled", value: totalPatients, fill: "#1d4ed8" },
      { name: "Consented", value: consented, fill: "#2563eb" },
      { name: "Screen 1 done", value: screen1done, fill: "#3b82f6" },
      { name: "Screen 2 done", value: screen2done, fill: "#60a5fa" },
      { name: "Rescreen done", value: rescreenDone, fill: "#93c5fd" },
      { name: "Audiology referral", value: audiologyReferral, fill: "#fbbf24" },
      { name: "Diagnosed", value: diagnosed, fill: "#f59e0b" },
    ].filter((d) => d.value > 0),
  });
}

async function getTrends() {
  const snapshots = await prisma.qualitySnapshot.findMany({
    orderBy: { period_start: "asc" },
    take: 24,
  });

  const data = snapshots.map((s) => ({
    period: new Date(s.period_start).toLocaleDateString("en-KE", { month: "short", year: "2-digit" }),
    coverage: Number(s.coverage_rate),
    referral: Number(s.referral_rate),
    ltfu: Number(s.loss_to_followup_rate),
    screened_by_1mo: Number(s.screened_by_1mo_rate),
  }));

  return NextResponse.json({ data });
}

async function getBarCharts(siteId: string) {
  const logs = await prisma.operationalLog.findMany({
    where: { site_id: siteId },
    orderBy: { log_date: "desc" },
    take: 30,
    select: {
      log_date: true,
      total_screened: true,
      total_missed: true,
      missed_discharged_early: true,
      missed_refused: true,
      missed_equipment_down: true,
      missed_staff_absent: true,
    },
  });

  const data = logs.reverse().map((l) => ({
    date: new Date(l.log_date).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
    screened: l.total_screened,
    missed: l.total_missed,
    missed_discharged_early: l.missed_discharged_early,
    missed_refused: l.missed_refused,
    missed_equipment_down: l.missed_equipment_down,
    missed_staff_absent: l.missed_staff_absent,
  }));

  return NextResponse.json({ data });
}

// §19 — Overdue thresholds for action-needed table
async function getActionNeeded(siteId: string) {
  const now = new Date();

  const flagged: Array<{
    patient_id: string;
    research_id: string;
    flag: string;
    urgency: "High" | "Critical";
    days_overdue: number;
  }> = [];

  // Pull all active patients with their latest screening/referral data
  const patients = await prisma.patient.findMany({
    where: {
      site_id: siteId,
      pathway_milestone: {
        final_status: { notIn: ["PASSED", "LOST_TO_FOLLOWUP"] },
      },
    },
    include: {
      pathway_milestone: true,
      screening_events: { orderBy: { tested_at: "desc" }, take: 10 },
      referrals: { orderBy: { referred_at: "desc" }, take: 10 },
    },
  });

  for (const p of patients) {
    const screenings = p.screening_events;
    const referrals = p.referrals;

    for (const ear of ["LEFT", "RIGHT"] as const) {
      const earScreenings = screenings.filter((s) => s.ear === ear);
      const earReferrals = referrals.filter((r) => r.ear === ear);

      const lastS1 = earScreenings.find((s) => s.stage === "SCREEN_1" && s.result === "NOT_PASS");
      const lastS2 = earScreenings.find((s) => s.stage === "SCREEN_2" && s.result === "NOT_PASS");
      const pendingHCP = earReferrals.find((r) => r.type === "HEALTH_CARE_PROVIDER" && r.status === "PENDING");
      const pendingAud = earReferrals.find((r) => r.type === "AUDIOLOGIST" && r.status === "PENDING");
      const cleared = earReferrals.find((r) => r.type === "HEALTH_CARE_PROVIDER" && ["CLEARED", "TREATED", "SEEN"].includes(r.status));

      // Screen 2 overdue: ear in SCREEN_1_FAILED AND days since Screen 1 > 18 (§19)
      if (lastS1) {
        const days = Math.floor((now.getTime() - lastS1.tested_at.getTime()) / 86400000);
        if (days > 18) {
          flagged.push({ patient_id: p.id, research_id: p.research_id, flag: `Screen 2 overdue (${ear} ear)`, urgency: "High", days_overdue: days - 18 });
        }
      }

      // HCP referral no response: > 14 days (§19)
      if (pendingHCP) {
        const days = Math.floor((now.getTime() - pendingHCP.referred_at.getTime()) / 86400000);
        if (days > 14) {
          flagged.push({ patient_id: p.id, research_id: p.research_id, flag: `HCP referral no response (${ear} ear)`, urgency: "High", days_overdue: days - 14 });
        }
      }

      // Rescreen overdue after clearance: > 14 days (§19)
      if (cleared) {
        const clearDate = cleared.resolved_at ?? cleared.referred_at;
        const days = Math.floor((now.getTime() - clearDate.getTime()) / 86400000);
        if (days > 14) {
          flagged.push({ patient_id: p.id, research_id: p.research_id, flag: `Rescreen overdue after clearance (${ear} ear)`, urgency: "High", days_overdue: days - 14 });
        }
      }

      // Audiology referral overdue: > 30 days (§19)
      if (pendingAud) {
        const days = Math.floor((now.getTime() - pendingAud.referred_at.getTime()) / 86400000);
        if (days > 30) {
          flagged.push({ patient_id: p.id, research_id: p.research_id, flag: `Audiology referral overdue (${ear} ear)`, urgency: days > 75 ? "Critical" : "High", days_overdue: days - 30 });
        }
      }
    }

    // Intervention not started: DIAGNOSED with hearing loss > 90 days (§19)
    if (p.pathway_milestone?.final_status === "DIAGNOSED") {
      const diagnoses = await prisma.diagnosticEvaluation.findMany({
        where: { patient_id: p.id, diagnosis: { not: "Normal" } },
        orderBy: { evaluated_at: "asc" },
        take: 1,
      });
      if (diagnoses[0]) {
        const days = Math.floor((now.getTime() - diagnoses[0].evaluated_at.getTime()) / 86400000);
        if (days > 90) {
          flagged.push({ patient_id: p.id, research_id: p.research_id, flag: "Intervention not started", urgency: "Critical", days_overdue: days - 90 });
        }
      }
    }
  }

  // PENDING_LTFU — all notifications exhausted
  const pendingLtfu = await prisma.pathwayMilestone.count({
    where: { patient: { site_id: siteId } },
  });

  return NextResponse.json({
    data: flagged.sort((a, b) => b.days_overdue - a.days_overdue),
    total: flagged.length,
  });
}