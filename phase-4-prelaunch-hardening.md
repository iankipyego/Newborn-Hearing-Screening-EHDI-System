# Context Pack: Phase 4 — Pre-Launch Hardening
Builds/runs: OWASP ZAP scan, threat model review, restore test, rate
limiting validation, ODPC compliance review.

Exit criteria: every item in the Pre-Deployment Checklist is checked off.

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

