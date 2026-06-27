# Context Pack: Phase 2B — Quality Dashboard
Builds: KPI cards, pathway funnel chart, trend charts, action-needed table,
dashboard caching.

Exit criteria: Supervisor opens the dashboard and sees correct JCIH metrics
computed from seed data.

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

