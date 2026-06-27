# Context Pack: Phase 3 — Export + Publication Readiness
Builds: export portal, all 7 export themes, SPSS/Stata sidecar, data
dictionary generation, STROBE export.

Exit criteria: Researcher generates a CSV export of the risk factors theme
and a statistician confirms variable names/values are correct.

---
## 10. Research Export — detailed (Module 10)

The module table in §3 only gives this one line. Spelling it out fully here
because an under-specified export module is the easiest thing for a builder
to leave half-finished, and it's the module that actually turns this from
"a hospital database" into seven submittable manuscripts.

**Formats required:**
- CSV (universal)
- SPSS `.sav` (many co-authors/biostatisticians at African universities use
  SPSS by default)
- Stata `.dta` (common for epidemiology collaborators)
- Excel `.xlsx` (for quick non-technical review by the research team)

**Exports must be themed, not just "everything in one file"** — mirroring
the 7 planned papers so a researcher can pull exactly what they need:
1. **Demographics & prevalence export** — `patients` (de-identified) +
   `diagnostic_evaluations` outcomes
2. **Risk factors export** — `risk_factors` joined to final diagnosis, ready
   for regression
3. **Pathway timeline export** — every computed field from
   `pathway_milestones`, plus raw stage timestamps, for the 1-3-6 compliance
   paper
4. **Operational/cost export** — `operational_logs` rows over the study period
5. **Parent experience export** — `parent_surveys`
6. **Loss-to-follow-up export** — `notifications_log` joined to
   `pathway_milestones.final_status`, every contact attempt visible
7. **Full combined export** — everything joined by `research_id`, for
   exploratory analysis

**Every export must:**
- Use `research_id` only — never join to `patients.mother_name`/phone/email.
  Enforce this with a dedicated read-only database view (e.g.
  `v_export_patients`) that simply does not include identifier columns, so a
  future engineer can't accidentally add them back into an export query by
  reusing the raw table.
- Auto-attach a **data dictionary** as a separate sheet/file: variable name,
  plain-language definition, measurement scale (nominal/ordinal/continuous),
  allowed values, and the JCIH/STROBE term it maps to. Generate this from a
  single source-of-truth list of field definitions in code (not maintained by
  hand in two places), so it can never silently drift out of sync with the
  actual schema.
- Be filterable by date range and by site (once/if a second hospital is
  added — see §15 open question 4).

A brief note on **quality-improvement tracking** (ChatGPT's brief, §9 "build
a QI culture", PDSA cycles): this is a *process*, not primarily a data-capture
need, so it doesn't warrant its own complex schema — but a simple
`qi_review_log` table (date, reviewer, issue identified, action taken,
follow-up date) costs little to add and gives you a citable record of
continuous improvement for the implementation-science paper. Add it in Phase
3 alongside Operational Data if it's not already on your list.

---

## 21. Researcher Export UI Specification

The Researcher role sees a dedicated export portal — separate from the
clinical workflow UI. The portal has these screens:

### 21.1 Export home

- List of 7 export themes (§10) as cards, each with a brief description of
  what variables it contains and which paper it feeds
- Each card has a "Generate Export" button
- Below the cards: a table of previous exports (job ID, theme, format, generated
  by, generated at, status, download link if ready)
- Download links expire after 24 hours — expired links show a "Re-generate"
  button instead

### 21.2 Export configuration modal

Triggered when clicking "Generate Export" on any theme card:

- **Date range filter:** `From` and `To` date pickers (optional; defaults to
  all-time if left blank)
- **Site filter:** dropdown (single-site now, multi-site later)
- **Format selector:** radio group — CSV, SPSS (.sav), Stata (.dta), Excel (.xlsx)
- **Include data dictionary:** checkbox (default: checked) — attaches a
  separate variable definition file
- **Submit** button → queues background job → shows "Export queued" toast with
  job ID; user can leave and return

### 21.3 SPSS and Stata format requirements

Generating `.sav` and `.dta` from Node.js requires explicit tooling decisions:

**Option A (recommended):** Python sidecar script using the `pyreadstat`
library (`pip install pyreadstat`). Node.js calls the script via `child_process`
with the CSV data as input. `pyreadstat` can write proper `.sav` and `.dta`
files including variable labels, value labels, and measurement scales.

**Option B:** Use an external conversion service (e.g. Stat/Transfer API) —
adds external dependency and cost.

**Required metadata in SPSS/Stata output:**
- Variable label (plain-language definition from data dictionary)
- Value labels for all enum fields (e.g. `1 = Male`, `2 = Female`)
- Measurement scale (nominal/ordinal/scale)

A biostatistician must open and validate the output before any paper is
submitted — schedule this review at Phase 4 (§14).

---

## 38. STROBE Flow Diagram Data

> 🔴 **BLOCKER** — Every STROBE-compliant cohort paper requires a flow diagram.
> The system must produce all the numerators automatically.

### 38.1 Patient eligibility and exit fields (add to `patients`)

| Field | Type | Notes |
|---|---|---|
| `eligible` | boolean | Computed at intake from gestational age, live birth status |
| `ineligible_reason` | enum (STILLBIRTH/TRANSFERRED_OUT/GESTATIONAL_AGE_BELOW_CUTOFF/PARENTAL_REFUSAL_BEFORE_CONSENT/OTHER), nullable | Only set if `eligible = false`. Must be a coded enum — not free text — because each value is a cell in the STROBE flow diagram |
| `patient_exit_reason` | enum (COMPLETED_PATHWAY/LOST_TO_FOLLOWUP/TRANSFERRED_OUT/DECEASED/INELIGIBLE/CONSENT_WITHDRAWN), nullable | Set when the patient's pathway closes for any reason. Drives the STROBE flow diagram automatically |

**Critical distinction:** "VOIDED" (data entry error on a record) and "INELIGIBLE"
(baby actually not eligible) are different things. The `void` action on a patient
record (§16.2) is for data entry errors only. If a baby is ineligible, the record
is kept with `eligible = false` and `ineligible_reason` — it is never voided,
because ineligible cases must still be counted in the STROBE flow diagram.

### 38.2 STROBE export theme

Add an eighth export theme to the research export module (§10):

**Theme 8: STROBE Flow Diagram Data**

Produces a single table with the counts needed to populate a CONSORT/STROBE
flow diagram:

| Row label | Computation |
|---|---|
| Total live births in period | SUM of `operational_logs.live_births` |
| Total ineligible | COUNT where `patients.eligible = false` |
| Ineligible: stillbirth | COUNT where `ineligible_reason = STILLBIRTH` |
| Ineligible: transferred out | COUNT where `ineligible_reason = TRANSFERRED_OUT` |
| Ineligible: gestational age | COUNT where `ineligible_reason = GESTATIONAL_AGE_BELOW_CUTOFF` |
| Refused consent before approach | COUNT where `ineligible_reason = PARENTAL_REFUSAL_BEFORE_CONSENT` |
| Eligible and approached | COUNT where `eligible = true` |
| Consented | COUNT where `consent.status = GIVEN` |
| Consent refused | COUNT where `consent.status = REFUSED` AND `patient_exit_reason = CONSENT_WITHDRAWN` |
| Screened (Screen 1 complete) | COUNT with Screen 1 result ≠ INCOMPLETE |
| Passed Screen 1 | COUNT where both ears Screen 1 = PASS |
| Referred for Screen 2 | COUNT where any ear Screen 1 = NOT_PASS |
| Lost to follow-up post-Screen 1 | COUNT where `patient_exit_reason = LOST_TO_FOLLOWUP` after Screen 1 |
| Completed Screen 2 | COUNT with Screen 2 result |
| Passed Screen 2 | COUNT where both ears resolved after Screen 2 |
| Referred to HCP | COUNT where any ear Screen 2 = NOT_PASS |
| Completed diagnostic evaluation | COUNT with diagnostic evaluation |
| Diagnosed with hearing loss | COUNT where diagnosis confirms loss |
| Enrolled in early intervention | COUNT where `early_intervention_enrolled = true` |

---

## 39. Data Quality Flags and Interrater Reliability

### 39.1 Data completeness score (add to `pathway_milestones`)

| Field | Type | Notes |
|---|---|---|
| `data_completeness_score` | integer (0–100), computed | Percentage of required-for-regression fields that are non-null. Recomputed on each update |
| `analyst_exclusion_flag` | boolean, default false | Researcher flags this record as excluded from the primary analysis |
| `analyst_exclusion_reason` | text, nullable | Required if `analyst_exclusion_flag = true` |

The research export (§16.12) must include a derived column
`included_in_primary_analysis` (boolean):

```
included_in_primary_analysis = (
  consent.status = 'GIVEN'
  AND patients.eligible = true
  AND patient_exit_reason IS NULL OR patient_exit_reason = 'COMPLETED_PATHWAY'
  AND analyst_exclusion_flag = false
)
```

This means the statistician's dataset is correctly pre-filtered without any
manual steps.

### 39.2 Interrater reliability (add to `screening_events`)

Published EHDI feasibility papers are expected to report screener agreement.
Add:

| Field | Type | Notes |
|---|---|---|
| `double_screened` | boolean, default false | Whether a second screener independently confirmed this result (used in a QA sub-study) |
| `second_screener_id` | FK to users, nullable | Only set if `double_screened = true` |
| `second_screener_result` | enum (PASS/NOT_PASS/INCOMPLETE), nullable | Independent result from second screener |

This enables calculation of Cohen's kappa for the feasibility paper's quality
section.

---

## 40. Data Dictionary as Schema-Linked Living Document

> 🔴 **BLOCKER** — A manually maintained data dictionary drifts from the actual
> schema within weeks. The dictionary must be generated from the codebase.

### 40.1 Field metadata annotations

Every field that appears in a research export must have a machine-readable
annotation in a `fieldMetadata` object, stored in
`src/exports/fieldMetadata.ts`. This object is the single source of truth that
the export module reads to generate the data dictionary file.

Example structure:

```typescript
export const fieldMetadata: Record<string, FieldMeta> = {
  'patients.sex': {
    label: 'Sex of infant',
    scale: 'nominal',
    values: { Male: 1, Female: 2 },
    jcihTerm: null,
    strobeTerm: 'participant characteristic',
    includedInExports: ['demographics', 'risk_factors', 'combined', 'strobe_flowdiagram'],
  },
  'patients.gestational_age_weeks': {
    label: 'Gestational age at birth (weeks)',
    scale: 'continuous',
    values: null,
    jcihTerm: 'prematurity',
    strobeTerm: 'exposure variable',
    includedInExports: ['demographics', 'risk_factors', 'combined'],
  },
  // ... one entry per exported field
};

interface FieldMeta {
  label: string;                          // Plain-language variable name for SPSS/Stata
  scale: 'nominal' | 'ordinal' | 'continuous' | 'binary';
  values: Record<string, number> | null;  // Value labels for enum fields
  jcihTerm: string | null;                // JCIH 2019 term if applicable
  strobeTerm: string | null;              // STROBE checklist term if applicable
  includedInExports: string[];            // Which export themes include this field
}
```

### 40.2 CI check

Add a CI step (GitHub Actions or equivalent) that:
1. Reads all fields from the Prisma schema that are included in any export view
2. Checks each field against `fieldMetadata`
3. Fails the build if any field is missing an annotation

This enforces the rule: **no field enters the database without a corresponding
data dictionary entry**.

---

