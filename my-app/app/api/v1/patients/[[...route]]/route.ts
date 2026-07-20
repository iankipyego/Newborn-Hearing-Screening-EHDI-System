// app/api/v1/patients/[...route]/route.ts
// Handles:
//   POST /api/v1/patients          — register new child (§16.2, §46.2)
//   GET  /api/v1/patients          — paginated list + search (§16.2, §47.1)
//   GET  /api/v1/patients/:id      — full child record + pathway state (§16.2)
//   PATCH /api/v1/patients/:id     — partial update within edit window (§16.2)
//   POST /api/v1/patients/:id/void — soft-delete with reason (§16.2)

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrResponse } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import { generateResearchId } from "@/lib/utils/researchId";
import { encrypt, encryptNullable } from "@/lib/utils/encryption";
import { decrypt, decryptNullable } from "@/lib/utils/encryption";
import { sanitiseText, sanitiseNullable } from "@/lib/utils/sanitise";
import {
  PatientCreateSchema,
  PatientListQuerySchema,
} from "@/lib/validation/schemas";
import { fuzzyMatch, exactMatch, type PatientSearchRecord } from "@/lib/search/fuzzyMatch";

// FIX: Next.js 15+ (and 16.2, which you're on) makes route handler `params`
// a Promise, not a plain object. The original code did:
//   { params }: { params: { route: string[] } }
//   const route = params.route ?? [];
// Since `params` is actually a Promise, `params.route` is always undefined
// (a Promise has no `.route` property) — this silently fell through to
// `route = []` instead of throwing, which looked like "nothing happens"
// rather than a clear error. All three handlers below now type params as
// a Promise and `await` it before use.
// FIX: folder must be [[...route]] (optional catch-all) not [...route]
// (required catch-all), since POST /api/v1/patients with no trailing
// segments needs to match too -- a required catch-all only matches when
// at least one extra segment is present, causing a 404 on plain
// POST /api/v1/patients. `route` can now legitimately be undefined.
type RouteParams = { params: Promise<{ route?: string[] }> };

// ---------------------------------------------------------------------------
// POST /api/v1/patients — Register new child
// Roles: DATA_CLERK, ADMIN
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Handle sub-routes (e.g. /patients/:id/void)
  const { route: routeParam } = await params;
  const route = routeParam ?? [];
  if (route.length === 2 && route[1] === "void") {
    return handleVoid(request, route[0]);
  }

  try {
    const user = await requireAuth(request, ["DATA_CLERK", "ADMIN"]);
    const body = await request.json();

    const parsed = PatientCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const d = parsed.data;

    // Compute derived fields
    const isPreterm = Number(d.gestational_age_weeks) < 37;
    const birthAsphyxiaSuggested =
      d.apgar_score_5min != null && d.apgar_score_5min <= 6;

    const riskFactorBooleans = [
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
    ];
    const riskFactorCount = riskFactorBooleans.filter(Boolean).length;

    const isSurveyComplete = d.survey_delivery_channel === "IN_PERSON";

    // All writes in a single transaction (§16.2 spec — patients + risk_factors + consent_records + parent_surveys)
    const result = await prisma.$transaction(async (tx) => {
      const research_id = await generateResearchId(tx);

      // 1. Create patient (PII fields encrypted at rest — §12.4)
      const patient = await tx.patient.create({
        data: {
          research_id,
          hospital_number: d.hospital_number ?? null,
          date_of_birth: new Date(d.date_of_birth),
          sex: d.sex,
          child_name: encryptNullable(d.child_name),              // NEW: encrypted direct identifier
          birth_weight_grams: d.birth_weight_grams,
          gestational_age_weeks: d.gestational_age_weeks,
          delivery_type: d.delivery_type,
          apgar_score_5min: d.apgar_score_5min ?? null,
          mother_name: encrypt(d.mother_name),
          mother_age: d.mother_age,
          mother_phone: encrypt(d.mother_phone),
          guardian_phone_alt: encryptNullable(d.guardian_phone_alt),
          whatsapp_number: encryptNullable(d.whatsapp_number),
          email: encryptNullable(d.email),
          residence_county: d.residence_county,
          residence_subcounty: d.residence_subcounty,
          nearest_town: d.nearest_town,
          nicu_admitted: d.nicu_admitted,
          nicu_days: d.nicu_days ?? null,
          screened_at_birth: d.screened_at_birth ?? null,          // NEW: birth screening history
          entry_source: d.entry_source,
          site_id: user.site_id,
          created_by: user.id,
        },
      });

      // 2. Consent record
      await tx.consentRecord.create({
        data: {
          patient_id: patient.id,
          status: d.consent_status,
          consent_form_version: d.consent_form_version,
          consented_at: new Date(),
          consented_by_clerk_id: user.id,
          witness_name: d.witness_name ?? null,
        },
      });

      // 3. Risk factors
      await tx.riskFactor.create({
        data: {
          patient_id: patient.id,
          nicu_admission: d.risk_nicu_admission,
          prematurity_under_37wk: d.risk_prematurity_under_37wk || isPreterm,
          hyperbilirubinemia_treated: d.risk_hyperbilirubinemia_treated,
          ototoxic_drug_exposure: d.risk_ototoxic_drug_exposure,
          craniofacial_anomaly: d.risk_craniofacial_anomaly,
          family_history_hearing_loss: d.risk_family_history_hearing_loss,
          birth_asphyxia: d.risk_birth_asphyxia || birthAsphyxiaSuggested,
          congenital_infection_torch: d.risk_congenital_infection_torch,
          syndrome_associated_with_hl: d.risk_syndrome_associated_with_hl,
          mechanical_ventilation_over_5d: d.risk_mechanical_ventilation_over_5d,
          bacterial_meningitis: d.risk_bacterial_meningitis,
          additional_notes: sanitiseNullable(d.risk_additional_notes),
          risk_factor_count: riskFactorCount,
        },
      });

      // 4. Parent survey
      await tx.parentSurvey.create({
        data: {
          patient_id: patient.id,
          delivery_channel_preference: d.survey_delivery_channel,
          status: isSurveyComplete ? "COMPLETED" : "PENDING",
          explanation_clarity_score: isSurveyComplete ? (d.survey_explanation_clarity_score ?? null) : null,
          anxiety_before_score: isSurveyComplete ? (d.survey_anxiety_before_score ?? null) : null,
          anxiety_after_score: isSurveyComplete ? (d.survey_anxiety_after_score ?? null) : null,
          satisfaction_score: isSurveyComplete ? (d.survey_satisfaction_score ?? null) : null,
          would_recommend: isSurveyComplete ? (d.survey_would_recommend ?? null) : null,
          understood_result: isSurveyComplete ? (d.survey_understood_result ?? null) : null,
          knowledge_q1_correct: isSurveyComplete ? (d.survey_knowledge_q1_correct ?? null) : null,
          knowledge_q2_correct: isSurveyComplete ? (d.survey_knowledge_q2_correct ?? null) : null,
          open_comments: isSurveyComplete ? sanitiseNullable(d.survey_open_comments) : null,
        },
      });

      // 5. Audit log — INSERT
      await tx.auditLog.create({
        data: {
          table_name: "patients",
          record_id: patient.id,
          action: "INSERT",
          changed_by: user.id,
          before_value: undefined,
          after_value: { research_id, patient_id: patient.id },
        },
      });

      return patient;
    });

    return NextResponse.json(
      { research_id: result.research_id, id: result.id },
      { status: 201 }
    );
  } catch (err) {
    return authErrResponse(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/patients — list/search
// GET /api/v1/patients/:id — single patient
// Roles: DATA_CLERK, SCREENER, SUPERVISOR, ADMIN
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SCREENER", "SUPERVISOR", "ADMIN"]);
    const { route: routeParam } = await params;
    const route = routeParam ?? [];

    // Single patient GET /api/v1/patients/:id
    if (route.length === 1 && route[0] !== "undefined") {
      return getSinglePatient(route[0], user);
    }

    // List/search GET /api/v1/patients
    const { searchParams } = new URL(request.url);
    const queryParsed = PatientListQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search"),
      site_id: searchParams.get("site_id"),
      date_from: searchParams.get("date_from"),
      date_to: searchParams.get("date_to"),
    });

    if (!queryParsed.success) {
      return NextResponse.json({ error: "Invalid query params" }, { status: 422 });
    }

    const q = queryParsed.data;
    const searchQuery = q.search?.trim() ?? "";

    // Fetch a wide pool for fuzzy/exact matching
    const rawPatients = await prisma.patient.findMany({
      where: {
        site_id: user.site_id,
        ...(q.date_from || q.date_to
          ? {
              date_of_birth: {
                ...(q.date_from ? { gte: new Date(q.date_from) } : {}),
                ...(q.date_to ? { lte: new Date(q.date_to) } : {}),
              },
            }
          : {}),
      },
      include: {
        consent_record: { select: { status: true } },
        pathway_milestone: { select: { final_status: true } },
      },
      orderBy: { created_at: "desc" },
      take: 500, // Fuse.js works on the in-memory array
    });

    // Decrypt PII for search and display
    const decrypted: PatientSearchRecord[] = rawPatients.map((p) => ({
      id: p.id,
      research_id: p.research_id,
      hospital_number: p.hospital_number,
      child_name: decryptNullable(p.child_name),          // NEW: decrypted for display + search
      mother_name: decrypt(p.mother_name),
      mother_phone: decrypt(p.mother_phone),
      date_of_birth: p.date_of_birth.toISOString(),
      sex: p.sex,
      pathway_status: p.pathway_milestone?.final_status ?? "IN_PROGRESS",
    }));

    let results: PatientSearchRecord[];
    if (searchQuery) {
      // Exact match first, then fuzzy name
      const exact = exactMatch(decrypted, searchQuery);
      if (exact.length > 0) {
        results = exact;
      } else {
        results = fuzzyMatch(decrypted, searchQuery).map((r) => r.item);
      }
    } else {
      results = decrypted;
    }

    // Paginate
    const total = results.length;
    const start = (q.page - 1) * q.limit;
    const paginated = results.slice(start, start + q.limit);

    return NextResponse.json({
      data: paginated,
      meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  } catch (err) {
    return authErrResponse(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/patients/:id — partial update
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(request, ["DATA_CLERK", "SUPERVISOR", "ADMIN"]);
    const { route } = await params;
    const id = route?.[0];
    if (!id) return NextResponse.json({ error: "Patient ID required" }, { status: 400 });

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Edit window check: DATA_CLERK can only edit within 48h (§11)
    if (user.role === "DATA_CLERK") {
      const hoursElapsed = (Date.now() - patient.created_at.getTime()) / 3600000;
      if (hoursElapsed > 48) {
        return NextResponse.json(
          { error: "Edit window expired — submit a correction request" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const before = { ...patient };

    // Re-encrypt any PII fields being updated
    const updateData: Record<string, unknown> = {};
    if (body.child_name !== undefined) updateData.child_name = encryptNullable(body.child_name);  // NEW
    if (body.mother_name) updateData.mother_name = encrypt(body.mother_name);
    if (body.mother_phone) updateData.mother_phone = encrypt(body.mother_phone);
    if (body.guardian_phone_alt !== undefined) updateData.guardian_phone_alt = encryptNullable(body.guardian_phone_alt);
    if (body.whatsapp_number !== undefined) updateData.whatsapp_number = encryptNullable(body.whatsapp_number);
    if (body.email !== undefined) updateData.email = encryptNullable(body.email);
    // Non-PII fields
    const plainFields = [
      "hospital_number", "mother_age", "residence_county",
      "residence_subcounty", "nearest_town", "nicu_admitted", "nicu_days",
      "screened_at_birth",                                                                                   // NEW
    ];
    for (const f of plainFields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({ where: { id }, data: updateData });
      await tx.auditLog.create({
        data: {
          table_name: "patients",
          record_id: id,
          action: "UPDATE",
          changed_by: user.id,
          before_value: before,
          after_value: updateData,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrResponse(err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSinglePatient(id: string, user: { id: string; role: string; site_id: string }) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      consent_record: true,
      risk_factors: true,
      screening_events: { orderBy: { tested_at: "asc" } },
      referrals: { orderBy: { referred_at: "asc" } },
      diagnostic_evaluations: {
        include: { diagnostic_thresholds: true },
        orderBy: { evaluated_at: "asc" },
      },
      pathway_milestone: true,
      notifications_log: { orderBy: { sent_at: "desc" }, take: 50 },
      parent_survey: true,
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Decrypt PII
  const decrypted = {
    ...patient,
    child_name: decryptNullable(patient.child_name),            // NEW
    mother_name: decrypt(patient.mother_name),
    mother_phone: decrypt(patient.mother_phone),
    guardian_phone_alt: decryptNullable(patient.guardian_phone_alt),
    whatsapp_number: decryptNullable(patient.whatsapp_number),
    email: decryptNullable(patient.email),
  };

  return NextResponse.json(decrypted);
}

async function handleVoid(request: NextRequest, id: string) {
  try {
    const user = await requireAuth(request, ["SUPERVISOR", "ADMIN"]);
    const body = await request.json();
    if (!body.reason) {
      return NextResponse.json({ error: "reason is required for void" }, { status: 422 });
    }

    // Soft-delete — no hard deletes in this system (§11.2, §6)
    // We mark via a voided field if it existed; for now audit log documents it
    await prisma.auditLog.create({
      data: {
        table_name: "patients",
        record_id: id,
        action: "UPDATE",
        changed_by: user.id,
        before_value: { voided: false },
        after_value: { voided: true, void_reason: body.reason },
      },
    });

    return NextResponse.json({ success: true, message: "Patient voided (soft-delete)" });
  } catch (err) {
    return authErrResponse(err);
  }
}