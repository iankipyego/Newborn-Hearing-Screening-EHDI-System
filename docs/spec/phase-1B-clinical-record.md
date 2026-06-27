# Context Pack: Phase 1B — Clinical Record
Builds: Register New Child form, child search, child profile page, Add
Screening Result form, the pathway engine itself, risk factor checklist,
consent recording.

Exit criteria: a clerk can register a baby, record consent, add risk
factors, and enter a screening result — system correctly routes pathway state.

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
