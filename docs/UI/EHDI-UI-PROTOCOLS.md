# Mama Rachel EHDI — UI Protocols & Design System Reference
Paste this file (or link its contents) at the start of any AI session — Claude, ChatGPT, Gemini, DeepSeek — before asking it to touch UI. It gives a fresh model with zero memory the same context you'd otherwise have to re-explain every time.

---

## 0. What this system is, in one paragraph

Mama Rachel EHDI is a **research-grade clinical data system**, not a consumer app. It records real infant hearing-screening outcomes across four roles (DATA_CLERK, SCREENER, SUPERVISOR, RESEARCHER, ADMIN) and feeds a JCIH 2019-aligned quality/export pipeline. Every UI decision should be judged against one question: **does this reduce the chance of a data-entry or clinical-workflow error?** Delight is secondary to correctness, clarity, and speed for a busy clinician.

---

## 1. Standards that actually govern medical software UI

These aren't optional style preferences — they're the accepted baseline for clinical/health software, and referencing them gives your CDU application and any future publication a defensible methodology.

- **NISTIR 7804 (NIST, EHR usability)** — the reference framework for EHR usability engineering. Its core principles: match the interface to real clinical workflow, minimize memory load, provide consistent feedback, prevent errors before they happen (don't just catch them after), and make system status always visible. Any screen where a clerk enters PHI or a screener records a result should be evaluated against these.
- **ONC SAFER Guides** (Safety Assurance Factors for EHR Resilience) — practical self-assessment checklists originally built for certified EHR technology. Relevant checklists for you: *Patient Identification*, *Clinical Communication*, *System Configuration*. Core idea: wrong-patient errors are the single most dangerous UI failure mode in health software — every screen that shows patient data must make identity unambiguous (name + DOB + ID visible together, never just one).
- **ISO 62366-1** (usability engineering for medical devices) — while EHDI isn't a regulated medical device, its usability-engineering process (identify use scenarios → identify use errors → mitigate in the interface) is the right mental model for your OAE/AABR pathway screens.
- **WCAG 2.1 Level AA** — the accessibility bar most health systems and Australian/US institutions require. Concretely: 4.5:1 text contrast minimum, all interactive elements reachable and operable by keyboard, visible focus states, form errors announced (not color-only), touch targets ≥44×44px (screeners often wear gloves or work one-handed holding a baby).
- **Nielsen Norman heuristics, clinical reading** — "recognition over recall" (show the patient/context, don't make the clerk remember an ID), "error prevention over error messages" (disable an invalid submit rather than letting it fail), "visibility of system status" (saving/syncing states must be visible — this system runs in a hospital with real network variability).
- **HIPAA-adjacent UX norms** (you're not literally HIPAA-bound in Kenya, but the same practices are good research-data hygiene and will matter for the international-publication and Data Protection Act 2019 angle): no PHI in URLs or query strings, auto-expiring sessions with a visible countdown/warning, audit-log visibility for supervisors, masked/generalized display of sensitive fields where full detail isn't needed.

**How to apply this in practice:** when you or a Claude session redesigns a screen, run this five-question check before shipping it —
1. Can this be misread as the wrong patient?
2. Can this be submitted in a way that silently loses data?
3. Is the current system state (saving, offline, pending) visible?
4. Does color alone carry any meaning (that's a WCAG failure)?
5. Could a tired clerk at hour 10 of a shift make this mistake — and if so, can the UI prevent it rather than just warn about it?

---

## 1.5. LOCKED CONSTANTS — use these verbatim, in every session, on every account

These are already defined in the codebase (`app/globals.css`, `tailwind.config.ts`). They are not suggestions — copy them exactly, character for character, regardless of which AI model or account builds a given page. If a new session (Claude, ChatGPT, Gemini, DeepSeek) doesn't have repo access, paste this block to it verbatim before it writes any CSS/JSX.

**Colors (hex, dark mode is the default/primary theme):**
| Token | Hex | Use |
|---|---|---|
| `--color-surface` | `#0B1120` | page background |
| `--color-surface-elevated` | `#111827` | sidebar / topbar |
| `--color-surface-card` | `#1A2332` | cards, dropdowns, modals |
| `--color-surface-hover` | `#1F2A3C` | hover states |
| `--color-surface-border` | `#2A3548` | borders/dividers |
| `--color-fg` | `#F1F5F9` | primary text (dark mode) |
| `--color-fg-muted` | `#8896AB` | secondary text |
| `--color-accent` | `#0EA5A0` | primary action color (teal) |
| `--color-accent-light` | `#14B8B3` | hover state of accent |
| `--color-warn` | `#F59E0B` | warnings, badges |
| `--color-warn-light` | `#FBBF24` | warning hover/accent |

**Light-mode equivalents** (used via Tailwind's plain, non-`dark:` classes — no separate token set exists yet, so use these consistently): `bg-gray-50` page background, `bg-white` cards, `text-gray-900` primary text, `text-gray-600`/`text-gray-500` secondary text, `teal-800` as the light-mode stand-in for accent on things like the sidebar. **Do not invent new light-mode colors** (e.g. no `blue-600`, ever — that's the exact bug in the current login/2FA pages).

**Fonts:** `Geist Sans` for `--font-display` and `--font-body`; `Geist Mono` for `--font-mono`. Already wired via `next/font/google` in `app/layout.tsx` — reuse the existing `geistSans`/`geistMono` variables, don't re-import fonts on individual pages.

**Dark mode mechanism:** class-based (`.dark` on `<html>`), controlled by `lib/theme.tsx`'s `ThemeProvider`/`useTheme()`. **Every new page must support both themes** using `dark:` variants — dark mode is not optional/cosmetic here, it's the primary theme the rest of the app already uses. A page that's light-only (like the current login/2FA) is a bug, not a valid alternate style.

**Spacing/radius/shadow conventions already established:** rounded corners are `rounded-lg` (buttons, inputs, cards) or `rounded-xl` (larger containers, dropdowns); minimum interactive height is `h-11` (44px, WCAG/SAFER touch-target minimum — screeners may be one-handed); shadows are subtle (`shadow-sm`/`shadow-lg`), never heavy drop-shadows.

**Icon set:** `lucide-react` — already a dependency, used throughout. Don't introduce a second icon library.

---

## 2. This project's actual design system (as found in the repo)

Confirmed from `app/globals.css` and `tailwind.config.ts` (Tailwind v4, token-based):

```
--color-surface:          #0B1120   (page background, dark mode)
--color-surface-elevated: #111827   (sidebar/topbar, dark mode)
--color-surface-card:     #1A2332   (cards, dropdowns)
--color-surface-hover:    #1F2A3C
--color-surface-border:   #2A3548
--color-fg:                #F1F5F9  (primary text, dark mode)
--color-fg-muted:          #8896AB  (secondary text)
--color-accent:            #0EA5A0  (teal — primary brand/action color)
--color-accent-light:      #14B8B3
--color-warn:               #F59E0B (amber — warnings, badges)
--color-warn-light:         #FBBF24
```

Fonts: Geist Sans (`--font-display`, `--font-body`), Geist Mono (`--font-mono`). Dark mode is class-based (`.dark`) via a working `ThemeProvider` in `lib/theme.tsx` — light mode uses `teal-800` and `gray-*` as the equivalent light-mode palette. There's also a "dark mode atmosphere" (gradient blobs + noise texture) applied only inside `AppLayout` — a nice touch, keep it, don't spread it to auth pages (it'd be visual noise on a login screen).

**Existing shared components** (`components/ui/`): `Input`, `Select`, `Checkbox`, `StatusBadge`, `Alert`. **Missing: `Button`.** This is the single highest-leverage fix available — see Section 4.

**Existing shared layout** (`components/layout/`): `AppLayout`, `Sidebar`, `TopBar`, `BreadCrumb` — these are well-built (role-aware nav, mobile drawer, alerts dropdown, theme toggle, logout flow with cookie + localStorage clear). **Do not rebuild these** — extend them, don't replace them.

---

## 3. Hard rules for any UI change on this project

1. **Never hardcode a color.** No `bg-blue-600`, `text-gray-700`, etc. Always use the tokens above (`bg-accent`, `text-fg-muted`, `dark:bg-surface-card`...). If a page doesn't support dark mode yet, that's a bug to fix, not a reason to add more hardcoded light-only styles.
2. **One `Button` component, used everywhere.** Variants needed at minimum: `primary` (accent-filled), `secondary` (outlined/ghost), `destructive` (for irreversible actions — flag, delete, override), `disabled`/`loading` state built in. No page should define its own `<button className="...">` from scratch again.
3. **Auth pages must use the same design system as the app shell.** Currently login/2FA/reset are light-mode-only, token-free, and visually disconnected from the rest of the product — that's the first thing to fix (Phase 1 below).
4. **Every screen showing a child/patient must show name + DOB/age + a stable ID together**, per the SAFER patient-identification principle — never just one identifier.
5. **Destructive or irreversible actions require a confirm step** (flag a screening, override a result, delete a record) — never a bare button that fires immediately.
6. **One primary action per screen.** If a page has two buttons that both look "primary" (this is your literal "duplicated buttons" symptom), demote one to `secondary`.
7. **Loading/saving/offline states must be visible**, not silent — spinners or disabled states on submit, not a frozen-looking button.
8. **Business logic lives in one place.** If the pathway engine (`lib/pathway/`) already decides OAE/AABR pass/fail/refer logic, no page component should re-implement or duplicate that decision — it should only call the engine and render the result.
9. **Forms use `react-hook-form` + `zod` consistently** (per the spec) — don't hand-roll `useState` form handling on new pages when older ones already establish the pattern (note: login/2FA currently use raw `useState`, which is fine for 2 fields but shouldn't be the template going forward for anything with validation needs).
10. **A value chosen on one screen must not be silently re-editable, unguarded, on the next screen.** If Screen A determines "ear = LEFT" and hands off to Screen B, Screen B should show that as a locked/confirmed fact (with an explicit, deliberate "change" action if editing is genuinely needed) — not repeat the exact same free-choice control as if nothing had been decided yet. This is the single biggest source of the "which button do I press, didn't I already choose this?" confusion in a multi-step clinical form. See the worked example below — this is a real, current issue in the screening flow, not a hypothetical.
11. **The system must work fully on phones, not just desktop.** Data clerks and screeners may use this on a phone at the bedside, not only at a desktop workstation. Every new or touched screen must be checked at a phone width (~375–414px) as well as desktop — not as an afterthought, as a pass/fail requirement. Concretely: no horizontal scrolling on forms, tables that don't fit must become stacked cards or scroll independently (never shrink text to fit), touch targets stay at the 44px minimum from Section 1.5 (this matters more on phone, not less), and any multi-column layout (e.g. the screening form's `grid-cols-2` detail grid) must collapse to a single column below the `sm`/`md` breakpoint. The app shell already has a working mobile pattern (`Sidebar`'s drawer, `TopBar`'s hamburger, `md:hidden`/`hidden md:flex` conventions) — reuse that same breakpoint convention (`md:` as the desktop cutoff) rather than inventing a new one per page.

### 3.5 Worked example: the ear-selector duplication you flagged

**What's actually happening right now:** `visual-inspection/new` has a Left / Right / Both segmented control (one clean single-choice control — this part is fine). When you save, it redirects to `screenings/new?ear=LEFT&stage=SCREEN_1`. But `screenings/new` reads that `ear` param into its own state **and then shows the exact same Left / Right / Both control again, fully editable**, as if nothing had been decided. That's not two separate problems — it's one: **the same decision is presented as a fresh, un-made choice twice**, which is exactly what confused you ("I selected left ear but inside left ear I can select both/right/left again").

**What the protocols above actually call for, concretely:**
- On `screenings/new`, when arriving with a known `ear` from the previous step, render that ear as a **locked, read-only indicator** ("Screening: **Left ear** · Visual inspection ✓ complete") with a small secondary "change ear" link — not the full three-button control. The full control should only appear when a user navigates to this page directly (no `ear` param), i.e. genuinely starting fresh.
- **On "Both" specifically — recommend removing it from the *screening result* step entirely**, keeping it only on the visual-inspection step. Reasoning: visual inspection can legitimately be identical for both ears in one look (same screener, same moment, same finding). A screening *result* (PASS/NOT_PASS/INCOMPLETE, probe fit quality, attempts, duration) is a distinct physical measurement per ear — OAE/AABR equipment tests one ear at a time, and per JCIH/EHDI reporting standards each ear's outcome must be an independently recorded data point (unilateral loss is common and must not be masked by a shared "both" entry). If "Both" stays as a convenience option, it should expand into **two clearly separate result blocks** (one per ear, each with its own PASS/NOT_PASS/duration/etc.) rather than one set of fields whose single answer gets copied onto two ears — a screener should never be able to accidentally record identical results for two ears with one click when the two measurements were actually taken separately.
- This is a Phase 5 (Screening flow) fix in the phase plan — flag it there rather than trying to patch it ad hoc.

### 3.6 What "already has phone support" means right now vs. what still needs checking
The app shell (`AppLayout`, `Sidebar`, `TopBar`) already has real mobile behavior — collapsible drawer, hamburger menu, responsive header. That part doesn't need rebuilding. What hasn't been verified yet is every *inner* page: forms with side-by-side fields, wide data tables (patient search results, dashboard tables, export lists), and multi-button rows (like the screening form's ear-selector or result-selector) all need an explicit phone-width check as part of whichever phase touches them. Don't treat "the sidebar works on phone" as proof the whole app does.

---

## 4. Known issues found in this audit (2026-07-21)

- `app/page.tsx` is still the untouched `create-next-app` boilerplate (Vercel/Next.js marketing copy, no branding, no login link).
- `app/(auth)/login/page.tsx` and `login/2fa/page.tsx` are functional but use a **completely different visual language** than the rest of the app: light-only, `blue-600`/`gray-*` hardcoded, no dark mode, no shared `Input`/`Button` components, plain "Test: admin@test.com" credential hint left in.
- **No `components/ui/Button.tsx` exists.** 12 pages currently define their own button markup independently: `login`, `login/2fa`, `screenings/[eventId]/edit`, `quality`, `referrals/[referralId]/edit`, `children/[id]/screenings/new`, `children/[id]/visual-inspection/new`, `children/[id]`, `children/search`, `corrections`, `operational-logs/new`, `operational-logs`. This is both the visual-inconsistency problem and the literal "duplicated button" problem you flagged.
- `children/search/page.tsx` is a stub (per earlier session notes) with no working UI yet.
- SMS/WhatsApp survey completion page is a stub.
- No printable report generation is wired to any screen yet.
- Dashboard, register, and screening flows haven't been UI-audited page-by-page yet — that's Phases 3–5 below.

---

## 5. How to combine this with your other Claude skills

You already have design-quality skills installed (`impeccable`, `emil-design-eng`, `design-taste-frontend`) and a writing-cleanup skill (`stop-slop`). Use them **together with this doc**, not instead of it:

- This doc = **what's true and constrained about this specific medical system** (standards, tokens, rules, known bugs).
- `impeccable` / `emil-design-eng` / `design-taste-frontend` = **general craft** for spacing, motion, hierarchy, polish once the above constraints are respected.
- `stop-slop` = clean up any user-facing copy (error messages, empty states, button labels) so it doesn't read like generic AI filler.

Suggested one-line opener for any new session, paste before your actual ask:
> "This is the Mama Rachel EHDI clinical system. Reference EHDI-UI-PROTOCOLS.md (attached/pasted) for the standards, design tokens, and known issues before making any UI change. Today's task: [Phase N from UI-FIX-PHASE-PLAN.md]."