// lib/validation/schemas.ts
// Single source of truth for all Zod schemas (§52.1).
// Used by both API route handlers and React Hook Form resolvers.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums (mirror Prisma enums for Zod validation)
// ---------------------------------------------------------------------------

export const SexSchema = z.enum(["Male", "Female"]);
export const DeliveryTypeSchema = z.enum(["NVD", "C_Section", "Assisted_Vacuum_Forceps"]);
export const EntrySourceSchema = z.enum(["LIVE", "PAPER_BACKUP"]);
export const ConsentStatusSchema = z.enum(["GIVEN", "REFUSED", "PENDING"]);
export const EarSchema = z.enum(["LEFT", "RIGHT"]);
export const ScreeningStageSchema = z.enum(["SCREEN_1", "SCREEN_2", "RESCREEN_POST_REFERRAL"]);
export const ScreeningModalitySchema = z.enum(["OAE", "AABR"]);
export const ProbeFitQualitySchema = z.enum(["Good", "Fair", "Poor"]);
export const AmbientNoiseLevelSchema = z.enum(["Low", "Medium", "High"]);
export const ScreeningResultSchema = z.enum(["PASS", "NOT_PASS", "INCOMPLETE"]);
export const VisualInspectionOutcomeSchema = z.enum(["PASS", "MINOR_ANOMALY", "PE_TUBE", "REFER_MEDICAL"]);
export const ReferralTypeSchema = z.enum(["HEALTH_CARE_PROVIDER", "AUDIOLOGIST"]);
export const DiagnosisAtReferralSchema = z.enum(["Otitis_media", "Blockage", "Infection", "Clear", "Other"]);
export const ReferralStatusSchema = z.enum(["PENDING", "CLEARED", "TREATED", "NO_SHOW", "SEEN"]);
export const EvaluationTypeSchema = z.enum(["ABR", "VRA", "CPA", "OAE"]);
export const DiagnosticDiagnosisSchema = z.enum(["Normal", "Conductive_loss", "Sensorineural_loss", "Mixed_loss", "Auditory_neuropathy"]);
export const HearingLossDegreeSchema = z.enum(["Mild", "Moderate", "Severe", "Profound"]);
export const LateralitySchema = z.enum(["Unilateral", "Bilateral"]);
export const SurveyDeliveryChannelSchema = z.enum(["IN_PERSON", "SMS", "WHATSAPP"]);
export const UserRoleSchema = z.enum(["DATA_CLERK", "SCREENER", "SUPERVISOR", "RESEARCHER", "ADMIN"]);
export const CorrectionStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const QiReviewStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]);

// ---------------------------------------------------------------------------
// Patient registration (§46.2 — all 5 sections)
// ---------------------------------------------------------------------------

export const PatientCreateSchema = z.object({
  // Section A — Baby info
  // FIX: z.string().datetime() requires a strict ISO 8601 string with seconds
  // AND a timezone (e.g. "2026-07-07T14:30:00Z"). <input type="datetime-local">
  // only ever returns "2026-07-07T14:30" (no seconds, no timezone), so it
  // failed validation on every valid entry. z.coerce.date() runs the value
  // through the native Date constructor instead, which parses that format
  // fine, and later serializes back to a full ISO string automatically when
  // sent to the API via JSON.stringify.
  date_of_birth: z.coerce.date({ message: "Valid datetime required" }),
  sex: SexSchema,

  // Child's name — optional because babies may be named days after birth (§4.1).
  // Direct identifier: encrypted at rest, excluded from research exports (§10, §11).
  child_name: z.string().min(1).max(150).nullable().optional(),

  // FIX: z.number() -> z.coerce.number(). HTML <input type="number"> always
  // hands back a string value; z.coerce.number() converts it to a real number
  // before running .int()/.min()/.max() checks, instead of rejecting it
  // outright with "Invalid input: expected number, received string".
  birth_weight_grams: z.coerce.number().int().min(200).max(8000),
  gestational_age_weeks: z.coerce.number().min(22).max(44),
  delivery_type: DeliveryTypeSchema,
  apgar_score_5min: z.coerce.number().int().min(0).max(10).nullable().optional(),
  hospital_number: z.string().max(50).nullable().optional(),
  nicu_admitted: z.boolean(),
  nicu_days: z.coerce.number().int().min(0).nullable().optional(),

  // Whether the child received a hearing screening at the place of birth
  // before being registered at this facility. Null if unknown.
  screened_at_birth: z.boolean().nullable().optional(),

  entry_source: EntrySourceSchema.default("LIVE"),

  // Section B — Mother/guardian
  mother_name: z.string().min(2).max(200),
  mother_age: z.coerce.number().int().min(10).max(80),
  mother_phone: z.string().min(7).max(20),
  guardian_phone_alt: z.string().max(20).nullable().optional(),
  whatsapp_number: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  residence_county: z.string().min(1).max(100),
  residence_subcounty: z.string().min(1).max(100),
  nearest_town: z.string().min(1).max(100),

  // Section C — Consent
  consent_status: ConsentStatusSchema,
  consent_form_version: z.string().min(1).max(50),
  witness_name: z.string().max(200).nullable().optional(),

  // Section D — Risk factors
  risk_nicu_admission: z.boolean(),
  risk_prematurity_under_37wk: z.boolean(),
  risk_hyperbilirubinemia_treated: z.boolean(),
  risk_ototoxic_drug_exposure: z.boolean(),
  risk_craniofacial_anomaly: z.boolean(),
  risk_family_history_hearing_loss: z.boolean(),
  risk_birth_asphyxia: z.boolean(),
  risk_congenital_infection_torch: z.boolean(),
  risk_syndrome_associated_with_hl: z.boolean(),
  risk_mechanical_ventilation_over_5d: z.boolean(),
  risk_bacterial_meningitis: z.boolean(),
  risk_additional_notes: z.string().max(2000).nullable().optional(),

  // Section E — Parent survey preferences
  survey_delivery_channel: SurveyDeliveryChannelSchema,
  // Scores only collected if IN_PERSON
  survey_explanation_clarity_score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  survey_anxiety_before_score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  survey_anxiety_after_score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  survey_satisfaction_score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  survey_would_recommend: z.boolean().nullable().optional(),
  survey_understood_result: z.boolean().nullable().optional(),
  survey_knowledge_q1_correct: z.boolean().nullable().optional(),
  survey_knowledge_q2_correct: z.boolean().nullable().optional(),
  survey_open_comments: z.string().max(5000).nullable().optional(),
});

export type PatientCreateInput = z.infer<typeof PatientCreateSchema>;

// ---------------------------------------------------------------------------
// Consent — standalone create/update, for patients registered without one
// (e.g. PAPER_BACKUP entry) or whose consent status needs correcting.
// Same field rules as PatientCreateSchema's Section C.
// ---------------------------------------------------------------------------
export const ConsentUpsertSchema = z.object({
  consent_status: ConsentStatusSchema,
  consent_form_version: z.string().min(1).max(50),
  witness_name: z.string().max(200).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Risk factors — standalone create/update, for patients registered without
// one. Same field rules as PatientCreateSchema's Section D.
// ---------------------------------------------------------------------------
export const RiskFactorUpsertSchema = z.object({
  risk_nicu_admission: z.boolean(),
  risk_prematurity_under_37wk: z.boolean(),
  risk_hyperbilirubinemia_treated: z.boolean(),
  risk_ototoxic_drug_exposure: z.boolean(),
  risk_craniofacial_anomaly: z.boolean(),
  risk_family_history_hearing_loss: z.boolean(),
  risk_birth_asphyxia: z.boolean(),
  risk_congenital_infection_torch: z.boolean(),
  risk_syndrome_associated_with_hl: z.boolean(),
  risk_mechanical_ventilation_over_5d: z.boolean(),
  risk_bacterial_meningitis: z.boolean(),
  risk_additional_notes: z.string().max(2000).nullable().optional(),
});

// Patient list query params
export const PatientListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),      // add .default(1)
  limit: z.coerce.number().min(1).max(100).default(20), // add .default(20)
  search: z.string().max(200).optional(),
  site_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Visual inspection (§2.1 — pre-OAE "Visual Inspection and Case History")
// ---------------------------------------------------------------------------

export const VisualInspectionCreateSchema = z.object({
  ear: EarSchema,
  outcome: VisualInspectionOutcomeSchema,
  finding_note: z.string().max(1000).nullable().optional(),
  screener_id: z.string().uuid(),
  inspected_at: z.string().datetime(),
  entry_source: EntrySourceSchema.default("LIVE"),
}).refine(
  (d) => d.outcome !== "REFER_MEDICAL" || (d.finding_note && d.finding_note.length > 0),
  { message: "finding_note is required when outcome is REFER_MEDICAL", path: ["finding_note"] }
);

export type VisualInspectionCreateInput = z.infer<typeof VisualInspectionCreateSchema>;

// ---------------------------------------------------------------------------
// Screening event (§16.5)
// ---------------------------------------------------------------------------

export const ScreeningEventCreateSchema = z.object({
  ear: EarSchema,
  stage: ScreeningStageSchema,
  modality: ScreeningModalitySchema,
  equipment_id: z.string().min(1).max(100),
  probe_fit_quality: ProbeFitQualitySchema.nullable().optional(),
  ambient_noise_level: AmbientNoiseLevelSchema,
  attempts: z.number().int().min(1).max(20),
  duration_minutes: z.number().min(0).max(300),
  result: ScreeningResultSchema,
  incomplete_reason: z.string().max(500).nullable().optional(),
  tested_at: z.string().datetime(),
  screener_id: z.string().uuid(),
  entry_source: EntrySourceSchema.default("LIVE"),
}).refine(
  (d) => d.result !== "INCOMPLETE" || (d.incomplete_reason && d.incomplete_reason.length > 0),
  { message: "incomplete_reason is required when result is INCOMPLETE", path: ["incomplete_reason"] }
);

export type ScreeningEventCreateInput = z.infer<typeof ScreeningEventCreateSchema>;

// ---------------------------------------------------------------------------
// Referral (§16.6)
// ---------------------------------------------------------------------------

export const ReferralCreateSchema = z.object({
  ear: EarSchema,
  type: ReferralTypeSchema,
  reason: z.string().min(1).max(500),
  provider_name: z.string().min(1).max(200),
  facility: z.string().min(1).max(200),
  diagnosis_at_referral: DiagnosisAtReferralSchema.nullable().optional(),
  treatment_given: z.string().max(500).nullable().optional(),
  medical_clearance_given: z.boolean().nullable().optional(),
  pe_tube_placed: z.boolean().nullable().optional(),
  status: ReferralStatusSchema.default("PENDING"),
});

export const ReferralUpdateSchema = z.object({
  status: ReferralStatusSchema,
  diagnosis_at_referral: DiagnosisAtReferralSchema.nullable().optional(),
  treatment_given: z.string().max(500).nullable().optional(),
  medical_clearance_given: z.boolean().nullable().optional(),
  pe_tube_placed: z.boolean().nullable().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
  provider_name: z.string().max(200).optional(),
  facility: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Diagnostic evaluation (§16.7)
// ---------------------------------------------------------------------------

export const DiagnosticEvalCreateSchema = z.object({
  ear: EarSchema,
  audiologist_name: z.string().min(1).max(200),
  facility: z.string().min(1).max(200),
  evaluation_type: EvaluationTypeSchema,
  evaluated_at: z.string().datetime(),
  diagnosis: DiagnosticDiagnosisSchema,
  degree: HearingLossDegreeSchema.nullable().optional(),
  laterality: LateralitySchema,
  hearing_aid_recommended: z.boolean(),
  hearing_aid_fitted_date: z.string().nullable().optional(),
  cochlear_implant_referral: z.boolean(),
  early_intervention_enrolled: z.boolean(),
  intervention_start_date: z.string().nullable().optional(),
  thresholds: z.array(z.object({
    frequency_hz: z.number().int(),
    threshold_db: z.number().int(),
    ear: EarSchema,
    test_type: z.enum(["AC", "BC"]),
  })).optional(),
});

// ---------------------------------------------------------------------------
// Operational log (§4.9)
// ---------------------------------------------------------------------------

export const OperationalLogCreateSchema = z.object({
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  total_births: z.number().int().min(0),
  total_screened: z.number().int().min(0),
  total_missed: z.number().int().min(0),
  missed_discharged_early: z.number().int().min(0).default(0),
  missed_refused: z.number().int().min(0).default(0),
  missed_equipment_down: z.number().int().min(0).default(0),
  missed_staff_absent: z.number().int().min(0).default(0),
  avg_screening_time_minutes: z.number().min(0).max(300),
  equipment_downtime_minutes: z.number().int().min(0),
  power_outage_minutes: z.number().int().min(0),
  probes_replaced: z.number().int().min(0),
  consumable_cost: z.number().min(0),
  staff_on_duty_count: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Correction request (§16.13, §20.3)
// ---------------------------------------------------------------------------

export const CorrectionRequestCreateSchema = z.object({
  table_name: z.string().min(1).max(100),
  record_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  proposed_value: z.record(z.unknown()),
});

export const CorrectionRequestReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer_note: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// User management (§16.14, §20.1)
// ---------------------------------------------------------------------------

export const UserCreateSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(20).nullable().optional(),
  role: UserRoleSchema,
  site_id: z.string().uuid(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  role: UserRoleSchema.optional(),
  active: z.boolean().optional(),
  phone: z.string().max(20).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Export (§16.12)
// ---------------------------------------------------------------------------

export const ExportGenerateSchema = z.object({
  theme: z.enum([
    "demographics",
    "risk_factors",
    "pathway_timeline",
    "operational",
    "parent_experience",
    "loss_to_followup",
    "combined",
    "strobe_flowdiagram",
  ]),
  format: z.enum(["CSV", "SPSS", "STATA", "EXCEL"]),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  site_id: z.string().uuid().optional(),
  include_data_dictionary: z.boolean().default(true),
});