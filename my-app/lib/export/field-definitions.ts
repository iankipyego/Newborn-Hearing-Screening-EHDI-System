// lib/exports/field-definitions.ts
// Single source of truth for ALL exportable field definitions (§10).
// Every research export (CSV, SPSS, STATA, Excel) reads from this list.
// Fields with exportInclude: false are direct identifiers — they must
// NEVER appear in any research export, even if a future engineer adds a
// new export theme. This is enforced at the export query level, not by
// remembering to exclude them per-export.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeasurementScale = "nominal" | "ordinal" | "continuous" | "datetime" | "text";

export interface FieldDefinition {
  /** Column name in the exported file (snake_case) */
  name: string;
  /** Human-readable label for the data dictionary */
  label: string;
  /** Statistical measurement scale */
  scale: MeasurementScale;
  /** Plain-language description */
  description: string;
  /** JCIH 2019 or STROBE term this maps to, if any */
  jcihMapping: string;
  /** Allowed values for nominal/ordinal fields */
  allowedValues?: string[];
  /** If false, this field is EXCLUDED from all research exports */
  exportInclude: boolean;
  /** Which export theme(s) this field belongs to */
  themes: Array<
    | "demographics"
    | "risk_factors"
    | "pathway_timeline"
    | "operational"
    | "parent_experience"
    | "loss_to_followup"
    | "combined"
  >;
}

// ---------------------------------------------------------------------------
// Patient fields (§4.1)
// ---------------------------------------------------------------------------

const patientFields: FieldDefinition[] = [
  {
    name: "research_id",
    label: "Research ID",
    scale: "nominal",
    description: "System-generated pseudonymous identifier (e.g. MRH-2026-00001). The only identifier that appears in research exports.",
    jcihMapping: "N/A — study-specific",
    exportInclude: true,
    themes: ["demographics", "risk_factors", "pathway_timeline", "loss_to_followup", "combined"],
  },
  {
    name: "child_name",
    label: "Child's Name",
    scale: "nominal",
    description: "Child's given name, if provided at registration. Direct identifier — must never appear in research exports.",
    jcihMapping: "N/A — not a JCIH variable",
    exportInclude: false, // DIRECT IDENTIFIER — excluded from all exports
    themes: [],
  },
  {
    name: "hospital_number",
    label: "Hospital Number",
    scale: "nominal",
    description: "Hospital-assigned number, if available.",
    jcihMapping: "N/A — facility-specific",
    exportInclude: false, // Potentially identifiable
    themes: [],
  },
  {
    name: "date_of_birth",
    label: "Date of Birth",
    scale: "datetime",
    description: "Exact date and time of birth. Base for 'days to screening' calculations.",
    jcihMapping: "Age at screening calculation base",
    exportInclude: true,
    themes: ["demographics", "pathway_timeline", "combined"],
  },
  {
    name: "sex",
    label: "Sex",
    scale: "nominal",
    description: "Sex assigned at birth.",
    jcihMapping: "Demographic variable",
    allowedValues: ["Male", "Female"],
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "birth_weight_grams",
    label: "Birth Weight (grams)",
    scale: "continuous",
    description: "Birth weight in grams. Low birth weight is a risk indicator.",
    jcihMapping: "Risk indicator (indirect — via LBW < 2500g)",
    exportInclude: true,
    themes: ["demographics", "risk_factors", "combined"],
  },
  {
    name: "gestational_age_weeks",
    label: "Gestational Age (weeks)",
    scale: "continuous",
    description: "Gestational age at birth in weeks. < 37 weeks drives prematurity risk flag.",
    jcihMapping: "Prematurity risk indicator",
    exportInclude: true,
    themes: ["demographics", "risk_factors", "combined"],
  },
  {
    name: "delivery_type",
    label: "Delivery Type",
    scale: "nominal",
    description: "Mode of delivery.",
    jcihMapping: "Perinatal history",
    allowedValues: ["NVD", "C_Section", "Assisted_Vacuum_Forceps"],
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "apgar_score_5min",
    label: "Apgar Score at 5 Minutes",
    scale: "ordinal",
    description: "Apgar score at 5 minutes. ≤ 6 suggests birth asphyxia risk.",
    jcihMapping: "Birth asphyxia risk indicator",
    allowedValues: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    exportInclude: true,
    themes: ["demographics", "risk_factors", "combined"],
  },
  {
    name: "mother_name",
    label: "Mother's Name",
    scale: "nominal",
    description: "Mother/guardian full name. Direct identifier — must never appear in research exports.",
    jcihMapping: "N/A — direct identifier",
    exportInclude: false, // DIRECT IDENTIFIER
    themes: [],
  },
  {
    name: "mother_age",
    label: "Mother's Age",
    scale: "continuous",
    description: "Mother's age at time of child's birth.",
    jcihMapping: "Demographic variable",
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "mother_phone",
    label: "Mother's Phone",
    scale: "nominal",
    description: "Mother's primary phone number. Direct identifier — must never appear in research exports.",
    jcihMapping: "N/A — direct identifier",
    exportInclude: false, // DIRECT IDENTIFIER
    themes: [],
  },
  {
    name: "guardian_phone_alt",
    label: "Guardian Alternate Phone",
    scale: "nominal",
    description: "Alternate guardian phone. Direct identifier.",
    jcihMapping: "N/A — direct identifier",
    exportInclude: false, // DIRECT IDENTIFIER
    themes: [],
  },
  {
    name: "whatsapp_number",
    label: "WhatsApp Number",
    scale: "nominal",
    description: "WhatsApp contact number. Direct identifier.",
    jcihMapping: "N/A — direct identifier",
    exportInclude: false, // DIRECT IDENTIFIER
    themes: [],
  },
  {
    name: "email",
    label: "Email Address",
    scale: "nominal",
    description: "Email address. Direct identifier.",
    jcihMapping: "N/A — direct identifier",
    exportInclude: false, // DIRECT IDENTIFIER
    themes: [],
  },
  {
    name: "residence_county",
    label: "Residence County",
    scale: "nominal",
    description: "County of residence.",
    jcihMapping: "Geographic variable",
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "residence_subcounty",
    label: "Residence Sub-County",
    scale: "nominal",
    description: "Sub-county of residence.",
    jcihMapping: "Geographic variable",
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "nearest_town",
    label: "Nearest Town",
    scale: "nominal",
    description: "Nearest town to residence.",
    jcihMapping: "Geographic variable",
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "nicu_admitted",
    label: "NICU Admission",
    scale: "nominal",
    description: "Whether the baby was admitted to NICU.",
    jcihMapping: "NICU stay risk indicator",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["demographics", "risk_factors", "combined"],
  },
  {
    name: "nicu_days",
    label: "NICU Days",
    scale: "continuous",
    description: "Number of days in NICU. > 5 days triggers AABR requirement per JCIH 2019.",
    jcihMapping: "> 5 days = AABR required (auditory neuropathy risk)",
    exportInclude: true,
    themes: ["demographics", "risk_factors", "pathway_timeline", "combined"],
  },
  {
    name: "screened_at_birth",
    label: "Screened at Birth",
    scale: "nominal",
    description: "Whether the child received a hearing screening at the place of birth before registration at this facility.",
    jcihMapping: "Prior screening history",
    allowedValues: ["true", "false", "null (unknown)"],
    exportInclude: true,
    themes: ["demographics", "pathway_timeline", "combined"],
  },
  {
    name: "entry_source",
    label: "Entry Source",
    scale: "nominal",
    description: "Whether the record was entered live or re-entered from a paper backup form. Implementation/feasibility research variable.",
    jcihMapping: "N/A — implementation science variable",
    allowedValues: ["LIVE", "PAPER_BACKUP"],
    exportInclude: true,
    themes: ["operational", "combined"],
  },
];

// ---------------------------------------------------------------------------
// Risk factor fields (§4.3)
// ---------------------------------------------------------------------------

const riskFactorFields: FieldDefinition[] = [
  {
    name: "risk_nicu_admission",
    label: "NICU Admission Risk Flag",
    scale: "nominal",
    description: "NICU admission recorded as a JCIH risk indicator.",
    jcihMapping: "JCIH risk indicator — NICU stay",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_prematurity_under_37wk",
    label: "Prematurity (< 37 weeks)",
    scale: "nominal",
    description: "Gestational age < 37 weeks at birth.",
    jcihMapping: "JCIH risk indicator — prematurity",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_hyperbilirubinemia_treated",
    label: "Hyperbilirubinemia (treated)",
    scale: "nominal",
    description: "Treated hyperbilirubinemia.",
    jcihMapping: "JCIH risk indicator",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_ototoxic_drug_exposure",
    label: "Ototoxic Drug Exposure",
    scale: "nominal",
    description: "Exposure to ototoxic medications (e.g. aminoglycosides, loop diuretics).",
    jcihMapping: "JCIH risk indicator — ototoxicity",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_craniofacial_anomaly",
    label: "Craniofacial Anomaly",
    scale: "nominal",
    description: "Craniofacial anomaly present.",
    jcihMapping: "JCIH risk indicator — craniofacial",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_family_history_hearing_loss",
    label: "Family History of Hearing Loss",
    scale: "nominal",
    description: "Family history of permanent childhood hearing loss.",
    jcihMapping: "JCIH risk indicator — family history",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_birth_asphyxia",
    label: "Birth Asphyxia",
    scale: "nominal",
    description: "Birth asphyxia (Apgar ≤ 6 at 5 minutes, clinician-confirmed).",
    jcihMapping: "JCIH risk indicator — asphyxia",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_congenital_infection_torch",
    label: "Congenital Infection (TORCH)",
    scale: "nominal",
    description: "Congenital TORCH infection.",
    jcihMapping: "JCIH risk indicator — congenital infection",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_syndrome_associated_with_hl",
    label: "Syndrome Associated with Hearing Loss",
    scale: "nominal",
    description: "Known syndrome associated with hearing loss.",
    jcihMapping: "JCIH risk indicator — syndromic",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_mechanical_ventilation_over_5d",
    label: "Mechanical Ventilation > 5 Days",
    scale: "nominal",
    description: "Mechanical ventilation for more than 5 days.",
    jcihMapping: "JCIH risk indicator",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_bacterial_meningitis",
    label: "Bacterial Meningitis",
    scale: "nominal",
    description: "Bacterial meningitis diagnosis.",
    jcihMapping: "JCIH risk indicator — meningitis",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
  {
    name: "risk_factor_count",
    label: "Total Risk Factor Count",
    scale: "ordinal",
    description: "Count of JCIH risk factors present. Computed field for fast querying.",
    jcihMapping: "Summary statistic for regression models",
    exportInclude: true,
    themes: ["risk_factors", "combined"],
  },
];

// ---------------------------------------------------------------------------
// Pathway milestone fields (§4.7)
// ---------------------------------------------------------------------------

const pathwayFields: FieldDefinition[] = [
  {
    name: "days_birth_to_first_screen",
    label: "Days: Birth to First Screen",
    scale: "continuous",
    description: "Number of days between date of birth and first screening event.",
    jcihMapping: "1-3-6 benchmark: screened by 1 month",
    exportInclude: true,
    themes: ["pathway_timeline", "combined"],
  },
  {
    name: "screened_within_1_month",
    label: "Screened Within 1 Month",
    scale: "nominal",
    description: "Whether first screening occurred within 30 days of birth.",
    jcihMapping: "1-3-6 benchmark indicator",
    allowedValues: ["true", "false"],
    exportInclude: true,
    themes: ["pathway_timeline", "combined"],
  },
  {
    name: "final_status",
    label: "Pathway Final Status",
    scale: "nominal",
    description: "Current final status of the patient's screening pathway.",
    jcihMapping: "Outcome variable for STROBE flow diagram",
    allowedValues: ["PASSED", "IN_PROGRESS", "REFERRED_AUDIOLOGY", "DIAGNOSED", "LOST_TO_FOLLOWUP"],
    exportInclude: true,
    themes: ["pathway_timeline", "loss_to_followup", "combined"],
  },
];

// ---------------------------------------------------------------------------
// Diagnostic outcome fields (§4.6)
// ---------------------------------------------------------------------------

const diagnosticFields: FieldDefinition[] = [
  {
    name: "diagnosis",
    label: "Diagnostic Diagnosis",
    scale: "nominal",
    description: "Final audiologic diagnosis per ear.",
    jcihMapping: "Outcome variable — prevalence paper",
    allowedValues: ["Normal", "Conductive_loss", "Sensorineural_loss", "Mixed_loss", "Auditory_neuropathy"],
    exportInclude: true,
    themes: ["demographics", "pathway_timeline", "combined"],
  },
  {
    name: "degree",
    label: "Hearing Loss Degree",
    scale: "ordinal",
    description: "Degree of hearing loss if diagnosed.",
    jcihMapping: "Outcome variable",
    allowedValues: ["Mild", "Moderate", "Severe", "Profound"],
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
  {
    name: "laterality",
    label: "Laterality",
    scale: "nominal",
    description: "Whether hearing loss is unilateral or bilateral.",
    jcihMapping: "Outcome variable",
    allowedValues: ["Unilateral", "Bilateral"],
    exportInclude: true,
    themes: ["demographics", "combined"],
  },
];

// ---------------------------------------------------------------------------
// Consolidated
// ---------------------------------------------------------------------------

export const ALL_FIELD_DEFINITIONS: FieldDefinition[] = [
  ...patientFields,
  ...riskFactorFields,
  ...pathwayFields,
  ...diagnosticFields,
];

/** Fields safe for research export — excludes all direct identifiers */
export const EXPORTABLE_FIELDS = ALL_FIELD_DEFINITIONS.filter((f) => f.exportInclude);

/** Get fields for a specific export theme */
export function getFieldsForTheme(theme: FieldDefinition["themes"][number]): FieldDefinition[] {
  return EXPORTABLE_FIELDS.filter((f) => f.themes.includes(theme));
}

/** Generate a data dictionary rows for a given theme (for Excel/CSV sheet) */
export function generateDataDictionaryRows(
  theme: FieldDefinition["themes"][number]
): Array<Record<string, string>> {
  return getFieldsForTheme(theme).map((f) => ({
    variable_name: f.name,
    label: f.label,
    description: f.description,
    measurement_scale: f.scale,
    allowed_values: f.allowedValues?.join("; ") ?? "",
    jcih_strobe_mapping: f.jcihMapping,
  }));
}