# Mama Rachel Hospital — Newborn Hearing Screening (EHDI) System
## Technical Specification & Build Blueprint (v4.0)

**Purpose of this document:** This is a complete specification for a research-grade
clinical data system that supports a newborn/infant hearing screening (EHDI)
program intended to produce internationally publishable data. It is written to
be handed to any engineer or AI model to continue building from, independent
of who started it.

**Owner/engineer:** CHISHLO (software engineer building the system)
**Separate workstream (not covered here):** Ethics approval (IREC/NACOSTI),
consent form legal language, data management plan, journal manuscript writing
— handled by a separate research/paperwork team.

---

## HOW TO READ THIS DOCUMENT

This is a complete, self-contained specification for the Mama Rachel Hospital Newborn Hearing Screening (EHDI) system. No prior conversation, no external document, and no previous version of this file is needed to build from it.

**Who this document is for:**
- A solo engineer picking up the project for the first time
- An AI model (Claude, GPT-4, Gemini, etc.) being asked to generate code
- A development team building the system collaboratively

**How it is structured:**
- §1–5: What the system is, the clinical framework, module list, data model, and pathway logic — read these before touching any code
- §6–11: Data integrity rules, notifications, quality indicators, downtime handling, exports, and roles
- §12–15: Security, tech stack, build phases, and open questions for the clinical team
- §16–25: Full API contract, pathway state machine, notification schedules, and supporting detail
- §26–45: Pre-deployment security, legal compliance, scalability, and a go-live checklist
- §46–54: Role-based UI workflows, page inventory, child search, profile management, navigation, project structure, AI-readiness design, and updated build phases

**Key rule:** If you are an engineer or AI model and you are about to guess at something clinical (day-count windows, equipment delays, lost-to-follow-up cutoffs), stop. Those items are explicitly marked as requiring clinician sign-off. Guess at them and you will publish wrong numbers in a medical journal.

**What this system is NOT:**
- Not a school screening system. There is no school, no class, no grade, no teacher entity anywhere in this schema.
- Not a generic hospital management system. It does not manage wards, billing, or appointments.
- Not offline-first. No local sync engine, no conflict resolution. Paper backup is the only exception path (§9, §22).

---

---

## 1. What this system actually is

This is **not** a hospital management system and **not** a generic form
builder. It is a **longitudinal research instrument disguised as a clinical
workflow tool**. Every field exists because it will become a variable in a
statistical analysis for one of several planned journal papers. The system's
job is to make that data collection invisible to clinical staff while making
it bulletproof for researchers and ethics reviewers.

Two users interact with it day-to-day:
- **Screener** — performs the hearing test on the baby, observes the result.
- **Data clerk** — sits at a separate workstation, enters everything directly
  into the system in real time, based on a verbal/written handoff from the
  screener. **No paper forms in normal operation.**

A **third, exceptional** input path exists for downtime only (see §9).

### Operating assumptions (confirmed by the engineer/client)
- Power and internet at the hospital are **stable**. This is **not** an
  offline-first system. No local sync engine, no conflict resolution layer.
- Paper is used **only** during an actual outage, as a temporary safety net,
  and is re-entered into the system once service is restored. Every such
  record is **flagged** in the system (`entry_source = PAPER_BACKUP`), because
  that flag is itself a research variable (data completeness / implementation
  metric for the feasibility paper).
- A dedicated **data clerk**, not the screener, does data entry. This means
  forms can be thorough (10-15 min/baby) without disrupting clinical flow —
  unlike the earlier school-screening system built for this org, which had to
  optimize for screener speed.

---

## 2. Clinical/research framework this system must align with

- **JCIH 2019 Position Statement** (Joint Committee on Infant Hearing) — the
  international reference for EHDI quality indicators, risk indicators, and
  the 1-3-6 benchmark (screened by 1 month, diagnosed by 3 months, intervention
  by 6 months). All field names and computed indicators must map 1:1 to JCIH
  terminology so the "Methods" section of any paper can cite this directly.
- **STROBE guidelines** — govern how observational cohort studies are reported.
  The schema must capture every variable STROBE expects (clear inclusion
  criteria, exposure/outcome definitions, loss-to-follow-up accounting).
- **Important clinical nuance JCIH specifies and this system must encode:**
  babies who spent **>5 days in NICU** are at risk of **auditory neuropathy
  spectrum disorder**, which **OAE alone can miss** (OAE only tests outer
  hair cell function, not neural transmission). JCIH requires these babies be
  screened with **AABR (Automated Auditory Brainstem Response)**, not OAE
  alone. The pathway engine (§5) must therefore support **two screening
  modalities** (OAE and AABR) and **route NICU>5-day babies to AABR
  automatically** as a system-enforced rule, not a clerk judgment call. This
  is the single most clinically important difference from the earlier
  school-age OAE-only system.

---

## 3. Module list (high level)

| # | Module | One-line purpose |
|---|---|---|
| 1 | Identity & Consent | Generates research ID, gates all research data behind recorded consent |
| 2 | Patient Registration | Demographics, mother/guardian, delivery info |
| 3 | Risk Factor Assessment | Structured JCIH risk indicator checklist |
| 4 | Screening Pathway Engine | Per-ear OAE/AABR → referral → rescreen → audiology → diagnosis, fully timestamped |
| 5 | Notifications | SMS + WhatsApp + Email reminders, all attempts logged as research data |
| 6 | Operational Data | Daily counts, downtime, costs, staffing |
| 7 | Parent Survey | Short satisfaction/knowledge questionnaire |
| 8 | Quality Indicators Dashboard | Live JCIH 1-3-6 metrics computed from pathway timestamps |
| 9 | Audit Log | Immutable who/when/before/after on every change |
| 10 | Research Export | One-click anonymized export + auto-generated data dictionary |
| 11 | User & Role Management | Clerk / Screener / Supervisor / Researcher / Admin |

Modules 1-4 are the **core clinical record** and must be built first and
correctly — every other module reads from them. Getting the pathway engine's
data model wrong is the one mistake that cannot be cheaply fixed later, because
it would require migrating live patient timelines.

---

## 4. Detailed data model

This is described in plain field tables (not SQL) so it's portable to whatever
ORM/database the next builder chooses. Relational (PostgreSQL recommended,
see §13) is strongly preferred over document-store for this data shape.

### 4.1 `patients`
One row per baby — the central entity everything else links to.

| Field | Type | Notes |
|---|---|---|
| research_id | string (system-generated, e.g. `MRH-2026-00001`) | Primary identifier used in ALL exports. Never leaves the system attached to identity. |
| hospital_number | string, nullable | May not exist at birth; backfilled later |
| date_of_birth | datetime | Exact time matters — feeds "days to screening" calculation |
| sex | enum (Male/Female) | |
| birth_weight_grams | integer | |
| gestational_age_weeks | decimal | Drives prematurity flag |
| delivery_type | enum (NVD, C-Section, Assisted/Vacuum/Forceps) | |
| apgar_score_5min | integer, nullable | Used to derive birth asphyxia risk flag |
| mother_name | string | Identifiable — restricted field, see §11 |
| mother_age | integer | |
| mother_phone | string | Primary notification contact |
| guardian_phone_alt | string, nullable | |
| whatsapp_number | string, nullable | May differ from phone |
| email | string, nullable | |
| residence_county | string | |
| residence_subcounty | string | |
| nearest_town | string | |
| nicu_admitted | boolean | Drives AABR routing rule (§2) |
| nicu_days | integer, nullable | >5 days triggers AABR requirement |
| created_at / created_by | auto | |
| entry_source | enum (LIVE, PAPER_BACKUP) | Research/operational variable — see §9 |

### 4.2 `consent_records`
One row per patient (could extend to versioned history if consent withdrawn).

| Field | Type | Notes |
|---|---|---|
| patient_id | FK | |
| status | enum (GIVEN, REFUSED, PENDING) | **Hard gate** — see §11 |
| consent_form_version | string | Must match an approved IREC version |
| consented_at | datetime | |
| consented_by_clerk_id | FK to users | Who recorded it, not who gave it |
| witness_name | string, nullable | Some IRBs require this |

### 4.3 `risk_factors`
One row per patient — **structured booleans**, not free text, because each
becomes an independent predictor variable in the regression analysis for the
risk-factor paper.

| Field | Type |
|---|---|
| patient_id | FK |
| nicu_admission | boolean |
| prematurity_under_37wk | boolean (auto-derivable from gestational_age but stored explicitly for audit clarity) |
| hyperbilirubinemia_treated | boolean |
| ototoxic_drug_exposure | boolean |
| craniofacial_anomaly | boolean |
| family_history_hearing_loss | boolean |
| birth_asphyxia | boolean (auto-suggested from Apgar≤6, clerk confirms) |
| congenital_infection_torch | boolean |
| syndrome_associated_with_hl | boolean |
| mechanical_ventilation_over_5d | boolean |
| bacterial_meningitis | boolean |
| additional_notes | text, optional, NOT used as a coded variable |
| risk_factor_count | integer, computed | Stored for fast querying |

### 4.4 `screening_events`
One row per *test session* (a baby can have several across the pathway).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| patient_id | FK | |
| ear | enum (LEFT, RIGHT) | **Independent per ear — never combine** |
| stage | enum (SCREEN_1, SCREEN_2, RESCREEN_POST_REFERRAL) | Generic stage names — see §5 for why this differs from the school system's OAE1/2/3 labels |
| modality | enum (OAE, AABR) | System-enforced per §2 NICU rule |
| equipment_id | string | |
| probe_fit_quality | enum (Good, Fair, Poor) | OAE-specific; null for AABR |
| ambient_noise_level | enum (Low, Medium, High) | |
| attempts | integer | |
| screener_id | FK to users | |
| duration_minutes | decimal | **Time taken for this specific screening** — ChatGPT's brief asked for this per-screening, distinct from the daily *average* in `operational_logs` (§4.9); needed for the cost-effectiveness paper's per-baby time data |
| result | enum (PASS, NOT_PASS, INCOMPLETE) | |
| incomplete_reason | string, nullable | required if result = INCOMPLETE |
| tested_at | datetime (system clock, not manually typed) | **Auto-timestamp — see §6 governance rule** |
| recorded_at | datetime | When the clerk saved it (may differ from tested_at if delayed) |

### 4.5 `referrals`
One row per referral event in the pathway.

| Field | Type | Notes |
|---|---|---|
| patient_id, ear | FK | |
| type | enum (HEALTH_CARE_PROVIDER, AUDIOLOGIST) | |
| reason | string | Auto-filled from the triggering screening_event |
| referred_at | datetime, auto | |
| provider_name / facility | string | |
| diagnosis_at_referral | enum (Otitis media, Blockage, Infection, Clear, Other) | HCP referrals only |
| treatment_given | string, nullable | |
| medical_clearance_given | boolean, nullable | |
| pe_tube_placed | boolean, nullable | |
| resolved_at | datetime, nullable | |
| status | enum (PENDING, CLEARED, TREATED, NO_SHOW, SEEN) | |

### 4.6 `diagnostic_evaluations`
One row per ear that reaches full audiologic workup.

| Field | Type |
|---|---|
| patient_id, ear | FK |
| audiologist_name / facility | string |
| evaluation_type | enum (ABR, VRA, CPA, OAE) |
| evaluated_at | datetime |
| diagnosis | enum (Normal, Conductive loss, Sensorineural loss, Mixed loss, Auditory neuropathy) |
| degree | enum (Mild, Moderate, Severe, Profound), nullable |
| laterality | enum (Unilateral, Bilateral) |
| hearing_aid_recommended | boolean |
| hearing_aid_fitted_date | date, nullable |
| cochlear_implant_referral | boolean |
| early_intervention_enrolled | boolean |
| intervention_start_date | date, nullable |

### 4.7 `pathway_milestones` (derived/computed table — the 1-3-6 engine)
This is **not manually entered**. It's computed automatically every time a
screening_event, referral, or diagnostic_evaluation is saved, by reading
timestamps from the tables above. Store it as a materialized/cached table per
patient so the dashboard doesn't recompute on every page load.

| Field | Type |
|---|---|
| patient_id | FK |
| days_birth_to_first_screen | integer |
| days_first_screen_to_screen2 | integer, nullable |
| days_screen2_to_referral | integer, nullable |
| days_referral_to_clearance | integer, nullable |
| days_clearance_to_rescreen | integer, nullable |
| days_audiology_referral_to_eval | integer, nullable |
| days_diagnosis_to_intervention | integer, nullable |
| screened_within_1_month | boolean |
| diagnosed_within_3_months | boolean (only relevant if referred) |
| intervention_within_6_months | boolean (only relevant if diagnosed with loss) |
| final_status | enum (PASSED, IN_PROGRESS, REFERRED_AUDIOLOGY, DIAGNOSED, LOST_TO_FOLLOWUP) |

### 4.8 `notifications_log`
One row per send attempt (not per reminder — every attempt across every
channel, because this is the raw data for the loss-to-follow-up paper).

| Field | Type |
|---|---|
| patient_id | FK |
| trigger_reason | enum (matches referral/rescreen scheduling events) |
| channel | enum (SMS, WHATSAPP, EMAIL) |
| language | enum (en, sw) |
| sent_at | datetime |
| delivery_status | enum (QUEUED, SENT, DELIVERED, FAILED) |
| provider_message_id | string, nullable |
| message_content | text (store the literal sent text, for audit) |

### 4.9 `operational_logs`
One row per day per hospital site.

| Field | Type |
|---|---|
| log_date | date |
| total_births | integer |
| total_screened | integer |
| total_missed | integer |
| missed_reasons | structured breakdown (discharged early / refused / equipment down / staff absent) — store as separate count columns, not free text |
| avg_screening_time_minutes | decimal |
| equipment_downtime_minutes | integer |
| power_outage_minutes | integer |
| probes_replaced | integer |
| consumable_cost | decimal |
| staff_on_duty_count | integer |
| recorded_by | FK to users |

### 4.10 `parent_surveys`
One row per patient. Administration is **not limited to pre-discharge in
person** — the parent chooses how they'd rather answer (§4.10.1), and the
survey can be completed at the facility, or later via SMS/WhatsApp.

| Field | Type |
|---|---|
| patient_id | FK |
| delivery_channel_preference | enum (IN_PERSON, SMS, WHATSAPP) |
| status | enum (PENDING, COMPLETED, NO_RESPONSE) |
| attempts_sent | integer, default 0 | Only relevant for SMS/WHATSAPP — see §4.10.1 |
| last_attempt_at | datetime, nullable |
| explanation_clarity_score | integer 1-5 |
| anxiety_before_score | integer 1-5 |
| anxiety_after_score | integer 1-5 |
| satisfaction_score | integer 1-5 |
| would_recommend | boolean |
| understood_result | boolean |
| knowledge_q1_correct | boolean |
| knowledge_q2_correct | boolean |
| open_comments | text |

#### 4.10.1 Channel preference and retry policy

At registration or discharge, the clerk asks the parent how they'd prefer to
answer the satisfaction survey: **in person** (clerk administers it on the
spot, `status` goes straight to `COMPLETED`), or remotely via **SMS** or
**WhatsApp** (a link or a structured text-based Q&A is sent after discharge).

For the remote channels, this follows the same retry discipline as the
notification series in §18, by design — one source of truth for "how many
times do we try before giving up":

1. **First attempt** sent at discharge (or shortly after).
2. **If no response**, **one follow-up reminder** is sent (a single retry,
   not the longer multi-step series used for clinical notifications in §18 —
   a survey is lower-stakes than a missed referral, so the retry budget is
   intentionally short).
3. **If still no response after the second attempt**, `status` is set to
   `NO_RESPONSE` and **no further attempts are made.** This is a deliberate
   stop, not a bug — repeatedly messaging a parent who hasn't responded to a
   satisfaction survey is a poor use of the same SMS/WhatsApp channel that
   carries actually-important clinical reminders.

`NO_RESPONSE` is itself a publishable data point for the parent-experience
paper (response rate by channel), so it's tracked, not just silently dropped.

### 4.11 `quality_snapshots`
Computed monthly/quarterly, stored (not recalculated on the fly) so trends
over time survive even if underlying calculation logic changes later.

| Field | Type |
|---|---|
| period_start / period_end | date |
| coverage_rate | decimal | births screened ÷ total births |
| screened_by_1mo_rate | decimal |
| referral_rate | decimal |
| return_for_rescreen_rate | decimal |
| diagnosis_by_3mo_rate | decimal |
| intervention_by_6mo_rate | decimal |
| loss_to_followup_rate | decimal |

### 4.12 `audit_log`
Append-only. No update, no delete, ever — enforce this at the database
permission level, not just application logic.

| Field | Type |
|---|---|
| table_name, record_id | string |
| action | enum (INSERT, UPDATE) — never DELETE in this system; use soft-delete/status flags instead |
| changed_by | FK to users |
| changed_at | datetime |
| before_value | JSON |
| after_value | JSON |

### 4.13 `users`
| Field | Type |
|---|---|
| name, email, phone | string |
| password_hash | string |
| role | enum (DATA_CLERK, SCREENER, SUPERVISOR, RESEARCHER, ADMIN) |
| active | boolean |

---

## 5. The pathway engine — decision logic (the clinical core)

This must be built as **pure, dependency-free logic** (no database calls
inside the decision functions themselves) so it can be reviewed line-by-line
against the protocol by a non-engineer (your clinical/research lead) and unit
tested in isolation. This was the most valuable single file in the earlier
school-screening build — replicate that pattern here.

**Per-ear state machine** (mirrors the ECHO/NCHAM protocol, adapted for the
NICU/AABR rule from §2):

1. **Risk check at intake** → if `nicu_days > 5`, modality = AABR for this ear
   for all subsequent stages. Otherwise OAE, matching the JCIH evidence base.
2. **Screen 1** → PASS: ear resolved. NOT_PASS: schedule Screen 2 (~2 weeks,
   exact window should be confirmed with your clinical lead and may differ
   from the school protocol's 2-week window for newborns).
3. **Screen 2** → PASS: ear resolved. NOT_PASS: refer to health care provider.
4. **HCP referral resolution** → outcomes: CLEARED (rescreen immediately),
   OTITIS_MEDIA/treated (rescreen after a clinically-defined delay), PE_TUBE
   placed (rescreen after a shorter delay), NO_SHOW (rescreen anyway after a
   defined window, document as a "no-show" event for the loss-to-follow-up
   paper — **do not silently drop the case**).
5. **Rescreen** → PASS: ear resolved. NOT_PASS: refer to audiologist.
6. **Diagnostic evaluation** → produces the final diagnosis, which is the
   actual outcome variable for the prevalence and risk-factor papers.

**Episode completion rule:** identical principle to the school system — a
patient's screening pathway is only "complete" when every ear is either
resolved (passed at some stage) or has a diagnostic evaluation on file. This
rule should be enforced in code, not left to dashboard reporting, because it
is the basis of the loss-to-follow-up calculation.

**Open clinical decisions to confirm with your supervising audiologist/IREC
before finalizing exact day-counts** (do not let an AI model or engineer guess
these — they need a clinician's sign-off since they'll appear in the methods
section of a published paper):
- Exact day window for Screen 1 → Screen 2 in a newborn population (may not be
  the same 2 weeks used in the school-age protocol)
- Exact rescreen delay after otitis media treatment in neonates
- Cutoff definitions for "lost to follow-up" (e.g. no contact after how many
  attempts, over what time window)

---

## 6. Non-negotiable data integrity rules

These rules exist because a reviewer at JEHDI/BMC Pediatrics or an IREC
auditor will specifically check for them. Bake them into the system, don't
treat them as "nice to have":

1. **Every pathway timestamp is system-generated**, not typed in by a clerk.
   The clerk enters the *result*; the system stamps *when* it was saved. If a
   test happened earlier than entry (e.g. paper-backup catch-up), capture
   both `tested_at` (clerk-entered, clearly labeled as such) and
   `recorded_at` (system clock) — never conflate the two.
2. **No record is research-eligible without consent = GIVEN.** Build this as
   an enforced query filter on every export, not a manual checklist.
3. **No hard deletes anywhere.** Use status/soft-delete flags. A "corrected"
   record should show its correction history in the audit log, not silently
   overwrite the truth.
4. **Pseudonymization is structural, not a setting.** The export module
   should be physically incapable of joining `research_id` back to
   `mother_name`/`phone` — enforce this with separate database views or
   access-controlled joins, not just "remember not to include that column."
5. **Risk factors and diagnoses use closed vocabularies (enums), never free
   text**, except for an explicitly-excluded notes field that is never
   exported as a coded variable.

---

## 7. Notifications module — same pattern as the school system, adapted

Channels: **SMS (Africa's Talking) primary, WhatsApp (Meta Cloud API)
secondary, Email (SMTP) tertiary** — same provider choices as the school
system build, reused for consistency and because they're already proven to
work in this context.

Differences from the school system:
- Every send attempt (not just outcome) is a row in `notifications_log` —
  this is itself a research variable (§4.8), not just an operational log.
- Messages should be sent in escalating frequency as a milestone approaches
  (e.g. at scheduling, 3 days before, day before, day-of-if-missed) per the
  ChatGPT brief — more aggressive cadence than the school system, because
  newborn follow-up windows are shorter and loss-to-follow-up is a named
  outcome you're publishing on.
- WhatsApp templates must still go through Meta's approval process before
  go-live — same caveat as before, plan for a day or two of lead time.

---

## 8. Quality indicators — exact JCIH-aligned formulas

| Indicator | Formula | Target |
|---|---|---|
| Screening coverage | screened ÷ total live births | >95% |
| Screened before 1 month | (screened AND days_birth_to_first_screen ≤ 30) ÷ screened | >95% |
| Referral rate | referred_to_audiologist ÷ total screened | <4-5% |
| Return for rescreen | completed Screen 2 ÷ those needing it | >90% |
| Diagnostic eval by 3 months | (evaluated AND days ≤ 90) ÷ referred to audiology | >90% |
| Early intervention by 6 months | (intervention started AND days ≤ 180) ÷ diagnosed with loss | >90% |
| Loss to follow-up | patients with final_status = LOST_TO_FOLLOWUP ÷ total in pathway | <10% |

These should be computed **only** from `pathway_milestones` (§4.7), never
recalculated ad hoc in the dashboard — one source of truth, one set of
definitions, citeable directly in a methods section.

### 8.1 Dashboard UI — what staff actually see

The previous version of this spec only listed the formulas above and never
described the dashboard's actual visual layout. Specifying that now, since
"build a dashboard" is meaningless to an AI model or engineer without a
concrete list of what's on the screen:

- **KPI summary cards** at the top — one card per indicator in the table
  above, each showing the current rate, the JCIH target, and a colored
  status (green/amber/red against target) at a glance.
- **Pathway funnel chart** — a visual funnel mirroring the original protocol
  flowchart shape (100% screened → X% needing Screen 2 → X% referred → <1%
  to audiologist), built from live counts rather than the protocol
  document's illustrative percentages. This is the single most useful chart
  for a supervisor doing a quick health-check of the program, and it doubles
  as a publication-ready figure for the feasibility paper.
- **Trend line charts** — coverage rate, referral rate, and loss-to-follow-up
  rate plotted monthly over the life of the study, pulled from
  `quality_snapshots` (§4.11) so the trend survives even if the underlying
  calculation logic is later refined.
- **Bar charts** — screenings per day/week (operational volume), missed
  screenings broken down by reason (refused / equipment down / discharged
  early / staff absent — directly from `operational_logs`), and referral
  reasons by category.
- **Action-needed table** — a live list of patients with an overdue reminder
  or a pending referral past its expected resolution window, so supervisors
  can intervene before a case becomes a loss-to-follow-up statistic, not
  just discover it later in a report.
- **Drill-down** — clicking any chart segment or table row opens that
  patient's full timeline (same pattern as the earlier school-screening
  system's child detail page).

Chart library choice is an implementation detail, not a research-integrity
concern — Recharts or Chart.js both work fine within the Next.js/React stack
already recommended (§13).

---

## 9. Downtime / paper-backup handling (corrected from the earlier brief)

Since infrastructure here is stable, this is a small, well-defined exception
path — not a parallel system:

- A single, simple **one-page backup form per baby** (the minimum fields
  needed to not lose a screening: research ID/hospital number if assigned,
  ear, modality, result, screener, date/time) is kept on hand for outages.
- When the system is back up, the clerk enters that record with
  `entry_source = PAPER_BACKUP` and the **actual** test time (not the entry
  time) in `tested_at`.
- The system should track and report **how often** and **how long** this
  happens — that's a genuine, citable operational metric (cost-effectiveness
  and feasibility papers), not just a footnote.
- No offline-capable frontend, no local database, no sync engine needed.
  This removes a large amount of engineering complexity that the earlier
  (incorrect) brief implied was necessary.

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

## 11. Roles & access control

| Role | Can do |
|---|---|
| Data Clerk | Create/edit patient records, screenings, referrals, surveys, operational logs. Edit window limited (e.g. 24-48h) after which changes require Supervisor approval and are logged. |
| Screener | View-only access to records, mainly to verify what the clerk entered matches what happened. |
| Supervisor | Full read access, can flag records for review, run reports, approve late edits. |
| Researcher | **Anonymized export only.** No access to mother_name, phone, email, or any direct identifier — enforced at the database/view level. |
| Admin | Full access including audit log (read-only even for admin) and user management. |

This table covers *what* each role can do. §12 below covers *how* that's
actually enforced and protected — the previous version of this spec only had
a two-line note here, which undersells how much this matters for a system
that will be cited as the data source behind published medical research.

### 11.1 Per-module permission matrix

The table above is a summary. Here's the explicit breakdown by module, since
"full access" and "edit" mean different things in different places:

| Module | Data Clerk | Screener | Supervisor | Researcher | Admin |
|---|---|---|---|---|---|
| Patient Registration | Create, edit (within window) | View | View, approve late edits | No access | Full |
| Risk Factors | Create, edit (within window) | View | View, approve late edits | No access | Full |
| Screening Pathway | Create, edit (within window) | View, **flag for correction** | View, approve late edits, resolve flags | No access | Full |
| Referrals / Diagnostic Eval | Create, edit (within window) | View | View, approve late edits | No access | Full |
| Notifications | View (read-only; system-generated) | No access | View, manually trigger resend | No access | Full |
| Operational Logs | Create, edit (within window) | No access | View, edit | No access | Full |
| Parent Survey | Create, edit (within window) | No access | View | No access | Full |
| Quality Dashboard | View | View | View, drill down | View (aggregate only, no patient-level drill-down) | Full |
| Research Export | No access | No access | No access | **Generate exports** | Full |
| Audit Log | No access | No access | View | No access | View only (no one can edit/delete it, including Admin) |
| User Management | No access | No access | No access | No access | Full |

**Note on Screener's role** — given your actual workflow (screener performs
the test, data clerk enters it), the Screener doesn't create records
directly. But the Screener is often the *first* person to realize an entry
is wrong (e.g. "I tested the right ear, the clerk logged it as left"). The
matrix above gives Screener a **"flag for correction"** action — not edit
access, but a lightweight way to mark a specific record for the
Supervisor/Clerk to fix, with a reason note. Without this, an observed error
has no path back into the system until someone happens to notice it later.

### 11.2 Correcting a mistaken entry — directly answering "can a record be deleted?"

**No record is ever hard-deleted, by any role, including Admin.** This is
intentional and matters specifically because this is research data: a
silently deleted record undermines the integrity of the whole dataset (a
reviewer can reasonably ask "how do we know records weren't selectively
removed to improve your numbers?"). Instead:

1. **Within the edit window** (e.g. 24-48h after creation): the Data Clerk
   can edit the record directly. The audit log (§4.12) stores the before and
   after values automatically — nothing is lost, the correction is just
   visible in the history.
2. **After the edit window**: editing requires Supervisor approval. The
   Clerk submits a correction request; the Supervisor approves or rejects it;
   either way it's logged.
3. **A record that should never have existed** (e.g. entered for the wrong
   baby entirely) is **soft-deleted** — marked with a status flag
   (`status = VOIDED`, with a required reason) rather than removed from the
   table. It simply gets excluded from active views and research exports
   going forward, but remains in the database and audit trail forever. This
   is the closest equivalent to "delete" this system should ever offer.

This is the same governance rule already stated generally in §6 — restated
here specifically because "can a screener delete a wrong session" is exactly
the kind of question an IREC reviewer or journal will also ask, so it's
worth having an unambiguous, citable answer.

---

## 12. Security & Data Protection

This section was thin in the previous version of this spec (one paragraph).
Given this system handles newborn health data and will underpin journal
submissions, security needs to be treated as a first-class module, not an
afterthought bolted on near launch. Everything below should be built in
Phase 1-2 (§14), not retrofitted later — retrofitting auth/encryption onto a
live patient database is far riskier than building it in from day one.

### 12.1 Authentication, including 2FA (your explicit requirement)

- **Two-factor authentication is mandatory for every role**, not just
  Admin — a compromised Data Clerk or Screener account can still expose or
  corrupt patient data. Use **TOTP (Time-based One-Time Password)** via a
  standard authenticator app (Google Authenticator, Authy, etc.) as the
  primary 2FA method — it works offline once set up, which matters if mobile
  network reliability ever dips, and avoids SIM-swap risk.
- **SMS-based 2FA should only be a fallback**, not the primary method — SIM
  swap attacks are a real risk in Kenya and SMS OTP is weaker than TOTP.
  Offer it as a secondary recovery option, not the default.
- **Enforce 2FA at login, every session** — not "remember this device"
  indefinitely. A reasonable middle ground: trust a device for 7-30 days,
  then require re-verification.
- **Password policy**: minimum length (12+ characters) rather than complex
  character-class rules (which push people toward predictable patterns),
  checked against a breached-password list (e.g. via the HaveIBeenPwned API
  range query) at creation/reset time, hashed with **bcrypt or argon2** (the
  schema in §4.13 already specifies `password_hash`).
- **Account lockout / brute-force protection**: lock or progressively delay
  login attempts after ~5 failures (e.g. exponential backoff), and log every
  failed attempt. Pair this with rate limiting at the API gateway level (see
  12.3) so a script can't hammer the login endpoint directly.
- **Session management**: short-lived JWT access tokens (e.g. 15-30 min)
  with refresh token rotation, not one long-lived token — limits the damage
  window if a token is ever intercepted. The 15-minute idle timeout already
  noted in §11 still applies on top of this.

### 12.2 Authorization — defending against role/privilege attacks

- **Enforce roles at the API layer, never trust the frontend.** Every API
  route must independently re-check the caller's role server-side (the
  existing `requireRole()` pattern from the earlier school-screening build is
  the right approach — reuse it). A hidden button is not access control.
- **Principle of least privilege by default**: new accounts start with the
  lowest viable role; elevation requires an existing Admin to explicitly grant
  it, logged in the audit trail.
- **Researcher role is structurally blind to identifiers**, not just
  policy-blind — enforced via dedicated database views (§10) that simply
  don't expose `mother_name`/phone/email columns, so there's no query a
  Researcher-role token could construct to retrieve them even by accident or
  malicious intent.
- **Horizontal privilege checks**: confirm a user can only act within their
  own organization/site if multi-site is ever added (§15 open question 4) —
  i.e. a clerk at one site cannot view or edit another site's patients, not
  even by guessing a record ID.
- **Admin actions on other users (role changes, deactivation) require a
  second Admin's confirmation** for anything destructive, where practical —
  reduces the blast radius of a single compromised Admin account.

### 12.3 Application-layer attack mitigation

- **SQL injection**: use a parameterized-query ORM (Prisma, as recommended in
  §13) for all database access — never raw string-concatenated SQL. This is
  largely "free" if the ORM recommendation is followed, but call it out
  explicitly so no one is tempted to drop to raw queries for a "quick" report.
- **XSS (cross-site scripting)**: React (as recommended) escapes rendered
  output by default — the discipline needed is to never use
  `dangerouslySetInnerHTML` with user-supplied content (e.g. the survey's
  `open_comments` free-text field).
- **CSRF**: use `SameSite=Lax` or `Strict` cookies for the session token
  (the earlier school-system build already does this) plus CSRF tokens on
  state-changing API routes if cookies are used for auth.
- **Rate limiting**: apply at minimum to the login, password-reset, and
  research-export endpoints — these are the highest-value targets for abuse.
- **Input validation on every API route** using a schema validator (Zod, as
  used in the earlier build) — reject malformed payloads before they ever
  reach the database layer. This also protects research data integrity, not
  just security (a malformed `gestational_age_weeks` of "54" should be
  rejected at the API, not just flagged later by a researcher).
- **Dependency hygiene**: automated dependency vulnerability scanning (e.g.
  `npm audit`, GitHub Dependabot) in CI, with a policy to patch high/critical
  findings promptly — most real-world breaches exploit known, unpatched
  library vulnerabilities, not novel attacks.

### 12.4 Data protection at rest and in transit

- **HTTPS/TLS everywhere**, no exceptions, including for the cron/webhook
  endpoints — already noted in §11, restated here as part of the full
  picture.
- **Encryption at rest** for the database (most managed Postgres providers —
  Supabase, AWS RDS — enable this by default; confirm it's on, don't assume).
- **Column-level encryption for direct identifiers** (`mother_name`,
  `mother_phone`, `email`, `whatsapp_number`) is recommended **in addition
  to** database-level encryption — this was flagged as an open question in
  the previous version of this spec; given this is newborn health data,
  default to **yes**, and confirm against IREC requirements rather than
  treating it as optional.
- **Secrets management**: API keys (Africa's Talking, WhatsApp Cloud API,
  SMTP credentials, JWT signing secret) belong in environment variables or a
  secrets manager — never committed to source control. Rotate the JWT
  signing secret on a defined schedule.
- **Backups must themselves be encrypted and access-controlled** — a backup
  is a full copy of the most sensitive data in the system; it deserves the
  same protection as the live database, not less.

### 12.5 Monitoring, incident response, and audit

- **The audit log (§4.12) is your primary forensic tool** — make sure it
  captures authentication events (login success/failure, 2FA challenges,
  password resets) in addition to data changes, so a security review can
  reconstruct "who accessed what, when" after the fact.
- **Alerting on anomalies**: a basic rule set (e.g. many failed logins from
  one account, a Researcher-role export far larger than typical, access
  from an unexpected location/time) is worth more than no monitoring at all,
  even if it's simple at first.
- **Have a written incident response plan before go-live** — who is notified
  if a breach is suspected, how patients/IREC are informed if required, and
  within what timeframe. Kenya's Data Protection Act 2019 imposes breach
  notification obligations; this needs to exist on paper, not be improvised
  during an actual incident.
- **Periodic access review**: quarterly check that every active account
  still needs its current role (a departed staff member's account should be
  deactivated immediately, not discovered stale during an audit).

### 12.6 How this maps to "data security and integrity" in a journal submission

Reviewers and ethics committees will specifically look for: encryption at
rest and in transit, role-based access control, audit trails, consent
enforcement, and a named incident response process. Sections 12.1-12.5 above
map directly onto a "Data Security" paragraph in your methods/ethics section —
when the time comes to write it, this section can largely be paraphrased
into manuscript language directly.

---

## 13. Recommended technology stack

Consistent with the earlier school-screening system already built for this
org, for maintainability and shared engineering knowledge — adjust only where
the research requirements specifically demand it:

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | **Next.js (TypeScript)** | One codebase; TypeScript catches data-shape errors before they corrupt a research dataset — important here in a way it wasn't for the simpler school system |
| Database | **PostgreSQL + Prisma ORM** | Relational integrity matches the data model exactly; supports the complex joins researchers will eventually run |
| Auth | JWT session cookies, bcrypt password hashing, role checks at the API layer (not just UI) | Matches earlier build; add audit logging on every write |
| SMS | Africa's Talking | Proven in this context, good Kenya coverage |
| WhatsApp | Meta WhatsApp Cloud API | Same as before; requires template pre-approval |
| Email | SMTP (or SendGrid/AWS SES if higher volume) | |
| Hosting | Cloud VPS or managed Postgres (e.g. Supabase, AWS RDS) with **automated daily backups, 90-day retention minimum** | Backups protect against data loss generally — independent of the "stable power/internet" point; don't skip this thinking stability removes the need for backups |
| Background jobs | A simple job queue (e.g. BullMQ + Redis) for notification sending and nightly quality-snapshot computation | Keeps notification retries reliable without blocking the main request cycle |
| Error monitoring | Sentry or similar | So a silent failure (e.g. notifications stopped sending) is caught fast, not discovered months later when the loss-to-follow-up numbers look wrong |

**Why not REDCap/KoboToolbox**, as ChatGPT also suggested: those are
excellent purpose-built research data tools, but you said you want to build
and own a custom system with an integrated clinical workflow (dashboards,
role-based clerk/screener flow, automated pathway logic) — that combination
is exactly the case where custom-build is justified over a generic research
data tool. Worth keeping in mind as a fallback if timeline pressure ever
becomes severe: REDCap could still be used for the *survey* module (§4.10)
alone via its API, without rebuilding the whole system, if that ever helps.

---

## 14. Recommended build phases

> **Superseded by §54.** This original high-level phase plan is left in place
> rather than deleted — consistent with this system's own "no hard deletes"
> governance principle (§11.2) — but §54 is the current, detailed phase plan
> to actually follow, since it incorporates the engineering and UI/workflow
> sections added later (§16–53).

| Phase | Scope | Rationale |
|---|---|---|
| **0 (parallel, not blocking)** | Ethics/paperwork team works IREC/NACOSTI approval, consent form, DMP, PACTR registration — **not your workstream**, but Phase 1 schema should be reviewed against the consent form once drafted | Approval timelines (months) shouldn't block engineering, but the schema and the legal consent form need to agree on what "consent" covers |
| **1 — Core clinical record** | Modules 1-4: Identity & Consent, Patient Registration, Risk Factors, Pathway Engine (incl. audit log from day one) | This is the data backbone; every later module reads from it. Get the per-ear, per-stage model right before anything else |
| **2 — Closing the loop** | Module 5 (Notifications), Module 11 (roles), downtime/paper-backup flagging (§9) | Turns the system from "a database" into something that actively reduces loss-to-follow-up — your weakest point if skipped |
| **3 — Program management** | Modules 6-8: Operational Data, Parent Survey, Quality Indicators Dashboard | Don't delay past the first 2-3 months of live screening — these can't be reconstructed retroactively once missed |
| **4 — Publication readiness** | Module 10 (Research Export + data dictionary), schema review against STROBE checklist, pseudonymization audit, a walkthrough with an actual statistician before the dataset grows large | Cheaper to fix a missing/malformed variable at 50 records than at 2,000 |

---

## 15. Open questions to resolve before/while building

These need a clinical or ethics decision, not an engineering one — flag them
to your research team rather than guessing:

1. Exact day-count windows for Screen 1→2, post-treatment rescreen delays, and
   the formal "lost to follow-up" cutoff in a neonatal (not school-age)
   population.
2. ~~Whether `mother_name` and other direct identifiers should be encrypted
   at the column level~~ — **resolved in §12.4: yes, by default.** What
   still needs IREC sign-off is whether your specific encryption approach
   satisfies their data protection requirements, not whether to do it at all.
3. Data retention period and what happens to identifiable data after the
   study concludes (affects schema decisions around archival/anonymization
   now, not later).
4. ~~Whether a second hospital/site will ever be added~~ — **confirmed: yes,
   eventually, just not yet.** Recommendation: add a `site_id` field to
   `patients` and `operational_logs` **now**, defaulted to a single "Mama
   Rachel Hospital" site row, even though there's only one site today. This
   costs almost nothing to add at the start and avoids a painful migration
   across live patient data later when the second site actually arrives.

---

## 16. API Contract (endpoint list)

This section provides the full REST API surface so any builder — human or AI — can
implement the backend and frontend consistently without inventing route shapes.

**Base path:** `/api/v1/`
**Auth header:** `Authorization: Bearer <access_token>` on every route unless
marked Public.
**Role abbreviations:** CL = Data Clerk, SC = Screener, SV = Supervisor,
RE = Researcher, AD = Admin.

### 16.1 Auth

| Method | Route | Roles | Request body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | Public | `{ email, password }` | `{ access_token, refresh_token, user }` |
| POST | `/auth/refresh` | Public | `{ refresh_token }` | `{ access_token }` |
| POST | `/auth/logout` | All | — | 204 (invalidates refresh token) |
| POST | `/auth/2fa/setup` | All | — | `{ qr_code_url, secret }` |
| POST | `/auth/2fa/verify` | All | `{ totp_code }` | `{ verified: true }` |
| POST | `/auth/2fa/challenge` | Public | `{ temp_token, totp_code }` | `{ access_token, refresh_token }` |
| POST | `/auth/password/reset-request` | Public | `{ email }` | 204 |
| POST | `/auth/password/reset` | Public | `{ token, new_password }` | 204 |

### 16.2 Patients

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients` | CL | Create patient; auto-generates `research_id`; body: full PatientCreateSchema |
| GET | `/patients` | CL, SC, SV, AD | Paginated list; query params: `?page`, `?search`, `?site_id`, `?date_from`, `?date_to` |
| GET | `/patients/:id` | CL, SC, SV, AD | Full patient record + current pathway state |
| PATCH | `/patients/:id` | CL (within edit window), SV | Partial update; triggers audit log |
| POST | `/patients/:id/void` | SV, AD | Soft-delete (sets `status = VOIDED`); requires `reason` in body |

### 16.3 Consent

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/consent` | CL | Record consent; body: `{ status, consent_form_version, witness_name? }` |
| PATCH | `/patients/:id/consent` | SV | Update consent (e.g. withdrawal); triggers audit log |

### 16.4 Risk Factors

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/risk-factors` | CL | Create risk factor record (one per patient) |
| GET | `/patients/:id/risk-factors` | CL, SC, SV, AD | Retrieve |
| PATCH | `/patients/:id/risk-factors` | CL (within window), SV | Update; triggers audit log |

### 16.5 Screening Events

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/screenings` | CL | Body: ScreeningEventSchema (see below); triggers pathway recompute |
| GET | `/patients/:id/screenings` | CL, SC, SV, AD | All screening events for this patient |
| PATCH | `/screenings/:eventId` | CL (within window), SV | Correction; logged |
| POST | `/screenings/:eventId/flag` | SC | Screener flags a specific event for correction; body: `{ reason }` |

**ScreeningEventSchema** (POST body):
```json
{
  "patient_id": "uuid",
  "ear": "LEFT | RIGHT",
  "stage": "SCREEN_1 | SCREEN_2 | RESCREEN_POST_REFERRAL",
  "modality": "OAE | AABR",
  "equipment_id": "string",
  "probe_fit_quality": "Good | Fair | Poor | null",
  "ambient_noise_level": "Low | Medium | High",
  "attempts": 1,
  "duration_minutes": 12.5,
  "result": "PASS | NOT_PASS | INCOMPLETE",
  "incomplete_reason": "string | null",
  "tested_at": "ISO8601 datetime (clerk-entered actual test time)"
}
```
`recorded_at` is always system clock — never accepted from the client.

### 16.6 Referrals

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/referrals` | CL | Body: ReferralCreateSchema; auto-fills `reason` from triggering event |
| GET | `/patients/:id/referrals` | CL, SC, SV, AD | |
| PATCH | `/referrals/:referralId` | CL (within window), SV | Update status, resolution details |

### 16.7 Diagnostic Evaluations

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/diagnostics` | CL | Body: DiagnosticEvalSchema |
| GET | `/patients/:id/diagnostics` | CL, SC, SV, AD | |
| PATCH | `/diagnostics/:evalId` | SV | |

### 16.8 Notifications

| Method | Route | Roles | Notes |
|---|---|---|---|
| GET | `/patients/:id/notifications` | CL, SV, AD | All notification attempts for this patient |
| POST | `/notifications/resend` | SV | Manually trigger a notification; body: `{ patient_id, channel, trigger_reason }` |
| GET | `/notifications/queue` | SV, AD | View current pending queue |

### 16.9 Operational Logs

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/operational-logs` | CL | Body: OperationalLogSchema; one per day per site |
| GET | `/operational-logs` | SV, AD | Query: `?site_id`, `?date_from`, `?date_to` |
| PATCH | `/operational-logs/:id` | CL (same day), SV | |

### 16.10 Parent Survey

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/patients/:id/survey` | CL | Body: ParentSurveySchema |
| GET | `/patients/:id/survey` | CL, SV, AD | |

### 16.11 Quality / Dashboard

| Method | Route | Roles | Notes |
|---|---|---|---|
| GET | `/dashboard/summary` | CL, SC, SV, RE (aggregate only), AD | Current KPI cards |
| GET | `/dashboard/funnel` | All | Pathway funnel counts |
| GET | `/dashboard/trends` | All | Monthly trend data from `quality_snapshots` |
| GET | `/dashboard/action-needed` | CL, SV, AD | Patients with overdue milestones; see §19 for "overdue" definitions |
| GET | `/dashboard/bar-charts` | All | Screenings per day/week, missed reasons |

### 16.12 Research Export

| Method | Route | Roles | Notes |
|---|---|---|---|
| GET | `/exports/list` | RE, AD | Available export themes |
| POST | `/exports/generate` | RE, AD | Body: `{ theme, format, date_from?, date_to?, site_id? }`; queued as background job |
| GET | `/exports/:jobId/status` | RE, AD | Poll job status |
| GET | `/exports/:jobId/download` | RE, AD | Download file (expires after 24h) |

### 16.13 Correction Requests

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/correction-requests` | CL, SC | Body: `{ table_name, record_id, reason, proposed_value }` |
| GET | `/correction-requests` | SV, AD | Pending queue |
| PATCH | `/correction-requests/:id` | SV | Body: `{ decision: "APPROVED | REJECTED", reviewer_note }` |

### 16.14 User Management

| Method | Route | Roles | Notes |
|---|---|---|---|
| GET | `/users` | AD | All users |
| POST | `/users` | AD | Create user; body: UserCreateSchema |
| PATCH | `/users/:id` | AD | Update role, deactivate |
| POST | `/users/:id/deactivate` | AD | Requires second Admin confirmation token |

### 16.15 Sites

| Method | Route | Roles | Notes |
|---|---|---|---|
| GET | `/sites` | All | List sites |
| POST | `/sites` | AD | Create site |
| PATCH | `/sites/:id` | AD | Update site |

---

## 17. Pathway State Machine (formal)

This is the authoritative logic the pathway engine (§5) must implement. Every
cell in the "Next state" column should correspond to a unit-testable function
that takes (current state, triggering event) and returns (next state, list of
side effects).

**Scope:** one ear independently. Left and right ears each have their own state
machine instance. A patient's overall `final_status` is derived from the *worse*
ear's state.

### 17.1 Modality assignment (runs once at intake, before any state)

```
IF patient.nicu_days > 5 THEN ear.modality = AABR
ELSE ear.modality = OAE
```

This is locked — it cannot be changed later without a Supervisor-approved
correction and an audit log entry. The system must display it prominently so
clerks don't override it manually.

### 17.2 State transition table

| Current state | Triggering event | Next state | Side effects |
|---|---|---|---|
| `NOT_STARTED` | Screening saved (Screen 1, PASS) | `SCREEN_1_PASSED` | Recompute milestones; mark ear resolved |
| `NOT_STARTED` | Screening saved (Screen 1, NOT_PASS) | `SCREEN_1_FAILED` | Schedule Screen 2 notification series |
| `NOT_STARTED` | Screening saved (Screen 1, INCOMPLETE) | `NOT_STARTED` | Log attempt; no state change; alert clerk to retry |
| `SCREEN_1_FAILED` | Screening saved (Screen 2, PASS) | `SCREEN_2_PASSED` | Recompute milestones; mark ear resolved |
| `SCREEN_1_FAILED` | Screening saved (Screen 2, NOT_PASS) | `SCREEN_2_FAILED` | Auto-create HCP referral record; schedule HCP referral notifications |
| `SCREEN_1_FAILED` | Screening saved (Screen 2, INCOMPLETE) | `SCREEN_1_FAILED` | Log attempt; no state change |
| `SCREEN_2_FAILED` | Referral updated (status = CLEARED) | `CLEARED_FOR_RESCREEN` | Schedule rescreen immediately; cancel HCP notification series |
| `SCREEN_2_FAILED` | Referral updated (status = TREATED) | `CLEARED_FOR_RESCREEN` | Schedule rescreen after treatment delay (see §17.3) |
| `SCREEN_2_FAILED` | Referral updated (status = PE_TUBE) | `CLEARED_FOR_RESCREEN` | Schedule rescreen after PE tube delay (see §17.3) |
| `SCREEN_2_FAILED` | Referral updated (status = NO_SHOW) | `SCREEN_2_FAILED` | Log no-show event; resume notification series; do NOT drop case |
| `CLEARED_FOR_RESCREEN` | Screening saved (Rescreen, PASS) | `RESCREEN_PASSED` | Recompute milestones; mark ear resolved |
| `CLEARED_FOR_RESCREEN` | Screening saved (Rescreen, NOT_PASS) | `RESCREEN_FAILED` | Auto-create audiology referral record; schedule audiology notifications |
| `RESCREEN_FAILED` | Diagnostic evaluation saved | `DIAGNOSED` | Set `diagnostic_evaluations.diagnosis`; recompute milestones; schedule intervention notifications if hearing loss confirmed |
| Any active state | Notification attempts exhausted (see §18.4) | `PENDING_LTFU` | Alert supervisor via dashboard action-needed table |
| `PENDING_LTFU` | Supervisor marks case LTFU | `LOST_TO_FOLLOWUP` | Set `pathway_milestones.final_status = LOST_TO_FOLLOWUP`; no further notifications |
| `PENDING_LTFU` | Patient contact re-established (any event saved) | Prior active state | Resume normal pathway; cancel LTFU flag |

### 17.3 Delay windows (⚠ requires clinical sign-off before hardcoding)

These values appear in the state machine's side effects but must be confirmed
by the supervising audiologist before implementation. Placeholder values
below should be replaced with clinician-approved numbers:

| Delay type | Value | Status |
|---|---|---|
| Screen 1 → Screen 2 scheduling window | **14 days (confirmed)** | ✅ Confirmed by client — lock this into code, not a placeholder |
| HCP clearance → rescreen delay | Immediate (same week) | ⚠ Still needs supervising audiologist sign-off |
| Otitis media treatment → rescreen delay | ~6–8 weeks | ⚠ Still needs supervising audiologist sign-off |
| PE tube placement → rescreen delay | ~4–6 weeks | ⚠ Still needs supervising audiologist sign-off |
| Audiology referral → expected evaluation window | 90 days (from JCIH 1-3-6) | Confirmed by JCIH |
| Diagnosis → intervention start window | 180 days (from JCIH 1-3-6) | Confirmed by JCIH |
| "No contact" cutoff before PENDING_LTFU | TBD | ⚠ Still needs clinical lead + IREC sign-off |

### 17.4 Out-of-order entry protection

The API must reject any `screening_event` that violates the state machine:
- Screen 2 cannot be saved if no Screen 1 exists for that ear
- Rescreen cannot be saved if no HCP referral with `status ≠ PENDING` exists for that ear
- Diagnostic evaluation cannot be saved if the ear is not in `RESCREEN_FAILED`

Violations return HTTP 422 with a clear error message identifying the missing
prerequisite — not a silent failure.

### 17.5 Bilateral state → patient-level status

`pathway_milestones.final_status` is derived from both ears as follows:
```
IF both ears = SCREEN_1_PASSED OR SCREEN_2_PASSED OR RESCREEN_PASSED → PASSED
ELSE IF either ear = LOST_TO_FOLLOWUP → LOST_TO_FOLLOWUP
ELSE IF either ear = DIAGNOSED → DIAGNOSED
ELSE IF either ear = RESCREEN_FAILED → REFERRED_AUDIOLOGY
ELSE → IN_PROGRESS
```

---

## 18. Notification Scheduling — Trigger Table

Every notification series is defined here. Background jobs (BullMQ) read this
table's logic to schedule sends. All sends are rows in `notifications_log`.

### 18.1 Trigger events and series

| Trigger event | Series name | Channels (in order) | Schedule |
|---|---|---|---|
| Screen 1 NOT_PASS saved | `screen2_reminder` | SMS → WhatsApp → Email | D+7, D+12, D+14 (day before window closes), D+15 (if no Screen 2 recorded) |
| Screen 2 NOT_PASS saved (HCP referral created) | `hcp_referral_reminder` | SMS → WhatsApp → Email | D+1, D+7, D+14, D+30 |
| HCP referral CLEARED → rescreen due | `rescreen_reminder` | SMS → WhatsApp | D+1, D+3, D+7 |
| Audiology referral created | `audiology_referral_reminder` | SMS → WhatsApp → Email | D+7, D+30, D+60, D+80 |
| Diagnosis confirmed with hearing loss | `intervention_reminder` | SMS → WhatsApp → Email | D+7, D+30, D+90, D+150 |
| Appointment missed (no-show detected) | `no_show_followup` | SMS → WhatsApp | D+1, D+3, D+7 |
| Parent survey: `delivery_channel_preference` = SMS or WHATSAPP, `status` = PENDING | `parent_survey_request` | The parent's chosen channel only — **no fallback to other channels**, unlike the clinical series above (§4.10.1) | D+0 (at discharge), D+5 (one follow-up only). **Hard stop after 2 attempts** — set `status = NO_RESPONSE`, do not re-enter the series. |

**D = day the trigger event is saved.** Scheduling is relative to `trigger_date`,
not `sent_at`.

### 18.2 Per-send logic

```
For each scheduled send in a series:
  1. Check if the series has been cancelled (pathway advanced past this stage)
  2. If cancelled: drop the send, log as CANCELLED
  3. If not cancelled: attempt primary channel (SMS)
     a. If DELIVERED: log success, stop this send (do not fall through to next channel)
     b. If FAILED or no DELIVERED confirmation within 24h: attempt next channel
     c. Log every attempt regardless of outcome
```

### 18.3 Cancellation rules

A notification series is cancelled when the patient's ear state machine
advances past the stage the series was tracking:

| Series | Cancelled when |
|---|---|
| `screen2_reminder` | Screen 2 result saved for that ear |
| `hcp_referral_reminder` | HCP referral status updated to CLEARED / TREATED / PE_TUBE |
| `rescreen_reminder` | Rescreen result saved for that ear |
| `audiology_referral_reminder` | Diagnostic evaluation saved for that ear |
| `intervention_reminder` | `early_intervention_enrolled = true` saved |
| `no_show_followup` | Next appointment attended (any event saved for that ear) |
| `parent_survey_request` | Survey `status` set to `COMPLETED` (parent responded). **Not cancelled by anything else** — unlike the clinical series, this one only ever ends in `COMPLETED` or the hard-stop `NO_RESPONSE` described in §4.10.1, never a silent cancellation. |

Cancelled sends must still be logged in `notifications_log` with
`delivery_status = CANCELLED` so the loss-to-follow-up paper can distinguish
"we stopped sending because the patient came in" from "we stopped sending
because all attempts failed."

### 18.4 LOST_TO_FOLLOWUP escalation

After all sends in a series are exhausted without a positive outcome:
1. Set patient ear state to `PENDING_LTFU` (§17.2)
2. Add patient to the supervisor's action-needed table (§8.1) with reason
   `NOTIFICATION_SERIES_EXHAUSTED`
3. Do NOT auto-set `LOST_TO_FOLLOWUP` — this requires a deliberate supervisor
   action, not an automatic state change, because a patient may still arrive
   without responding to any notification

---

## 19. Overdue Thresholds (Action-Needed Table)

The dashboard's action-needed table (§8.1) flags patients based on these
computed rules. Each rule should be a named, version-controlled function in
the codebase (not an ad-hoc query) so the exact definition can be cited in
the methods section.

| Flag label | Condition | Urgency |
|---|---|---|
| `Screen 2 overdue` | Ear in `SCREEN_1_FAILED` AND `days since Screen 1 > 18` | High |
| `HCP referral no response` | HCP referral in `PENDING` AND `days since referral > 14` | High |
| `Rescreen overdue after clearance` | Ear in `CLEARED_FOR_RESCREEN` AND `days since clearance > 14` | High |
| `Audiology referral overdue` | Ear in `RESCREEN_FAILED` AND `days since audiology referral > 30` | High |
| `Diagnosis delayed` | Ear in `RESCREEN_FAILED` AND `days since audiology referral > 75` | Critical |
| `Intervention not started` | `DIAGNOSED` with hearing loss AND `days since diagnosis > 90` | Critical |
| `All notifications exhausted` | `PENDING_LTFU` | Critical |

Thresholds above are conservative early-warning points, not the formal JCIH
benchmark cutoffs — they are designed to give the supervisor time to intervene
before a case breaches the 1-3-6 targets. The JCIH cutoff dates (30, 90, 180
days) are computed separately in `pathway_milestones` (§4.7) for the quality
indicator formulas (§8).

---

## 20. Expanded Data Model — Missing Tables and Fields

### 20.1 `users` — complete schema

The original table in §4.13 was a skeleton. Full schema:

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | string | |
| email | string, unique | |
| phone | string, nullable | |
| password_hash | string | bcrypt or argon2 |
| role | enum (DATA_CLERK, SCREENER, SUPERVISOR, RESEARCHER, ADMIN) | |
| site_id | FK to `sites` | Even for single-site, always set |
| active | boolean | Default true |
| totp_secret | string, encrypted at column level | Set during 2FA setup |
| totp_enabled | boolean | Default false until setup confirmed |
| failed_login_count | integer | Reset to 0 on successful login |
| locked_until | datetime, nullable | Set by brute-force lockout logic |
| last_login_at | datetime, nullable | |
| password_reset_token | string, nullable | Hashed; expires |
| password_reset_expires | datetime, nullable | |
| created_by | FK to users, nullable | Which admin created this account |
| created_at | datetime | |
| deactivated_at | datetime, nullable | |
| deactivated_by | FK to users, nullable | |

### 20.2 `sites`

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | string | e.g. "Mama Rachel Hospital" |
| county | string | |
| subcounty | string, nullable | |
| contact_person | string | |
| contact_phone | string | |
| created_at | datetime | |
| active | boolean | |

All `patients`, `operational_logs`, and `users` rows must have a `site_id` FK
to this table. Default the initial seed row to `{ name: "Mama Rachel Hospital",
county: "..." }` so the application starts with one site and multi-site is just
an admin add-site action later.

### 20.3 `correction_requests`

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| requested_by | FK to users | The clerk or screener who noticed the error |
| requested_at | datetime, auto | |
| table_name | string | Which table contains the wrong record |
| record_id | UUID | The specific record's PK |
| reason | text, required | Mandatory explanation |
| proposed_value | JSON | The corrected field(s) and their new values |
| status | enum (PENDING, APPROVED, REJECTED) | Default PENDING |
| reviewed_by | FK to users, nullable | Supervisor who acted on it |
| reviewed_at | datetime, nullable | |
| reviewer_note | text, nullable | Reason for rejection, or confirmation note |

When status = APPROVED: the system applies `proposed_value` to the target
record and creates an audit log entry with `changed_by = reviewer` (the
Supervisor who approved, not the Clerk who requested).

### 20.4 `qi_review_log`

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| review_date | date | |
| reviewer_id | FK to users | Must be Supervisor or Admin |
| issue_identified | text, required | Plain-language description |
| root_cause | text, nullable | |
| action_taken | text, required | |
| responsible_person | string | May be a name outside the system |
| follow_up_date | date, nullable | |
| status | enum (OPEN, IN_PROGRESS, CLOSED) | |
| closed_at | datetime, nullable | |
| site_id | FK to sites | |
| created_at | datetime | |

### 20.5 `diagnostic_thresholds` (audiogram data)

The `diagnostic_evaluations` table (§4.6) captures diagnostic category and
degree but not the raw audiogram. Add this child table to preserve the full
evaluation data needed for the prevalence paper:

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| diagnostic_evaluation_id | FK | |
| frequency_hz | integer | Standard values: 250, 500, 1000, 2000, 4000, 8000 |
| threshold_db | integer | Hearing level in dB HL |
| ear | enum (LEFT, RIGHT) | Should match parent evaluation |
| test_type | enum (AC, BC) | Air conduction or bone conduction |

One row per frequency per ear per evaluation. This allows the audiogram to be
plotted and exported for statistical analysis. **Decision required:** confirm
with the clinical lead whether bone conduction data will consistently be
collected — if not, `test_type` can be omitted and assumed to be air
conduction.

### 20.6 `consent_records` — withdrawal extension

Add these fields to the existing schema (§4.2) for consent withdrawal handling:

| Field | Type | Notes |
|---|---|---|
| withdrawn_at | datetime, nullable | |
| withdrawn_by_clerk_id | FK to users, nullable | |
| withdrawal_reason | text, nullable | |

**Withdrawal behavior (clinical/ethics decision required):**
When `status` is changed from `GIVEN` to `REFUSED` (withdrawal):
- All existing screening data is **retained** in the database (no hard delete)
- The patient is **excluded** from all research exports going forward
  (enforced by `v_export_patients` view filtering `consent.status = 'GIVEN'`)
- A soft-delete flag (`status = VOIDED`) is **not** applied automatically —
  withdrawal of consent ≠ deletion of a record; the distinction matters for
  the STROBE flow diagram (you must report how many withdrew consent)
- **IREC must confirm** this handling before go-live

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

## 22. Paper-Backup Form Specification

A single printable one-page form, kept at the screening station for use
during system downtime. Design it to match the minimum fields needed for
reliable re-entry.

### 22.1 Required fields on the paper form

| Field | Input type | Notes |
|---|---|---|
| Date of screening | Date | Handwritten |
| Hospital number (if assigned) | Text | If research ID not yet generated |
| Baby surname / mother surname | Text | For identification only; not a coded variable |
| Ear screened | Checkbox: L / R / Both | |
| Screening modality | Checkbox: OAE / AABR | |
| Screen stage | Checkbox: Screen 1 / Screen 2 / Rescreen | |
| Result — Left ear | Checkbox: Pass / Not Pass / Incomplete | |
| Result — Right ear | Checkbox: Pass / Not Pass / Incomplete | |
| Screener name | Text | |
| Time test performed | Time (24h) | Critical for `tested_at` re-entry |
| Equipment ID | Text | |
| Notes | Free text (small box) | Not entered as a coded variable |

### 22.2 Where the form lives in the system

- A printable PDF version of this form is generated by the system and
  accessible to Supervisors and Admins at `/settings/paper-backup-form`
- The PDF is version-stamped (form version number + date) so re-entry clerks
  can confirm they used the current form
- The Admin can update the form version when the protocol changes; old versions
  are archived, not deleted

### 22.3 Re-entry workflow

1. Clerk opens a standard new screening record in the system
2. The form's `entry_source` is automatically set to `PAPER_BACKUP`
3. Two timestamp fields appear (normally hidden in live entry):
   - `tested_at` — clerk enters the handwritten time from the paper form
   - `recorded_at` — auto-stamped by system to current time
4. Clerk checks a confirmation box: "I am entering from a paper backup form
   completed during system downtime"
5. Record saves normally; audit log records both timestamps and the
   `PAPER_BACKUP` flag

---

## 23. Environment Variables Inventory

All secrets and configuration belong in environment variables. Never commit
these to source control. The following variables are required:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | Full PostgreSQL connection string |
| `REDIS_URL` | BullMQ | For job queue and refresh token store |
| `JWT_ACCESS_SECRET` | Auth | Short-lived token signing key; rotate quarterly |
| `JWT_REFRESH_SECRET` | Auth | Separate key for refresh tokens |
| `JWT_ACCESS_EXPIRY` | Auth | e.g. `15m` |
| `JWT_REFRESH_EXPIRY` | Auth | e.g. `30d` |
| `AFRICA_TALKING_API_KEY` | SMS | From Africa's Talking dashboard |
| `AFRICA_TALKING_USERNAME` | SMS | |
| `META_WHATSAPP_TOKEN` | WhatsApp | Permanent token from Meta Business |
| `META_WHATSAPP_PHONE_ID` | WhatsApp | Phone number ID from Meta |
| `META_WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook | Secret you set in Meta dashboard |
| `SMTP_HOST` | Email | |
| `SMTP_PORT` | Email | |
| `SMTP_USER` | Email | |
| `SMTP_PASS` | Email | |
| `SMTP_FROM` | Email | e.g. `noreply@mamarachel.go.ke` |
| `ENCRYPTION_KEY` | Column-level encryption | 32-byte hex key for `mother_name`, `phone`, `email` fields |
| `APP_URL` | General | Base URL for email links, CORS, WhatsApp webhook |
| `SENTRY_DSN` | Error monitoring | From Sentry project |
| `BACKUP_ENCRYPTION_KEY` | Backups | Separate key for encrypting backup archives |
| `NODE_ENV` | General | `development | production` |

A `.env.example` file (with all keys present but values blank) must be
committed to the repository. The actual `.env` file is never committed.

---

## 24. Backup Verification Process

Automated daily backups (§13) must be regularly tested to confirm they are
actually restorable. A backup that has never been restored is an untested
assumption.

### 24.1 Verification schedule

| Check | Frequency | Who |
|---|---|---|
| Backup job completed (monitoring alert) | Daily (automated) | Sentry / server monitoring |
| Backup file exists and is non-zero size | Daily (automated) | CI / cron job that checks the backup store |
| Full restore to a staging environment | Monthly | Admin / engineer |
| Restored data spot-check (record counts match) | Monthly alongside restore | Admin |
| Log restore test result in `qi_review_log` | Monthly | Admin |

### 24.2 Restore test procedure

1. Provision a clean staging database (separate from production)
2. Decrypt the most recent backup archive using `BACKUP_ENCRYPTION_KEY`
3. Restore to staging: `pg_restore -d staging_db backup.dump`
4. Run record count checks:
   ```sql
   SELECT COUNT(*) FROM patients;
   SELECT COUNT(*) FROM screening_events;
   SELECT COUNT(*) FROM audit_log;
   ```
5. Compare counts to production (should match within the daily delta)
6. Log the result (pass/fail, record counts, restore duration) in `qi_review_log`
7. Tear down the staging database

Restore tests must be documented. An IREC auditor or journal reviewer may ask
"how do you know your backups work?" and the `qi_review_log` entries are the
answer.

---

## 25. Token Invalidation on Account Deactivation

Short-lived JWT access tokens (15–30 min) combined with refresh token rotation
leave a window during which a deactivated user's access token remains valid.
This window must be closed.

### 25.1 Implementation

When an Admin deactivates a user account (`PATCH /users/:id/deactivate`):

1. Set `users.active = false` and `users.deactivated_at = now()`
2. **Delete all refresh tokens** for that user from Redis (key pattern:
   `refresh:<user_id>:*`)
3. **Add the user's current access token JTI** (JWT ID) to a Redis blocklist:
   `blocklist:<jti>` with TTL equal to the token's remaining lifetime
4. Every API route's auth middleware checks the blocklist before processing any
   request. A hit returns HTTP 401 immediately.

This ensures a deactivated user is locked out within milliseconds, not within
the token's expiry window.

### 25.2 Middleware check (pseudocode)

```javascript
async function authMiddleware(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyJWT(token); // throws if expired or invalid signature
  const blocked = await redis.get(`blocklist:${payload.jti}`);
  if (blocked) return res.status(401).json({ error: "Session invalidated" });
  const user = await db.users.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) return res.status(401).json({ error: "Account deactivated" });
  req.user = user;
  next();
}
```

---

*Sections 1–15 are the original spec; sections 16–25 filled the v1.0 gaps;
sections 26–40 incorporate the pre-deployment gap analysis (security architecture,
scalability, and journal-grade data completeness). Together these form a complete,
self-contained build brief for any engineer or AI model.*

---

## 26. Kenya Legal Compliance — ODPC Registration

> 🔴 **BLOCKER** — Do not deploy or process any patient data until all items
> below are complete.

As of 1 January 2025, the Office of the Data Protection Commissioner (ODPC)
requires that all healthcare facilities obtain a Certificate of Data
Handler/Processor before processing health data. Newborn hearing data is
classified as **sensitive personal data** under the Kenya Data Protection Act
2019 (Section 6). The following steps are mandatory:

### 26.1 ODPC registration

Register Mama Rachel Hospital as a **Data Controller** with the ODPC. This is
required for any organisation that processes sensitive personal data, regardless
of size. The registration portal is at https://odpc.go.ke.

### 26.2 Data Protection Impact Assessment (DPIA)

Conduct a DPIA and submit the report to the Data Commissioner **at least 60
days before processing begins** if the assessment identifies high risk — which
newborn health data almost certainly will. The DPIA must document:

- What data is collected (categories, volume, sensitivity)
- Why it is collected (legal basis — see §26.4)
- How it is stored and protected
- How long it is retained (align with the 10-year clinical record requirement in §12.5)
- Who has access and under what controls
- The research purpose and how anonymisation protects subjects at export

The DPIA is not merely an internal document — it is a regulatory filing.

### 26.3 Data Protection Officer (DPO)

Formally designate a DPO. This does not have to be a full-time role but must be
a named individual. The DPO's name and contact details must be included in:
- The patient consent form
- The system's privacy notice (displayed to users at login)
- The ODPC registration record

### 26.4 Dual legal basis for processing

The consent model (§4.2) must cite both legal bases explicitly on the consent
form and in the system's data management plan:

1. **Consent of the data subject** — the mother consenting on behalf of the
   infant (DPA Section 30)
2. **Scientific/research purpose** — processing for public health research
   (DPA Section 53), subject to the anonymisation and access controls described
   in this spec

The ODPC Guidance Notes for Processing for Research Purpose must be consulted
when finalising the consent form text and the export module's anonymisation
approach. These are publicly available from the ODPC website.

### 26.5 KMPDC Certificate of Data Handler

Separately from ODPC registration, the Kenya Medical Practitioners and Dentists
Council (KMPDC) requires healthcare facilities to hold a Certificate of Data
Handler/Processor. Apply for this alongside the ODPC registration — the two
processes are distinct.

---

## 27. TLS, HTTPS, and Security Headers

> 🔴 **BLOCKER** — Must be configured before the system is internet-accessible.

### 27.1 TLS certificate

- Obtain a TLS certificate via Let's Encrypt (free, auto-renewing) or the
  hosting provider's managed certificate service.
- Configure **automatic renewal** — a lapsed certificate breaks the system
  silently and exposes data in transit. Set up a cron job or hosting-provider
  automation to renew at least 14 days before expiry.
- Test the certificate configuration with SSL Labs (https://ssllabs.com/ssltest/)
  before go-live. Target grade: A or A+.

### 27.2 HTTP → HTTPS redirect

Configure the server to issue a **301 permanent redirect** for every HTTP
request to the equivalent HTTPS URL. A single unencrypted request that includes
a session token constitutes a data breach in transit.

### 27.3 Required security headers

Add the following headers to every HTTP response. Configure them in the web
server (nginx/caddy) or as Express middleware — do not rely on the application
router to add them consistently:

| Header | Required value | What it prevents |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Downgrade attacks; forces HTTPS for 1 year |
| `Content-Security-Policy` | `default-src 'self'` (extend for CDN/fonts as needed) | XSS via external scripts |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Patient URLs leaking in referrer headers |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` | Unintended browser feature access |

---

## 28. API Rate Limiting — Full Specification

> 🔴 **BLOCKER** — The spec mentioned rate limiting in §12.3 but gave no concrete
> limits. Without specific values, a developer will implement nothing or guess.

Implement using `express-rate-limit` with a Redis store (same Redis instance
as BullMQ — no additional infrastructure needed).

| Endpoint group | Limit | Window | Action on breach |
|---|---|---|---|
| `POST /auth/login` | 5 attempts | Per IP, per 15 min | HTTP 429 + lock account temp |
| `POST /auth/password/reset-request` | 3 requests | Per email, per hour | Accept silently but do not send (prevents user enumeration) |
| `POST /auth/2fa/challenge` | 5 attempts | Per temp_token | Invalidate temp_token on breach |
| `POST /exports/generate` | 10 requests | Per user, per day | HTTP 429 with `Retry-After` header |
| All authenticated routes | 200 requests | Per user, per minute | HTTP 429 |
| All routes (global) | 1000 requests | Per IP, per minute | HTTP 429 |
| Webhook endpoints (WhatsApp, AT) | 500 requests | Per IP, per minute | HTTP 429 (separate limit from user API) |

All 429 responses must include a `Retry-After` header with the number of seconds
until the window resets.

---

## 29. Secrets Management

> 🔴 **BLOCKER** — `.env` files on a server are not production-grade for medical data.

### 29.1 Secrets manager

All secrets listed in §23 must be stored in a **secrets manager**, not in a
`.env` file on the production server. Options in order of preference:

1. **AWS Secrets Manager** (if hosted on AWS)
2. **Supabase Vault** (if using Supabase as the database host)
3. **HashiCorp Vault** (self-hosted; more complex but cloud-agnostic)

The application pulls secrets at startup via the secrets manager SDK. The
`.env.example` file in the repository lists key names only — values are never
committed to source control.

### 29.2 Log scrubbing

Add Express middleware that intercepts all log output and redacts any value
matching the pattern of a hex key (32+ hex characters). The
`ENCRYPTION_KEY` and `BACKUP_ENCRYPTION_KEY` must never appear in:
- Application logs
- Error messages returned to the client
- Stack traces sent to Sentry

### 29.3 Key rotation procedure

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` rotate quarterly. Procedure:
1. Generate new secret values
2. Update in secrets manager
3. Restart application (existing valid tokens will fail verification; users
   will be logged out and must re-authenticate — this is acceptable quarterly
   maintenance)
4. Document rotation in the `qi_review_log` (date, rotated by)

`ENCRYPTION_KEY` rotation is a **planned maintenance operation**, not a hotfix:
1. Provision a new key
2. Write a migration script that reads each encrypted value with the old key
   and re-encrypts with the new key
3. Run in a transaction on a maintenance window
4. Update the secrets manager
5. Test decryption before closing the maintenance window

Never rotate `ENCRYPTION_KEY` without the re-encryption migration — doing so
renders all stored patient identifiers unreadable.

---

## 30. Database-Level Security

> 🔴 **BLOCKER** — Application-layer role enforcement alone is insufficient.
> A single compromised query can bypass it.

### 30.1 Separate PostgreSQL roles

Create four PostgreSQL roles. The application uses different roles for different
operations:

| Role | Permissions | Used by |
|---|---|---|
| `app_rw` | INSERT, UPDATE, SELECT on clinical tables | Normal API write operations |
| `app_ro` | SELECT only on non-PII views | Researcher export queries; dashboard aggregations |
| `app_audit` | INSERT only on `audit_log` | Audit writer (cannot read or update audit records) |
| `app_migration` | Full DDL (CREATE, ALTER, DROP) | Deployment migrations only — never the runtime credential |

The `DATABASE_URL` for the production runtime uses `app_rw`. Export queries use
a separate connection string with `app_ro`. Migration scripts use `app_migration`
and this credential is never present in the production environment at runtime.

### 30.2 Audit log — DB-level immutability

The spec notes in §4.12 that the audit log is append-only. This must be enforced
at the PostgreSQL level, not just application logic. Add a trigger:

```sql
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_audit_immutability
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
```

This means even if the `app_rw` credential is compromised, audit records cannot
be tampered with.

### 30.3 Column-level PII access restriction

The column-level encrypted fields (`mother_name`, `mother_phone`, `email`,
`whatsapp_number`) must have a PostgreSQL Row Level Security policy that prevents
the `app_ro` role (used by Researcher exports) from accessing those columns,
even with a raw SQL query. The export views (§10) must project only
`research_id` and non-identifying fields — never the raw PII columns.

### 30.4 Row Level Security for multi-site isolation

Add PostgreSQL RLS policies on all tables that have a `site_id` column. Even
with a single site today, adding RLS now costs almost nothing and prevents a
future query bug from exposing Site A's patients to Site B's users.

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_isolation ON patients
  USING (site_id = current_setting('app.current_site_id')::uuid);
```

The application middleware sets `app.current_site_id` on every database
connection before executing queries. Prisma supports this via a `$use`
middleware hook.

---

## 31. Input Sanitisation

> 🟡 **HIGH** — Required before any free-text field is written to the database.

Add a shared `sanitiseText(input: string): string` utility that runs
`isomorphic-dompurify` (DOMPurify, server-side) before any free-text field is
persisted. This is one function, called consistently from the Zod schema
preprocessors — not scattered conditional logic.

**Fields that require sanitisation (strip HTML/script tags):**

| Field | Table |
|---|---|
| `open_comments` | `parent_survey` |
| `incomplete_reason` | `screening_events` |
| `additional_notes` | `risk_factors` |
| `reviewer_note` | `correction_requests` |
| `issue_identified`, `action_taken`, `root_cause` | `qi_review_log` |
| `provider_name`, `facility` | `referrals` |
| `notes` | `operational_logs` |

All other fields are typed enums, integers, or dates — no sanitisation needed
beyond Zod type validation.

---

## 32. Webhook Security

> 🟡 **HIGH** — An unvalidated webhook endpoint is an unauthenticated POST
> endpoint that can inject fabricated delivery statuses.

### 32.1 Meta WhatsApp webhooks

Validate the `X-Hub-Signature-256` header on every incoming webhook:

```javascript
function validateWhatsAppWebhook(req, rawBody) {
  const signature = req.headers['x-hub-signature-256'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_WHATSAPP_VERIFY_TOKEN)
    .update(rawBody)
    .digest('hex');
  if (signature !== expected) {
    throw new Error('Invalid webhook signature');
  }
}
```

**Critical:** use the raw request body (before JSON parsing) for the HMAC
computation. Parse the body only after signature validation passes.

### 32.2 Africa's Talking delivery callbacks

Africa's Talking publishes the IP ranges their callback servers use. Add these
to an IP allowlist for the `/webhooks/africastalking` endpoint. Requests from
any other IP return HTTP 403 without processing. Check the Africa's Talking
documentation for the current IP list and add it to `APP_CONFIG` as a
version-controlled constant (not a secrets manager value — IP ranges are not
secret, just a configuration).

---

## 33. Pre-Launch Security Review

> 🟡 **HIGH** — Must be completed before first patient record is entered.

### 33.1 OWASP ZAP scan

Run OWASP ZAP (free, https://zaproxy.org) against the staging environment in
**active scan mode** before deployment. It surfaces common vulnerabilities
(missing headers, open redirects, CSRF gaps, injection points) automatically.

All **Critical** and **High** findings must be resolved before go-live.
**Medium** findings must be documented with a remediation plan, even if not
immediately fixed.

Save the ZAP report as `docs/security/zap-report-prelaunch.html` in the
repository. This is a citable document — journals and ethics committees
reviewing the data management plan may ask for evidence of security review.

### 33.2 Manual threat model

Review the three highest-risk flows manually with at least one person who did
not build the system:

1. **Login / 2FA flow** — What happens if an attacker has a valid username and
   password but not the TOTP device? What if they have a temp_token and brute-
   force TOTP codes?
2. **Research export flow** — What prevents a Researcher from generating an
   export that includes PII columns? What if they modify the query parameters?
3. **Paper backup re-entry** — What prevents a malicious clerk from backdating
   a record via `tested_at`? (Answer: audit log + Supervisor review — confirm
   this is documented and tested.)

Document the findings and mitigations. Add to `docs/security/threat-model.md`.

### 33.3 Session fixation protection

On every successful post-2FA login, issue a **new** JWT pair — never reuse the
pre-authentication token. The `temp_token` issued after password verification
(before TOTP) must have a separate, short lifetime (5 minutes) and must be
invalidated immediately after the TOTP challenge succeeds or fails.

### 33.4 Device fingerprint logging (extend §25)

Store a `device_fingerprint` hash (SHA-256 of user-agent + first two IP octets)
in the refresh token record in Redis. On every refresh attempt:
- If fingerprint matches: proceed normally
- If fingerprint differs significantly: log a warning event to `audit_log` with
  action `SUSPICIOUS_REFRESH` — do **not** block (to avoid locking out
  legitimate users on mobile networks with changing IPs), but surface in a
  future admin security dashboard

---

## 34. Database Indexing Strategy

> 🔴 **BLOCKER** — Without these indexes, dashboard and export queries become
> unacceptably slow beyond ~1,000 patients.

Add these indexes in Prisma schema migrations. Each index should exist before
the first patient record is entered — adding them later on a live table locks
the table during index creation.

| Table | Index columns | Why |
|---|---|---|
| `patients` | `research_id` | All exports join on this |
| `patients` | `(created_at, site_id)` | Date-range and site dashboard filters |
| `patients` | `(nicu_admitted, nicu_days)` | AABR routing queries |
| `patients` | `final_status` (from pathway_milestones) | Dashboard aggregations |
| `screening_events` | `(patient_id, ear, stage)` | Pathway engine state lookups |
| `screening_events` | `tested_at` | Timeline and JCIH 1-3-6 queries |
| `referrals` | `(patient_id, ear, status)` | Pathway state lookups |
| `pathway_milestones` | `final_status` | Dashboard aggregation |
| `pathway_milestones` | `(screened_within_1_month, diagnosed_within_3_months, intervention_within_6_months)` | JCIH KPI queries |
| `notifications_log` | `(patient_id, trigger_reason, channel, delivery_status)` | LTFU export |
| `audit_log` | `(table_name, record_id, changed_at)` | Forensic lookups |
| `audit_log` | `changed_by` | Per-user activity queries |

### 34.1 Materialised view for dashboard

The `pathway_milestones` table should be implemented as a **PostgreSQL
materialised view**, refreshed by a trigger after each write to
`screening_events`, `referrals`, or `diagnostic_evaluations`. This keeps
dashboard queries at sub-millisecond latency regardless of patient volume and
avoids the risk of the milestones table drifting out of sync with the event
tables.

```sql
CREATE MATERIALIZED VIEW pathway_milestones_mv AS
  SELECT
    p.id AS patient_id,
    p.research_id,
    -- compute all milestone fields from joined event tables
    ...
  FROM patients p
  LEFT JOIN screening_events se ON se.patient_id = p.id
  LEFT JOIN referrals r ON r.patient_id = p.id
  LEFT JOIN diagnostic_evaluations de ON de.patient_id = p.id
  GROUP BY p.id;

-- Refresh trigger (called by after-insert triggers on each event table)
CREATE OR REPLACE FUNCTION refresh_pathway_milestones()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY pathway_milestones_mv;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## 35. Connection Pooling and Export Queue Architecture

> 🟡 **HIGH** — Required before go-live to handle concurrent clinical use.

### 35.1 Connection pooling

Node.js creates a new database connection per request by default. A morning
screening rush of 10 simultaneous data entries will exhaust PostgreSQL's
`max_connections` (typically 100 by default) without pooling.

Add **PgBouncer** (if self-hosting) or use the built-in connection pooler from
your hosting provider (Supabase, AWS RDS, Neon all include one). Configure:
- **Transaction mode** for API routes (short-lived, high concurrency)
- **Session mode** for long-running export jobs (they need a persistent
  connection for the duration of the query)

The `DATABASE_URL` environment variable must point to the **pooler endpoint**,
not directly to PostgreSQL.

### 35.2 Export queue architecture

Research exports (§21) can take 30–120 seconds and generate 50–200 MB files.
These must not block API requests.

**Architecture:**

```
POST /exports/generate
  → validates request, creates exports row (status=QUEUED)
  → enqueues job to BullMQ "exports" queue
  → returns { jobId } immediately (HTTP 202)

BullMQ worker (separate process, concurrency: 2):
  → picks up job
  → updates exports row (status=RUNNING)
  → runs SQL query, generates file (CSV/SPSS/Stata/Excel)
  → uploads to object storage (S3/Supabase Storage)
  → updates exports row (status=COMPLETE, file_path, file_size_bytes, expires_at)

GET /exports/:jobId/status → poll until COMPLETE or FAILED
GET /exports/:jobId/download → generates short-lived signed URL (24h)
```

**`exports` table** (add to data model):

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | FK to users | |
| site_id | FK to sites | |
| theme | string | Which of the 7 export themes |
| format | enum (CSV, SPSS, STATA, EXCEL) | |
| status | enum (QUEUED, RUNNING, COMPLETE, FAILED) | |
| date_from | date, nullable | Filter applied |
| date_to | date, nullable | |
| file_path | string, nullable | Object storage path |
| file_size_bytes | integer, nullable | |
| created_at | datetime | |
| completed_at | datetime, nullable | |
| expires_at | datetime, nullable | 24h from completed_at |
| error_message | text, nullable | If FAILED |

Export files must be **encrypted at rest** in object storage. Use a dedicated
`EXPORT_ENCRYPTION_KEY` (add to §23 env variables) — distinct from
`BACKUP_ENCRYPTION_KEY` so they can be rotated independently.

---

## 36. Dashboard Caching Strategy

> 🟢 **MEDIUM** — Important before sustained multi-user concurrent use.

Without caching, every dashboard page load runs full aggregation queries across
all patient records. Multiple supervisors loading the dashboard simultaneously
creates a significant DB load spike.

### 36.1 Redis cache for KPI cards

Cache the 7 KPI card values in Redis with a **5-minute TTL**:

```
cache key: dashboard:kpis:<site_id>
TTL: 300 seconds
Invalidate on: any write to screening_events, pathway_milestones, referrals
```

### 36.2 Quality snapshots for trend data

The `quality_snapshots` table (§4.11) is populated by the nightly BullMQ job.
The dashboard trend charts must read from `quality_snapshots` rather than
recalculating from raw events. This means the trend data is at most 24 hours
stale — acceptable for a weekly-reviewed quality indicator.

### 36.3 Action-needed table cadence

The action-needed patient list (§19) requires scanning all active patients.
Compute this list once per **15-minute interval** via a BullMQ scheduled job
and cache the result in Redis. Do not compute it on every page load.

---

## 37. Expanded Data Model — STROBE and JCIH Completeness

These additions are required to support the planned journal papers and to satisfy
STROBE cohort study reporting guidelines. Fields marked ⚠ require IREC
sign-off before being added to the consent form and data collection protocol.

### 37.1 Socioeconomic and access variables (add to `patients`)

> ⚠ **IREC sign-off required** — These fields were not in the original IREC
> application. Adding them requires a protocol amendment before data collection
> begins. Plan this before submitting to IREC.

| Field | Type | Notes |
|---|---|---|
| `distance_to_hospital_km` | numeric(6,2), nullable | Strongest predictor of LTFU in African EHDI literature |
| `transport_time_minutes` | integer, nullable | Alternative or supplement to distance |
| `primary_caregiver_education_level` | enum (NONE/PRIMARY/SECONDARY/TERTIARY) | Standard socioeconomic confounder |
| `household_income_bracket` | enum (BELOW_5K/5K_TO_20K/20K_TO_50K/ABOVE_50K) | Values in KES/month; provisional — confirm bands with statistician |
| `insurance_type` | enum (NHIF/PRIVATE/NONE/OTHER) | Affects referral follow-through |
| `parity` | integer, nullable | Mother's number of previous births |
| `antenatal_care_visits` | integer, nullable | Proxy for healthcare access |

### 37.2 Equipment tracking (new `equipment` table)

Required for the feasibility/implementation paper — journal methods sections
require specific equipment identification.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| site_id | FK to sites | |
| make | string | e.g. "Natus" |
| model | string | e.g. "MiniMuff" |
| serial_number | string | |
| equipment_type | enum (OAE/AABR/BOTH) | |
| calibration_date | date | |
| calibration_due_date | date | |
| active | boolean | |
| notes | text, nullable | |

The `screening_events.equipment_id` FK (§4.4) should reference this table.
When the equipment is calibrated, a supervisor updates `calibration_date` and
the system recomputes `calibration_due_date` (typically +12 months).

Add to `operational_logs`: an `equipment_calibration_current` boolean — the
daily log should confirm whether all equipment was within calibration at the
time of use.

### 37.3 Screener qualification (add to `users`)

| Field | Type | Notes |
|---|---|---|
| `qualification_level` | enum (AUDIOLOGIST/NURSE/CHW/TECHNICIAN) | Independent variable in feasibility paper (task-shifting analysis) |
| `qualification_verified_at` | date, nullable | Date the qualification was confirmed by Admin |
| `experience_months_at_start` | integer, nullable | Baseline experience when account was created |

`screener_experience_months` for any given screening event is computed as the
months between `users.created_at` and `screening_events.tested_at` — do not
store it redundantly.

### 37.4 JCIH 2019 missing risk factors (add to `risk_factors`)

The existing `risk_factors` table (§4.5) is missing three indicators from the
JCIH 2019 Position Statement:

| Field | Type | Notes |
|---|---|---|
| `cytomegalovirus_cCMV` | boolean | Congenital CMV — explicitly listed as standalone in JCIH 2019; distinct from the broader `torch_infections` field |
| `chemotherapy_exposure` | boolean | Added in JCIH 2019 |
| `caregiver_concern_about_hearing` | boolean | JCIH 2019 explicitly adds this as a valid risk indicator, particularly for infants presenting late |

### 37.5 Hearing aid and intervention outcome variables (add to `diagnostic_evaluations`)

Required for the intervention outcomes paper:

| Field | Type | Notes |
|---|---|---|
| `hearing_aid_type` | enum (BTE/ITE/BAHA/CROS/NONE), nullable | |
| `hearing_aid_ear` | enum (LEFT/RIGHT/BILATERAL), nullable | |
| `hearing_aid_cost_KES` | integer, nullable | Cost-effectiveness paper |
| `funding_source` | enum (NHIF/OUT_OF_POCKET/DONOR/GOVERNMENT/OTHER), nullable | Access paper |
| `cochlear_implant_assessment_date` | date, nullable | Tracks 6-month JCIH milestone more precisely |
| `early_intervention_type` | enum (AVT/ASL/TC/NONE/PENDING), nullable | AVT = auditory-verbal therapy |
| `family_notified_at` | datetime, nullable | When family was told the diagnosis result |
| `early_intervention_referral_date` | date, nullable | Date referral was made (distinct from enrolment start date) |
| `follow_up_planned_at` | date, nullable | Next audiological monitoring appointment |

### 37.6 Family history detail (add to `risk_factors`)

The existing `family_history_hearing_loss` boolean is insufficient for the
risk-factor paper. Add:

| Field | Type | Notes |
|---|---|---|
| `family_history_degree` | enum (FIRST_DEGREE/SECOND_DEGREE/UNKNOWN), nullable | Only meaningful if `family_history_hearing_loss = true` |
| `family_history_relation` | enum (PARENT/SIBLING/GRANDPARENT/OTHER), nullable | |

### 37.7 Screening protocol version (add to `screening_events`)

| Field | Type | Notes |
|---|---|---|
| `screening_protocol_version` | string | Version string of the protocol in use at time of screening, e.g. "MRH-EHDI-v1.0". If the protocol changes mid-study, this records which version applied to each event — critical for the methods section. |

Add a `protocols` reference table or manage as a simple version string per the
team's preference. The important thing is that protocol version is captured per
event, not just per study.

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

## 41. Disaster Recovery — RTO and RPO

> 🔴 **BLOCKER** — The backup procedure (§24) is well specified but the recovery
> objectives are not defined. Without them, there is no way to evaluate whether
> the backup strategy is adequate.

### 41.1 Define RPO and RTO

| Objective | Definition | Decision |
|---|---|---|
| **RPO** (Recovery Point Objective) | Maximum acceptable data loss | Daily backups = up to 24 hours of data loss (10–30 patient records on a busy day). If this is unacceptable, move to hourly backups or enable PostgreSQL WAL streaming replication. **Decision required from clinical lead.** |
| **RTO** (Recovery Time Objective) | Maximum acceptable downtime before system is restored | Suggested: 4 hours (half a clinical day). If the server goes down in the morning, the clinic operates on paper backup forms (§22) for up to 4 hours while restoration is underway. **Decision required from clinical lead.** |

### 41.2 Recovery runbook

Create `docs/ops/recovery-runbook.md` with the following procedure:

1. **Declare incident** — notify the DPO and clinical lead within 1 hour of
   confirmed data loss or system outage (required under DPA 2019 §41 —
   72-hour breach notification window starts here)
2. **Assess scope** — determine what data is affected and the timeline
3. **Provision replacement** — spin up a new server using the infrastructure
   configuration (document this separately as `docs/ops/server-setup.md`)
4. **Restore database** — follow the procedure in §24.2
5. **Verify restore** — run record count checks; spot-check 5 random patient
   records
6. **Update DNS / load balancer** — point traffic to the new server
7. **Notify users** — inform clinical staff the system is restored
8. **Post-incident review** — log in `qi_review_log` within 48 hours; document
   what failed, what data (if any) was lost, and corrective actions

### 41.3 DPA breach notification obligation

Under Kenya DPA 2019 Section 43, a data breach must be reported to the ODPC
within **72 hours** of becoming aware of it. "Data breach" includes accidental
loss or destruction of patient data, not just malicious access. The incident
response procedure in §12.5 should explicitly reference this 72-hour window and
name the person responsible for filing the notification (typically the DPO).

---

## 42. Training Events Log

> 🟢 **MEDIUM** — Required data for the implementation-science paper.

Add a `training_events` table to capture the training delivery data that will
be reported in the implementation-science paper:

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| site_id | FK to sites | |
| training_date | date | |
| trainer_name | string | May be external to the system |
| training_type | enum (INITIAL/REFRESHER/PROTOCOL_UPDATE/EQUIPMENT_CALIBRATION) | |
| staff_trained_count | integer | |
| topics_covered | text | |
| pre_competency_score | numeric(5,2), nullable | Average pre-training competency assessment (if conducted) |
| post_competency_score | numeric(5,2), nullable | Average post-training competency assessment |
| notes | text, nullable | |
| recorded_by | FK to users | |
| created_at | datetime | |

The Supervisor role can create and view training events. This table feeds
directly into the implementation-science paper's training fidelity section.

---

## 43. API Versioning and Schema Change Policy

> 🟢 **MEDIUM** — Required before first export is run by the statistician.

### 43.1 Schema change policy

After the first 50 patients are enrolled, no **breaking changes** to the data
model may be made without:

1. A formal migration plan reviewed by the clinical lead
2. IREC notification if the change affects what was consented (e.g. adding a
   new data field changes the scope of data collected)
3. An entry in `CHANGELOG.md` (see below)
4. A version bump in the API (see below)

**Non-breaking additions** (new nullable columns, new tables, new export themes)
do not require IREC notification but must still be logged in `CHANGELOG.md`.

### 43.2 CHANGELOG.md

Maintain a `CHANGELOG.md` in the repository root. Every schema change must be
recorded with:
- Date
- Fields added, modified, or removed
- Reason
- Whether IREC notification was required and filed

This becomes a citable document in the methods section: "The database schema
was version X.Y throughout the study period; one non-breaking field addition
was made on [date] to capture [variable] as recommended by the journal
reviewer."

### 43.3 API versioning

The current routes are under `/api/v1/`. If a breaking API change is required:
- Increment to `/api/v2/`
- Maintain `/api/v1/` for a minimum of 30 days (to give any integration clients
  time to migrate)
- Document the change in `CHANGELOG.md`

---

## 44. Security Architecture — Layered Overview

The complete security architecture has 10 layers. Read from outermost to
innermost. A breach that bypasses an outer layer is stopped by inner layers.

```
Layer 1:  ODPC Registration + DPIA (§26) — Legal/regulatory barrier
Layer 2:  KMPDC Certificate of Data Handler (§26.5) — Regulatory
Layer 3:  HTTPS/TLS + 6 Security Headers (§27) — Transport security
Layer 4:  Rate Limiting — specific limits per endpoint (§28) — Brute-force protection
Layer 5:  Authentication: bcrypt + JWT + TOTP 2FA (§12.1) — Identity
Layer 6:  RBAC at API layer + DB-level views (§12.2, §30.3) — Authorisation
Layer 7:  PostgreSQL RLS + Separate DB roles (§30) — Query-level isolation
Layer 8:  Column-level encryption + Key in secrets manager (§12.4, §29) — Data at rest
Layer 9:  Append-only Audit Log + DB-level trigger (§30.2) — Forensic immutability
Layer 10: Encrypted backups + monthly restore test (§24) — Data loss protection
```

A breach through layers 1–3 is stopped at 4–5. Through 4–5, stopped at 6–7.
Through 6–7, layer 8 means plaintext identifiers are still unreadable. Any
breach at any layer leaves a forensic trail in layer 9. Layer 10 protects
against non-malicious data loss.

---

## 45. Pre-Deployment Checklist

Use this checklist as a gate before go-live. Items are grouped by when they
must be complete. No item in the 🔴 group may be deferred.

### Must complete before first patient record (🔴 BLOCKERS)

- [ ] ODPC registration as Data Controller complete
- [ ] DPIA filed with ODPC (60 days before processing begins)
- [ ] Data Protection Officer designated and formally named
- [ ] KMPDC Certificate of Data Handler obtained
- [ ] TLS certificate installed with auto-renewal configured
- [ ] HTTP → HTTPS redirect configured (301)
- [ ] All 6 security headers present on every HTTP response
- [ ] Rate limits implemented on login, 2FA, reset, and export endpoints
- [ ] All secrets stored in secrets manager, not `.env` file on server
- [ ] Log scrubbing middleware redacts encryption keys from all output
- [ ] PostgreSQL: four separate DB roles created (app_rw/app_ro/app_audit/app_migration)
- [ ] PostgreSQL: `audit_log` UPDATE/DELETE trigger in place
- [ ] PostgreSQL: Row Level Security enabled on all `site_id` tables
- [ ] WhatsApp webhook: `X-Hub-Signature-256` validation in place
- [ ] Africa's Talking callback: IP allowlist in place
- [ ] All required indexes added (§34)
- [ ] `pathway_milestones` implemented as materialised view
- [ ] STROBE eligibility fields added: `eligible`, `ineligible_reason`, `patient_exit_reason`
- [ ] `patient_exit_reason` uses coded enum (not free text)
- [ ] JCIH 2019 risk factors added: `cytomegalovirus_cCMV`, `chemotherapy_exposure`, `caregiver_concern_about_hearing`
- [ ] `fieldMetadata.ts` annotations exist for all exported fields
- [ ] CI check enforcing `fieldMetadata` coverage is passing
- [ ] OWASP ZAP scan completed; all Critical/High findings resolved; report saved
- [ ] Manual threat model reviewed by at least one person not on the build team
- [ ] RPO and RTO defined and agreed with clinical lead
- [ ] Recovery runbook written (`docs/ops/recovery-runbook.md`)
- [ ] `CHANGELOG.md` initialised with schema version 1.0

### Must complete within 30 days of first patient record (🟡 HIGH)

- [ ] Socioeconomic variables added after IREC protocol amendment approved: distance, education, income, insurance, parity, ANC visits
- [ ] `equipment` table created with make/model and calibration date
- [ ] `qualification_level` added to `users`
- [ ] `hearing_aid_type`, `funding_source`, `early_intervention_type`, `family_notified_at`, `early_intervention_referral_date` added to `diagnostic_evaluations`
- [ ] `data_completeness_score` and `analyst_exclusion_flag` added to `pathway_milestones`
- [ ] PgBouncer or equivalent connection pooling configured
- [ ] BullMQ export worker process running separately from web server
- [ ] Export files writing to object storage (not local filesystem)
- [ ] `exports` table created; export history UI working
- [ ] `EXPORT_ENCRYPTION_KEY` added to secrets and export files encrypted at rest
- [ ] `training_events` table created
- [ ] Family history detail fields added to `risk_factors`
- [ ] Screening protocol version field added to `screening_events`
- [ ] STROBE flow diagram export theme (Theme 8) implemented

### Must complete before first export for publication (🟢 MEDIUM)

- [ ] Schema change policy communicated to all team members
- [ ] Statistician walkthrough of export formats completed; sign-off documented
- [ ] SPSS and Stata outputs validated by opening in actual SPSS/Stata (pyreadstat output)
- [ ] Session fixation protection verified (new JWT issued on every post-2FA login)
- [ ] Device fingerprint logging implemented in Redis refresh token store
- [ ] Dashboard Redis caching implemented (5-min TTL on KPI cards)
- [ ] Action-needed table computed on 15-minute interval (not on page load)
- [ ] `double_screened` and `second_screener_result` fields added to `screening_events`
- [ ] `training_events` data entry is current and complete

---

---

## 46. Role-Based Workflow Specification

This section defines exactly what each role does, step-by-step, in the system. The goal is that a developer can build the correct UI for each role without having to infer intent from the data model alone.

### 46.1 The two-person clinical workflow (the most important concept in this document)

The system is designed around a **deliberate split** between two roles that operate simultaneously in the screening room:

| | Data Clerk | Screener |
|---|---|---|
| **Physical location** | Workstation outside or beside the screening room | Inside the screening room with the baby |
| **Equipment used** | Computer with the web application | OAE or AABR machine |
| **Job** | Enters all data into the system in real time | Performs the test, reads the machine result, communicates it verbally or on a slip to the clerk |
| **Form complexity** | 10–15 minutes per baby — thorough | 30–60 seconds per result — minimal |
| **Does NOT do** | Perform the test or interpret clinical results | Enter data into the computer (in normal operation) |

This split exists because the data required per baby is extensive and would disrupt clinical flow if the screener had to enter it. The clerk handles the data burden; the screener handles the clinical act.

### 46.2 Data Clerk workflow — step by step

**Step 1: Register new child**
The clerk registers the child before the screening happens (ideally when the baby arrives at the unit). This opens a multi-section form:

- **Section A — Baby information:** date/time of birth, sex, birth weight, gestational age, delivery type, Apgar score at 5 minutes, hospital number (if assigned), NICU admission (yes/no), NICU days if admitted
- **Section B — Mother/guardian information:** mother's full name, mother's age, primary phone number, alternative/guardian phone, WhatsApp number (if different), email (optional), residence county, sub-county, nearest town
- **Section C — Consent:** record that the mother was given the consent form and either gave or refused consent. Select consent form version from a dropdown. Add witness name if applicable. **Hard gate: no research data is collected or exported if consent = REFUSED or PENDING.**
- **Section D — Risk factors:** structured JCIH checklist (all boolean fields from §4.3). Several auto-suggest based on earlier entries (e.g. if gestational age < 37 weeks, the prematurity flag is pre-checked and shown as "auto-detected" but the clerk must confirm). The clerk does not type free text here — only checks boxes.
- **Section E — Parent survey** (administered pre-discharge, may be completed separately after screening is done): five 1–5 scoring questions, two yes/no questions, two knowledge questions, open comments box.

The form is divided into these sections with tab or step navigation. The clerk can save at the end of any section and return — the record is in draft state until submitted. A submitted record triggers research ID generation.

**Step 2: Find the child for screening entry**
When the screener has completed a test and reports the result, the clerk:
1. Opens the child search (§47)
2. Finds the correct child record (see §47 for duplicate handling)
3. Opens the child's profile — the current pathway state for each ear is shown prominently
4. Clicks "Add Screening Result"

**Step 3: Enter the screening result (clerk entering what screener reports)**
The clerk fills a short form with the fields the screener communicates:
- Ear (Left / Right / Both — if both ears were tested in one session, the clerk enters two records)
- Stage (auto-suggested from pathway state — the system knows what stage this ear is at)
- Modality (auto-locked for NICU>5-day babies per §17.1 — the clerk cannot override this)
- Equipment ID (dropdown from registered equipment list)
- Probe fit quality (OAE only)
- Ambient noise level
- Number of attempts
- Duration in minutes
- Result: **PASS / NOT_PASS / INCOMPLETE** (this is the key clinical outcome — entered by the clerk based on verbal report from screener)
- Incomplete reason (required if result = INCOMPLETE)
- Screener's clinical comment (free text, optional, not exported as a coded variable) — the screener may verbally add a comment ("baby was unsettled, may need to retest") which the clerk types here
- Tested at: the actual time the test was performed (defaults to now, but clerk can adjust if there was a delay between test and entry)

**Step 4: System takes over**
On save, the pathway engine:
- Computes the new state for that ear
- Automatically creates any required follow-up records (referral, notification schedule)
- Updates `pathway_milestones`
- Adds to the action-needed list if any milestone is now overdue

The clerk sees an immediate confirmation: "Screen 1 result saved — right ear: PASS. Left ear: result already recorded as PASS. Both ears passed — pathway complete."

### 46.3 Screener workflow — step by step

The screener's role in the system is intentionally minimal. The screener does not do data entry in normal operation. However, the screener has read access to records and one specific write action:

**View child record:** The screener can look up a child to review what has been entered (useful for double-checking: "did the clerk record left or right ear?")

**Flag for correction:** If the screener sees that a result was logged incorrectly (e.g. "the clerk recorded left ear but I tested right ear"), the screener clicks "Flag for Correction" on that specific screening event record, types a brief reason, and submits. This does not edit the record — it creates a correction request that the Data Clerk and Supervisor can see and action. The screener cannot edit records directly.

**Screener login purpose:** The screener account exists primarily so that `screener_id` on each `screening_event` is a real authenticated user ID, not just a name typed in a text box. This is required for the feasibility paper's task-shifting analysis (which qualification level of screener produced what accuracy).

### 46.4 Supervisor workflow

The Supervisor reviews the Action-Needed table daily, approves late correction requests, manages the operational log, and has read access to all records including the quality dashboard. The Supervisor cannot generate research exports.

### 46.5 Researcher workflow

The Researcher has access only to the Export portal (§21) and the aggregate Quality Dashboard. The Researcher cannot open individual patient records, cannot see mother names or phone numbers, and cannot access the audit log. All exports are pseudonymized by the system enforcing the `v_export_patients` view.

### 46.6 Admin workflow

The Admin manages users (create, deactivate, change role), manages sites, views the audit log, and has full read/write access to all records. The Admin cannot modify the audit log — no one can.

---

## 47. Child Search and Duplicate Name Handling

### 47.1 Search interface

The child search is accessible from the top navigation bar (persistent, all roles except Researcher). It accepts free text and searches across multiple fields simultaneously:

| Search input | Fields searched |
|---|---|
| Numeric string (e.g. `MRH-2026-00045`) | `research_id` exact match |
| Numeric string (e.g. `12345`) | `hospital_number` exact match |
| Phone number format (e.g. `0722...`) | `mother_phone`, `guardian_phone_alt`, `whatsapp_number` |
| Text string | `mother_name` (partial match), baby surname derived from mother name |
| Date (e.g. `2026-05-14`) | `date_of_birth` |

The search returns a results list showing, for each match:
- Research ID (always shown — this is the canonical identifier)
- Date of birth
- Sex
- Mother's name (shown only to roles with PII access — not shown to Researcher)
- Hospital number (if assigned)
- Current pathway status badge (PASSED / IN_PROGRESS / REFERRED / DIAGNOSED / LOST_TO_FOLLOWUP)

The clerk selects the correct record from this list. If there is exactly one result, a single click opens the record directly. If there are multiple results, the list is shown for the clerk to choose.

### 47.2 Duplicate name handling

Duplicate names are common in Kenya and must be handled gracefully — not treated as an error or a surprise.

**When 2 or more records share the same mother name:**
The search results list shows all matches, each with their distinguishing fields visible: DOB, hospital number, research ID, and pathway status. The clerk must actively select one — the system never auto-opens a record when multiple matches exist.

**Identity confirmation step:**
Before opening a child's record from a search result, the system shows a brief confirmation card:
> "You are about to open the record for **MRH-2026-00031** — baby born **14 May 2026**, mother **[name]**, hospital number **7823**. Is this correct?"
The clerk confirms (Yes / No, let me search again). This one-click confirmation step prevents the most common data entry error: entering a screening result on the wrong child's record.

**Duplicate detection on new registration:**
When a clerk completes the registration form and clicks Submit, the system runs a background duplicate check before saving:
- Same mother name (fuzzy match — see §47.3) **AND** DOB within 7 days → shows a warning panel with the possible duplicate records
- Same phone number as an existing record → shows a warning
- Same hospital number as an existing record → blocks save (hospital numbers must be unique; this is a hard error, not a warning)

The clerk can override a name/DOB warning (twins are common; the same mother can legitimately have two records close together) but must explicitly confirm: "I have checked these are different babies." That confirmation is logged in the audit trail.

**Clerk cannot override a hospital number collision.** This is a hard stop — the same hospital number cannot belong to two different babies.

### 47.3 Fuzzy name matching (implementation note — AI-ready design)

Use **Fuse.js** (client-side fuzzy search library, zero backend cost) for the name search component. This handles:
- "Mary Wanjiku" matching "Mary Wanjiku Kamau" (substring)
- "Fatuma" matching "Fatouma" (typo tolerance)
- "Amina Mohammed" matching "Amina Mohamed" (spelling variant)

Configuration: `threshold: 0.4`, `keys: ['mother_name']`. Do not use pure SQL `ILIKE` for name search — it misses transposition errors and spelling variants that are common with Kenyan names transcribed across languages.

**AI-readiness note:** This fuzzy matching logic is intentionally kept in a standalone `lib/search/fuzzyMatch.ts` utility with no database dependencies — the same function will later be callable by an AI layer to check for duplicates during conversational data entry without re-implementation.

---

## 48. Complete Page and Screen Inventory

Every URL in the system is listed here. Role access is shown using the abbreviations: CL = Data Clerk, SC = Screener, SV = Supervisor, RE = Researcher, AD = Admin.

### 48.1 Authentication screens (public — no auth required)

| Page | URL | Description |
|---|---|---|
| Login | `/login` | Email + password. On success, redirects to 2FA challenge if 2FA is set up, or to `/dashboard` if not yet configured (first-time user). |
| 2FA Challenge | `/login/2fa` | TOTP code entry. Issued after successful password verification. 5-minute timeout — after which user is redirected back to `/login`. |
| Request Password Reset | `/login/reset` | Enter email address; system sends reset link. |
| Set New Password | `/login/reset/[token]` | Enter and confirm new password. Token expires in 1 hour. |
| First Login — Set Up 2FA | `/onboarding/2fa` | Shown on first login only. Displays QR code for authenticator app setup. Cannot skip. |

### 48.2 Main application screens

| Page | URL | Roles | Description |
|---|---|---|---|
| Dashboard | `/dashboard` | All | Role-sensitive. Clerk sees action-needed list + today's screening count. Screener sees today's completed screenings. Supervisor sees full KPI cards + action-needed + trend charts. Researcher sees aggregate KPIs only (no patient list). Admin sees everything. |
| Register New Child | `/children/new` | CL, AD | Multi-section registration form (§46.2 Step 1). |
| Child Search Results | `/children/search?q=[query]` | CL, SC, SV, AD | Shows list of matching records with identity confirmation step. |
| Child Profile | `/children/[id]` | CL, SC, SV, AD | Full child record: demographics, risk factors, consent status, pathway timeline (visual per-ear timeline), screening history, referrals, notifications log, parent survey status. |
| Add Screening Result | `/children/[id]/screenings/new` | CL, AD | Short form — the screener result entry form (§46.2 Step 3). Pre-populated with child name, DOB, and current pathway state for context. |
| Edit Screening Result | `/screenings/[eventId]/edit` | CL (within edit window), SV | Edit a saved screening event. Opens with before/after comparison view. |
| Flag Screening for Correction | `/screenings/[eventId]/flag` | SC | Screener correction flag form. Single text field: reason. Submit creates a correction request. |
| Add Risk Factors | `/children/[id]/risk-factors` | CL, AD | JCIH risk factor checklist. If risk factors already exist, this page shows the existing record in edit mode. |
| Record Consent | `/children/[id]/consent` | CL, AD | Consent status form. |
| Add Referral | `/children/[id]/referrals/new` | CL, AD | Auto-populated from the triggering screening event. Clerk adds provider name and facility. |
| Update Referral | `/referrals/[referralId]/edit` | CL (within window), SV | Update referral outcome (cleared, treated, no-show, etc.). |
| Add Diagnostic Evaluation | `/children/[id]/diagnostics/new` | CL, AD | Diagnostic evaluation form including audiogram data (§20.5). |
| Parent Survey | `/children/[id]/survey` | CL, AD | Pre-discharge satisfaction/knowledge questionnaire. |
| Operational Log | `/operational-logs` | CL, SV, AD | Daily log list. |
| Add Operational Log | `/operational-logs/new` | CL, AD | Daily data entry form — births, screenings, missed reasons, equipment, consumables. |
| Paper Backup Entry | `/children/[id]/screenings/new?source=paper` | CL, AD | Same as Add Screening Result but with `entry_source = PAPER_BACKUP` flag, two timestamp fields, and the confirmation checkbox (§22.3). |
| Quality Dashboard | `/quality` | All | KPI cards, pathway funnel chart, trend line charts, bar charts (§8.1). Researcher sees aggregate view only. |
| Action-Needed List | `/quality/action-needed` | CL, SV, AD | Full list of patients with overdue milestones. Clicking a row opens the child profile. |
| Correction Requests | `/corrections` | CL (own requests), SC (own flags), SV (all), AD (all) | Queue of pending correction requests. Supervisor approves or rejects each. |
| Research Export Portal | `/exports` | RE, AD | Export theme cards, configuration modal, export history table (§21). |
| Export Job Status | `/exports/[jobId]` | RE, AD | Poll status of a running export job. Auto-refreshes every 5 seconds. |
| User Management | `/admin/users` | AD | List of all users, active/inactive toggle, role badge, last login. |
| Add User | `/admin/users/new` | AD | Create new user account. System sends welcome email with temporary password and link to set 2FA. |
| Edit User | `/admin/users/[userId]/edit` | AD | Update role, deactivate account. |
| Site Management | `/admin/sites` | AD | List and edit registered sites. |
| Equipment Registry | `/admin/equipment` | SV, AD | Register equipment (make, model, serial, type). Update calibration dates. |
| Training Events | `/admin/training` | SV, AD | Log training sessions (§42). |
| Paper Backup Form | `/admin/paper-backup-form` | SV, AD | Download printable PDF of the paper backup form. Version-stamped. |
| Audit Log Viewer | `/admin/audit-log` | AD | Paginated, filterable audit log. Filter by table, record ID, user, date range. Read-only. No one can edit or delete entries. |
| My Profile | `/profile` | All | See §49. |

### 48.3 Total page count

**Public/auth:** 5 screens
**Clinical (child data):** 13 screens
**Quality/operations:** 3 screens
**Admin:** 8 screens
**Profile:** 1 screen

**Total: 30 screens** (some routes have sub-variants e.g. `?source=paper`; these share the same component with conditional fields, not separate pages).

---

## 49. Profile Page Specification

URL: `/profile`
Access: All roles

The profile page is the only place where a user manages their own account settings. It is always accessible from the top navigation bar via the user's name/avatar.

### 49.1 Profile information section

| Field | Editable | Notes |
|---|---|---|
| Full name | Yes | Displayed throughout the app and in audit log entries |
| Email address | Yes | Changing email requires re-verification — system sends a confirmation link to the new address before changing |
| Phone number | Yes | Used as an SMS fallback contact for system alerts (not clinical SMS — those go to patients) |
| Role | No — read-only | Only Admin can change a user's role |
| Site | No — read-only | Only Admin can reassign a user to a different site |
| Account created | No | Display only |
| Last login | No | Display only; shows date, time, and approximate location (city-level IP geolocation) |

Saving the information section requires the user to enter their current password to confirm identity (prevents someone who walks up to an unlocked workstation from changing the account email).

### 49.2 Change password section

Three fields: Current password, New password, Confirm new password.

Password requirements:
- Minimum 12 characters
- At least one uppercase, one lowercase, one digit, one symbol
- Cannot be the same as the last 5 passwords (stored as hashes — not plaintext)
- Must not match any entry in the HaveIBeenPwned database (check via the k-Anonymity API — never send the full password hash)

On success: all existing refresh tokens for this user are invalidated (same mechanism as deactivation in §25), requiring re-login on all devices. The user is notified by email.

### 49.3 Two-Factor Authentication section

Shows current 2FA status: Enabled (with date enabled) or Not Enabled.

- **If not enabled:** Shows "Set Up 2FA" button → opens QR code modal → user scans with authenticator app → enters TOTP code to confirm → 2FA is enabled. Shows 10 one-time backup codes — user must download or copy them before dismissing.
- **If enabled:** Shows "Reset 2FA" button (disables current TOTP, issues new QR code) and "Disable 2FA" button. Disabling 2FA requires entering the current TOTP code + current password. Disabling 2FA by Admin on behalf of a user requires a second Admin confirmation.

### 49.4 Active sessions section

Shows a list of active sessions (each refresh token entry in Redis):
- Browser / device (from user-agent)
- Approximate location (city-level IP)
- Last active timestamp

"Revoke this session" button on each entry. "Revoke all other sessions" button at the bottom.

### 49.5 Logout

A persistent **Log Out** button is in the top navigation bar, always visible regardless of which page is open. Clicking it:
1. Calls `POST /auth/logout` (invalidates refresh token on server)
2. Clears the access token from memory
3. Redirects to `/login`

There is no "are you sure?" confirmation on logout — it should be fast and frictionless. Clinical staff step away from workstations frequently.

**Auto-logout:** The application auto-logs out after 30 minutes of inactivity (no API calls). A warning modal appears at 25 minutes ("Your session will expire in 5 minutes — click to continue"). This is a regulatory requirement for systems handling health data.

---

## 50. Navigation and Layout Architecture

### 50.1 Layout structure

The application uses a persistent sidebar layout on desktop and a collapsible hamburger drawer on mobile/tablet.

```
┌─────────────────────────────────────────────────────┐
│ TOP BAR                                             │
│  [Logo + System Name]    [🔔 3]   [User Name ▾]    │
│                          (alerts) (profile/logout)  │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│  SIDEBAR   │  MAIN CONTENT AREA                     │
│            │                                        │
│  (nav      │  Breadcrumb: Dashboard > Child Profile  │
│  items     │                                        │
│  per       │  [Page content]                        │
│  role)     │                                        │
│            │                                        │
│            │                                        │
└────────────┴────────────────────────────────────────┘
```

### 50.2 Sidebar navigation items (role-sensitive)

Each role sees only the navigation items relevant to their access:

**Data Clerk:**
- Dashboard
- Register New Child
- Search Children (with persistent search bar)
- Operational Log
- Correction Requests (shows badge count if any of the clerk's requests have been acted on)

**Screener:**
- Dashboard
- Search Children
- Correction Requests (shows badge count for own flags)

**Supervisor:**
- Dashboard
- Search Children
- Quality Dashboard
- Action-Needed List
- Operational Log
- Correction Requests (full queue)
- Training Events
- Equipment

**Researcher:**
- Quality Dashboard (aggregate view only)
- Research Exports

**Admin:**
- Everything above
- User Management
- Site Management
- Audit Log
- System Settings (paper backup form, equipment, training)

### 50.3 Top bar

- **Logo and system name** (left): "CHISHLO EHDI — Mama Rachel Hospital" (or the site name from the `sites` table for multi-site future)
- **Alerts bell** (centre-right): Shows count of unread notifications from the system — not patient SMS notifications, but internal alerts: "3 correction requests pending", "Equipment calibration overdue", "Export ready to download". Clicking opens a dropdown list of alerts with links to action each one.
- **User menu** (right): Shows logged-in user's name and role badge. Dropdown: "My Profile", "Log Out". Role badge colours: Clerk = blue, Screener = green, Supervisor = orange, Researcher = purple, Admin = red.

### 50.4 Breadcrumb navigation

Every page deeper than the top level shows a breadcrumb trail:
- `Dashboard` (clickable)
- `>  Children` (clickable — goes to search)
- `> MRH-2026-00031` (current page — not clickable)

This is especially important on the screening entry form — staff need to know at a glance whose record they are on before submitting a result.

### 50.5 Mobile/tablet behaviour

The sidebar collapses to a hamburger icon on screens narrower than 768px. The top bar persists. The search bar moves to a full-width row below the top bar on mobile. Tables become horizontally scrollable. Forms stack to single-column. The application must be usable on a tablet (iPads are common in clinical settings) even though the primary use case is desktop.

---

## 51. Project Folder and File Structure

This is the canonical project structure any engineer or AI model must follow. The application is a **Next.js 14+ App Router** project.

```
/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Route group: unauthenticated pages
│   │   ├── login/
│   │   │   ├── page.tsx              # Login form
│   │   │   └── 2fa/page.tsx          # TOTP challenge
│   │   ├── login/reset/page.tsx      # Request reset
│   │   └── login/reset/[token]/page.tsx
│   ├── (app)/                        # Route group: authenticated pages
│   │   ├── layout.tsx                # Sidebar + top bar layout (wraps all app pages)
│   │   ├── dashboard/page.tsx
│   │   ├── children/
│   │   │   ├── new/page.tsx          # Register new child
│   │   │   ├── search/page.tsx       # Search results
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Child profile
│   │   │       ├── screenings/new/page.tsx
│   │   │       ├── risk-factors/page.tsx
│   │   │       ├── consent/page.tsx
│   │   │       ├── referrals/new/page.tsx
│   │   │       ├── diagnostics/new/page.tsx
│   │   │       └── survey/page.tsx
│   │   ├── screenings/[eventId]/
│   │   │   ├── edit/page.tsx
│   │   │   └── flag/page.tsx
│   │   ├── referrals/[referralId]/edit/page.tsx
│   │   ├── operational-logs/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   ├── quality/
│   │   │   ├── page.tsx              # Quality dashboard
│   │   │   └── action-needed/page.tsx
│   │   ├── exports/
│   │   │   ├── page.tsx
│   │   │   └── [jobId]/page.tsx
│   │   ├── corrections/page.tsx
│   │   ├── profile/page.tsx
│   │   └── admin/
│   │       ├── users/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [userId]/edit/page.tsx
│   │       ├── sites/page.tsx
│   │       ├── equipment/page.tsx
│   │       ├── training/page.tsx
│   │       ├── paper-backup-form/page.tsx
│   │       └── audit-log/page.tsx
│   └── api/                          # Next.js Route Handlers
│       └── v1/
│           ├── auth/[...route]/route.ts
│           ├── patients/[...route]/route.ts
│           ├── screenings/[...route]/route.ts
│           ├── referrals/[...route]/route.ts
│           ├── diagnostics/[...route]/route.ts
│           ├── notifications/[...route]/route.ts
│           ├── operational-logs/[...route]/route.ts
│           ├── dashboard/[...route]/route.ts
│           ├── exports/[...route]/route.ts
│           ├── corrections/[...route]/route.ts
│           ├── users/[...route]/route.ts
│           ├── sites/[...route]/route.ts
│           └── webhooks/
│               ├── africastalking/route.ts
│               └── whatsapp/route.ts
├── components/                       # Shared React components
│   ├── ui/                           # Base UI (buttons, inputs, modals, badges)
│   ├── layout/                       # Sidebar, TopBar, Breadcrumb
│   ├── children/                     # ChildSearchBar, ChildCard, IdentityConfirmModal
│   ├── screening/                    # ScreeningResultForm, PathwayTimeline, EarStateIndicator
│   ├── dashboard/                    # KPICard, FunnelChart, TrendChart, ActionNeededTable
│   └── forms/                        # Reusable form sections
├── lib/                              # Pure business logic — no Next.js or React imports
│   ├── pathway/
│   │   ├── engine.ts                 # State machine (§17) — pure functions, zero DB calls
│   │   ├── engine.test.ts            # Unit tests for every state transition
│   │   └── types.ts                  # Shared types for pathway states
│   ├── search/
│   │   └── fuzzyMatch.ts             # Fuse.js wrapper (§47.3) — AI-callable, no DB dependency
│   ├── notifications/
│   │   └── scheduler.ts             # Trigger table logic (§18) — pure functions
│   ├── validation/
│   │   └── schemas.ts               # All Zod schemas (patient, screening, referral, etc.)
│   ├── export/
│   │   ├── fieldMetadata.ts          # Single source of truth for export field definitions
│   │   └── themes.ts                 # Export theme definitions (7 themes)
│   ├── ai/                           # AI-readiness layer (Phase 2 — see §53)
│   │   ├── README.md                 # Documents what is reserved for AI integration
│   │   └── .gitkeep                  # Placeholder — intentionally empty in Phase 1
│   └── utils/
│       ├── sanitise.ts               # sanitiseText() for all free-text fields
│       ├── encryption.ts             # Column-level encrypt/decrypt wrappers
│       └── researchId.ts             # research_id generation logic
├── prisma/
│   ├── schema.prisma                 # Prisma schema (single source of truth for DB structure)
│   ├── migrations/                   # Auto-generated by Prisma Migrate
│   └── seed.ts                       # Dev seed data
├── jobs/                             # BullMQ workers (run as separate processes)
│   ├── notifications.worker.ts
│   ├── exports.worker.ts
│   └── quality-snapshots.worker.ts
├── middleware.ts                     # Next.js middleware — auth check on all (app) routes
├── docs/
│   ├── ops/recovery-runbook.md
│   └── security/
│       ├── threat-model.md
│       └── zap-report-prelaunch.html (generated at pre-launch)
├── CHANGELOG.md                      # Schema version history (§43.2)
├── .env.example                      # All required env vars, values blank (commit this)
└── .env                              # Actual secrets (never commit)
```

### 51.1 Key structural rules for any builder

1. **`lib/pathway/engine.ts` must have zero imports from `prisma/`, `app/`, or any network layer.** It takes typed data objects and returns typed results. This keeps it unit-testable and reviewable by a non-engineer.
2. **`lib/search/fuzzyMatch.ts` must have zero database calls.** It receives an array of patient summaries and a search string, returns ranked results. The caller fetches from the DB; this function only does matching. This design allows it to be called from an AI layer later without database coupling.
3. **All Zod schemas live in `lib/validation/schemas.ts`.** Route handlers and form components both import from here — one source of truth for field validation.
4. **The `lib/ai/` folder is reserved.** Do not put unrelated code here. In Phase 1, it stays empty. Its existence signals to future builders where AI integration hooks should go.
5. **BullMQ workers in `jobs/` are separate processes.** They are started with a separate `npm run worker` command and must never be imported into the Next.js application bundle.

---

## 52. Tech Stack — Complete and Unambiguous

This section states the exact tech choices so a new builder does not have to infer them. It extends §13 with implementation-level specificity — §13 explains *why* each category of tool was chosen; this section pins down the *exact* library and version so two different builders (or AI models) don't make divergent choices on the same project.

### 52.1 Core stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | Next.js | 14+ with App Router (not Pages Router). Server Components where possible; Client Components only where interactivity requires it. |
| Language | TypeScript | Strict mode enabled (`"strict": true` in `tsconfig.json`). No `any` type except in generated Prisma types. |
| Database | PostgreSQL | 15+. Hosted on Railway, Neon, Supabase, or AWS RDS — engineer's choice, but must support Row Level Security and connection pooling. |
| ORM | Prisma | 5+. Single `schema.prisma` file. Migrations via `prisma migrate`. |
| Auth | Custom JWT (not NextAuth) | bcrypt for password hashing. `jsonwebtoken` for signing. Redis for refresh token and blocklist store. **Note:** Auth.js/NextAuth *can* be extended to support custom TOTP flows via its Credentials provider — "not possible" overstates it. The recommendation to go custom here is about wanting full control over the temp_token → 2FA-challenge → access_token sequence without working around a framework's assumptions, not because it's impossible otherwise. A builder comfortable with NextAuth's credential callbacks could reasonably choose it instead. |
| 2FA | `otplib` | TOTP (RFC 6238). QR code generation via `qrcode` library. |
| Validation | Zod | All schemas in `lib/validation/schemas.ts`. Used in both route handlers and React Hook Form. |
| Forms | React Hook Form + Zod resolver | `@hookform/resolvers/zod`. |
| Styling | Tailwind CSS | 3+. No component library dependency — build a small `components/ui/` set to keep the bundle lean. |
| State management | React Server Components + URL state | Client-side state via `useState`/`useReducer`. No Zustand or Redux — the data-entry forms are the only complex client state, and RHF handles that. |
| Charts | Recharts | For the quality dashboard. Pure React, no Canvas required. |
| Job queue | BullMQ + Redis | `ioredis` as the Redis client. |
| Fuzzy search | Fuse.js | Client-side, loaded only on pages with child search. |
| Notifications | Africa's Talking SDK (SMS) + Meta Cloud API (WhatsApp) + Nodemailer (email) | |
| Input sanitisation | `isomorphic-dompurify` | Called in Zod preprocessors for all free-text fields. |
| SPSS/Stata export | Python sidecar script using `pyreadstat` | Called via `child_process` from the export BullMQ worker. |
| Error monitoring | Sentry | `@sentry/nextjs`. |
| Fuzzy duplicate detection | Fuse.js | Same library as child search. |

### 52.2 Authentication flow (step by step for any builder)

```
1. POST /api/v1/auth/login
   → Validate email + password
   → If valid, issue short-lived temp_token (5 min JWT, not an access token)
   → Return { temp_token, requires_2fa: true }

2. POST /api/v1/auth/2fa/challenge
   → Validate temp_token (not expired, not already used)
   → Validate TOTP code against user's stored secret
   → Invalidate temp_token (add to Redis blocklist)
   → Issue access_token (15 min) + refresh_token (30 days)
   → Store refresh_token hash in Redis: key = refresh:<user_id>:<jti>
   → Return { access_token, refresh_token, user }

3. Every API request
   → Extract Bearer token
   → Verify JWT signature + expiry
   → Check Redis blocklist for token JTI
   → Check users.active = true
   → Set req.user, proceed

4. POST /api/v1/auth/refresh
   → Validate refresh_token (not in blocklist, not expired)
   → Issue new access_token + new refresh_token (rotation)
   → Delete old refresh_token from Redis
   → Return { access_token, refresh_token }

5. POST /api/v1/auth/logout
   → Add current access_token JTI to Redis blocklist (TTL = remaining lifetime)
   → Delete refresh_token from Redis
   → Return 204
```

### 52.3 Development environment setup

Any engineer taking over this project must be able to run the full system locally with:

```bash
git clone [repo]
cd [repo]
npm install
cp .env.example .env
# Edit .env with your local DB URL and Redis URL
npx prisma migrate dev
npx prisma db seed
npm run dev         # Next.js dev server
npm run worker      # BullMQ worker (separate terminal)
```

For `npx prisma db seed` to find the seed script, add this to `package.json`
(Prisma doesn't auto-detect it, even at the default location):
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

The seed script (`prisma/seed.ts`) must create:
- One test site: "Mama Rachel Hospital"
- One user of each role (admin@test.com, clerk@test.com, screener@test.com, supervisor@test.com, researcher@test.com — all with password `Test1234!`)
- 10 sample patients with varying pathway states (some passed, some in-progress, some referred, one lost-to-follow-up)
- Sample operational logs for the past 30 days
- Sample quality snapshots

This seed data lets any developer see the full UI — including the action-needed list and dashboard charts — on day one without manually entering test data.

### 52.4 Deployment

| Environment | Purpose | Database | Notes |
|---|---|---|---|
| Local | Development | Local PostgreSQL | `npm run dev` |
| Staging | Testing before production releases | Separate DB on same hosting provider | Used for monthly restore tests (§24), OWASP ZAP scan (§33.1) |
| Production | Live clinical use | Hosted PostgreSQL with automated backups | Never run migrations directly on production without a reviewed migration plan |

Recommended hosting for simplicity: **Railway** (manages PostgreSQL, Redis, and the Next.js app in one project; supports separate processes for BullMQ workers; reasonable pricing at research-program scale). Alternative: **Render** (similar capabilities). Both are acceptable. AWS/GCP is overkill for this program volume and adds operational complexity without meaningful benefit at this scale.

---

## 53. AI-Readiness Design

This system is built in Phase 1 without integrated AI features. However, architectural decisions have been made throughout the codebase to ensure AI features can be added in Phase 2 without refactoring the core system.

### 53.1 What is being deferred and why

AI integration is deferred because:
1. The clinical data model must be stable and validated before AI can be trained or prompted against it
2. IREC/ODPC must approve the specific use of AI in a system that processes sensitive health data — this requires a separate protocol amendment after the base system is approved
3. Debugging AI-related errors in a live clinical system is harder than debugging deterministic code — Phase 1 must be provably correct before adding probabilistic components

None of the Phase 1 clinical logic should be replaced by AI. The pathway engine, consent gating, and research exports are rules-based by design.

### 53.2 What has been designed to be AI-compatible

**Isolated pure functions:**
The following functions in `lib/` have been written as pure, dependency-free utilities. An AI layer can call them as tools without any database connection or HTTP request:
- `lib/pathway/engine.ts` — given current state + new event, returns next state + side effects
- `lib/search/fuzzyMatch.ts` — given patient list + search string, returns ranked matches
- `lib/notifications/scheduler.ts` — given pathway event, returns which notifications to schedule

**AI-reserved folder:**
`lib/ai/` is kept empty in Phase 1 but is pre-documented. Phase 2 AI features go here:
- `lib/ai/duplicateDetect.ts` — wraps `fuzzyMatch.ts` with a confidence score for the AI to use when flagging potential duplicates during conversational entry
- `lib/ai/dataEntryAssist.ts` — Claude API integration for natural language data entry (e.g. "enter screen 1 result for baby born yesterday, right ear passed")
- `lib/ai/nlQuery.ts` — natural language query interface for the Researcher role (e.g. "show me all babies referred to audiology in Q1 2026")
- `lib/ai/notificationDraft.ts` — generate reminder message drafts in English and Swahili from pathway context

**API design for AI agents:**
All API routes return structured JSON with consistent field names matching the Prisma schema. Route responses include `_meta` fields (pagination, filters applied, role-filtered fields) that an AI agent needs to navigate the API programmatically. Future AI endpoints will be added under `/api/v1/ai/` — a separate prefix — so they can be access-controlled independently.

**Data dictionary as AI context:**
`lib/export/fieldMetadata.ts` — the single source of truth for field definitions — is designed to be serializable to JSON and passed as context to an AI model. A future "AI researcher assistant" feature can load the full data dictionary into an AI context window and answer questions about the dataset without hallucinating field names.

### 53.3 Phase 2 AI features (to be scoped after Phase 1 go-live)

These are explicitly NOT part of this build. They are listed here so the eventual scope is pre-documented:

1. **Fuzzy duplicate detection assist** — the system currently flags potential duplicates using Fuse.js (§47.3). A Phase 2 AI layer could review flagged pairs and suggest a confidence level, reducing false positives in a high-volume program.
2. **Natural language data entry** — a conversational interface where a clerk could type or speak "Screen 1 right ear passed for baby number 47" and the AI translates this to a structured API call. **This does not replace the structured form — it is an additional entry path for power users.**
3. **Researcher NL query** — a Researcher types "how many babies born in April were referred to audiology?" and the AI generates and executes a safe, read-only SQL query against the anonymized export views.
4. **Notification message drafting** — AI generates the SMS/WhatsApp reminder text (English and Swahili), supervisor reviews and approves before the template goes to Meta for approval.
5. **Anomaly detection** — AI flags when a screener's pass rate deviates significantly from the cohort average over a rolling window (could indicate equipment drift or technique issues). This is for supervisor review, not automated action.

**What AI will never do in this system, even in Phase 2:**
- Make or modify a clinical result (PASS/NOT_PASS/INCOMPLETE) — this is always entered by a human and locked by the audit trail
- Override the NICU>5-day AABR routing rule — this is hard-coded clinical protocol
- Generate or modify research exports without human-initiated action
- Access identifiable fields (mother name, phone number, address) — AI queries run against the same anonymized views as human Researchers

---

## 54. Updated Build Phases (supersedes §14)

§14 is left in place rather than deleted, consistent with this system's own "no hard deletes" governance principle (§11.2) — but the phase plan below is the current one to follow, since it incorporates everything added in §16–53.

| Phase | Scope | What to build | Exit criteria |
|---|---|---|---|
| **0 (parallel)** | Legal/ethics — not engineering | ODPC registration, DPIA, KMPDC certificate, IREC approval, consent form | All 🔴 blockers in §45 checklist complete |
| **1A — Data foundation** | Core schema + auth | Prisma schema (all tables in §4 + §20), migrations, seed script, JWT auth with 2FA, RBAC middleware, audit log trigger | Engineer can run `npm run dev`, log in as each role, and see a blank dashboard |
| **1B — Clinical record** | Registration + screening entry | Register New Child form (§46.2), child search (§47), child profile page, Add Screening Result form, pathway engine (§17), risk factor checklist, consent recording | A clerk can register a baby, record consent, add risk factors, and enter a screening result — system correctly routes the pathway state |
| **1C — Referrals + notifications** | Closing the follow-up loop | Referral creation (auto from pathway engine), referral update, Africa's Talking SMS, WhatsApp integration, BullMQ notification workers, notifications log | System sends an SMS when a baby is referred and logs the send attempt |
| **2A — Operations** | Operational layer | Operational log entry, parent survey, paper backup entry flow, correction requests, screener flag | Supervisor can see today's operational log and action any pending correction requests |
| **2B — Quality dashboard** | Visibility layer | KPI cards, pathway funnel chart, trend charts, action-needed table, dashboard caching (§36) | Supervisor opens the dashboard and sees correct JCIH metrics computed from seed data |
| **3 — Export + publication readiness** | Research layer | Export portal (§21), all 7 export themes, SPSS/Stata sidecar, data dictionary generation, STROBE export (§38.2) | Researcher generates a CSV export of the risk factors theme and a statistician confirms the variable names and values are correct |
| **4 — Pre-launch hardening** | Security + ops | OWASP ZAP scan (§33.1), threat model review, restore test (§24), rate limiting validation (§28), ODPC compliance review (§26) | All items in §45 pre-deployment checklist are checked off |
| **5 — AI features (post go-live)** | AI integration | Scope to be confirmed after Phase 1 is live and IREC/ODPC approval for AI use is obtained. See §53.3. | — |

---

*End of specification (v4.0). Sections 1–15 are the original clinical spec;
sections 16–25 filled the v1.0 engineering gaps; sections 26–45 incorporate
the pre-deployment security, scalability, and journal-grade data completeness
review; sections 46–54 add the role-based UI/workflow layer, page inventory,
project structure, and AI-readiness design on top of the v3.0 engineering
spec. Together they form a complete, self-contained build brief — no prior
conversation history is needed to implement this system.*
