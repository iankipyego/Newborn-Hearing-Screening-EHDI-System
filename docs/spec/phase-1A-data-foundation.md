# Context Pack: Phase 1A — Data Foundation
Extracted from the full Mama Rachel EHDI spec. This is everything you need
to build: Prisma schema, migrations, seed script, JWT auth with 2FA, RBAC
middleware, audit log trigger. Do NOT ask for more spec context than this
file + the file you're currently writing.

Exit criteria: engineer can run `npm run dev`, log in as each role, see a
blank dashboard.

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

The seed script (`db/seed.ts`) must create:
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

