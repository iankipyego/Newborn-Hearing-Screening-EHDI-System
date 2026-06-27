# Context Pack: Phase 2A — Operations
Builds: operational log entry, parent survey (with channel preference +
retry logic), paper backup entry flow, correction requests, screener flag.

Exit criteria: Supervisor can see today's operational log and action any
pending correction requests.

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

