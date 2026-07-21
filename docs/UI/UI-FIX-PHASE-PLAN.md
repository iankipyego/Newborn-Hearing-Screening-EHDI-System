# EHDI UI Fix — Phase Plan
Each phase is scoped to fit comfortably in one AI session (Claude, ChatGPT, Gemini, DeepSeek) without hitting context/token limits. Do them in order — later phases assume the shared `Button` component from Phase 1 exists. Paste `EHDI-UI-PROTOCOLS.md` plus the relevant phase block below into a fresh session each time.

---

## Phase 0 — Foundation component (do this first, small, ~1 file)
**Goal:** Create `components/ui/Button.tsx` with variants `primary | secondary | destructive | ghost`, sizes `sm | md | lg`, built-in `loading` and `disabled` states, using only design-system tokens. Also create `components/ui/PageHeader.tsx` (title + optional single primary action) if one doesn't exist, to enforce "one primary action per screen."
**Files touched:** `components/ui/Button.tsx` (new), `components/ui/PageHeader.tsx` (new).
**Why first:** Every later phase depends on this — fixing 12 pages' buttons individually would be 12x the work and still risk drifting styles.

## Phase 1 — Home + Auth (Login, 2FA, Reset)
**Goal:** Replace the boilerplate homepage with a real landing screen: project name/branding, one-line description of the EHDI programme, and a single clear "Sign In" button (primary action, no duplicate CTAs). Rebuild `login`, `login/2fa`, `login/reset` to use the shared `Button`, `Input`, dark-mode tokens, and the app's actual visual language (teal/navy, not blue/gray). Remove the leftover test-credential hint from the UI (move it to a `.env`-gated dev banner only, matching the pattern already used in the 2FA test-code banner).
**Files touched:** `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/login/2fa/page.tsx`, `app/(auth)/login/reset/page.tsx`, `app/(auth)/login/reset/[token]/page.tsx`.
**Watch for:** duplicate "submit" vs "sign in" buttons if a page has both a form-submit and a separate link styled as a button.

## Phase 2 — App shell polish (small — this one's already good)
**Goal:** Light audit only. `AppLayout`, `Sidebar`, `TopBar` are already well-built and consistent — don't rebuild. Check: does `TopBar`'s alert bell and profile menu ever both open at once (should be mutually exclusive — code already handles this, verify it still does after other changes); confirm `BreadCrumb` is actually used on every inner page (currently unclear); confirm mobile drawer close-on-navigate still works.
**Files touched:** `components/layout/BreadCrumb.tsx`, spot-check only, likely no rewrite needed.

## Phase 3 — Dashboard
**Goal:** Audit `app/(app)/dashboard/page.tsx` and its chart components (`KPICard`, `FunnelChart`, `TrendChart`, `OperationalChart`, `ActionNeededTable`) for: duplicate action buttons, hardcoded colors instead of chart CSS vars (`--chart-grid` etc. already exist in globals.css — use them), and whether "action needed" items and KPI cards ever show conflicting or redundant calls-to-action.
**Files touched:** `app/(app)/dashboard/page.tsx`, `components/dashboard/*.tsx`.

## Phase 4 — Register / Children flow (largest — split into 4a/4b if needed)
**4a — Registration form:** `children/new/page.tsx`, `components/forms/RegistrationForm.tsx`. Confirm the five-section form (per your earlier `register-child-data-flow.md`) has one clear "Save"/"Register" action, not per-section submit buttons that could confuse where data actually saves.
**4b — Patient record + related actions:** `children/[id]/page.tsx`, `children/[id]/consent`, `risk-factors`, `referrals/new`. Apply the SAFER patient-identification rule from the protocols doc — name+DOB+ID must appear together at the top of every one of these screens, not just some.
**4c — Patient search:** `children/search/page.tsx` — this is currently a stub. Build it using the shared `Input`/`Button`, decide here whether search-by-phone needs the same fix flagged in your earlier session (encrypted-field matching bug) before or alongside the UI work.
**Files touched:** all under `app/(app)/children/`, `components/forms/RegistrationForm.tsx`, `components/children/*.tsx`.

## Phase 5 — Screening flow
**Goal:** `children/[id]/screenings/new`, `visual-inspection/new`, `diagnostics/new` (+ `survey`), `screenings/[eventId]/edit`, `screenings/[eventId]/flag`. This is the clinical core — apply the "disable invalid submit rather than fail after" rule, and the "destructive/irreversible action needs confirm" rule specifically to the flag/edit screens (flagging or editing a completed screening result should never be a single accidental click).
**Files touched:** all screening-related pages under `children/[id]/` and `screenings/`.

## Phase 6 — Admin, Quality, Corrections, Exports, Operational Logs
**Goal:** Lower-traffic but still needs the same Button/token consistency pass. Group these together since each individual page is small. Decide here on the "one page vs. separate pages" questions you raised: e.g. does `quality/action-needed` need to be its own page or a tab/filter within `quality/page.tsx`? Does `operational-logs/new` need a separate page or a modal/drawer off `operational-logs/page.tsx`? Recommendation to evaluate: anything that's a single quick log entry (operational logs, corrections) is a good candidate for a modal instead of a full page navigation — reduces clicks for a busy clerk — but confirm this against how often each is used before merging.
**Files touched:** `admin/*`, `quality/*`, `corrections/page.tsx`, `exports/*`, `operational-logs/*`.

---

## Suggested cadence
Given free-tier token limits across your AI accounts, treat each phase (or sub-phase like 4a/4b/4c) as its own session with its own build log, the same pattern you already use (`phase-1A` through `phase-4`). Feed the AI: this UI-FIX-PHASE-PLAN.md phase block + EHDI-UI-PROTOCOLS.md + only the specific files being touched that session — not the whole repo.
