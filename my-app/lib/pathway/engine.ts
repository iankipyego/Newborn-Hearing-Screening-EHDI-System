// lib/pathway/engine.ts
//
// Pathway Engine — Mama Rachel Hospital Newborn Hearing Screening
//
// PURE LOGIC: No database calls, no side effects, no imports
// from application code. Every function takes plain data in,
// returns plain data out. Reviewable line-by-line against the
// JCIH/ECHO protocol by a non-engineer.
//
// Per-ear state machine. Each ear is independent.
// Patient-level status is derived from both ears (§17.5).

import type {
  EarStateValue,
  Ear,
  Modality,
  ModalityAssignment,
  PatientPathwayStatus,
  PathwayEvent,
  ScreeningStage,
  SideEffect,
  StateTransitionResult,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// §17.1 — MODALITY ASSIGNMENT (runs once at intake)
// ═══════════════════════════════════════════════════════════════

export function assignModality(
  nicuDays: number | null | undefined
): ModalityAssignment {
  if (nicuDays !== null && nicuDays !== undefined && nicuDays > 5) {
    return {
      modality: "AABR",
      reason: `NICU admission > 5 days (${nicuDays} days) — JCIH auditory neuropathy risk`,
    };
  }
  return {
    modality: "OAE",
    reason: "Standard OAE screening — no NICU >5-day risk factor",
  };
}

/** Convenience: just the modality string, for DB fields */
export function getModality(
  nicuDays: number | null | undefined
): Modality {
  return assignModality(nicuDays).modality;
}

// ═══════════════════════════════════════════════════════════════
// STATE CLASSIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════

const RESOLVED_STATES: ReadonlySet<EarStateValue> = new Set([
  "SCREEN_1_PASSED",
  "SCREEN_2_PASSED",
  "RESCREEN_PASSED",
]);

const ACTIVE_STATES: ReadonlySet<EarStateValue> = new Set([
  "NOT_STARTED",
  "SCREEN_1_FAILED",
  "SCREEN_2_FAILED",
  "CLEARED_FOR_RESCREEN",
  "RESCREEN_FAILED",
  "PENDING_LTFU",
]);

const PASSED_STATES: ReadonlySet<EarStateValue> = new Set([
  "SCREEN_1_PASSED",
  "SCREEN_2_PASSED",
  "RESCREEN_PASSED",
]);

/** An ear is "resolved" if it passed at any stage */
export function isEarResolved(state: EarStateValue): boolean {
  return RESOLVED_STATES.has(state);
}

/** An ear can still receive pathway events */
export function isActiveState(state: EarStateValue): boolean {
  return ACTIVE_STATES.has(state);
}

// ═══════════════════════════════════════════════════════════════
// §17.4 — OUT-OF-ORDER ENTRY PROTECTION
// Returns null if allowed, or an error message string if blocked.
// ═══════════════════════════════════════════════════════════════

export function guardScreening(
  currentState: EarStateValue,
  stage: ScreeningStage
): string | null {
  switch (stage) {
    case "SCREEN_1":
      if (currentState !== "NOT_STARTED") {
        return `Screen 1 cannot be saved for an ear in state "${currentState}". Expected "NOT_STARTED".`;
      }
      return null;

    case "SCREEN_2":
      if (currentState !== "SCREEN_1_FAILED") {
        return `Screen 2 cannot be saved for an ear in state "${currentState}". Ear must be in "SCREEN_1_FAILED" (Screen 1 must exist with result NOT_PASS).`;
      }
      return null;

    case "RESCREEN_POST_REFERRAL":
      if (currentState !== "CLEARED_FOR_RESCREEN") {
        return `Rescreen cannot be saved for an ear in state "${currentState}". Ear must be in "CLEARED_FOR_RESCREEN" (HCP referral must be resolved first).`;
      }
      return null;
  }
}

export function guardDiagnostic(currentState: EarStateValue): string | null {
  if (currentState !== "RESCREEN_FAILED") {
    return `Diagnostic evaluation cannot be saved for an ear in state "${currentState}". Ear must be in "RESCREEN_FAILED".`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// EXPECTED STAGE HELPER
// Given an ear's current state, what screening stage comes next?
// Returns null if no screening stage is expected.
// ═══════════════════════════════════════════════════════════════

export function getExpectedStage(
  currentState: EarStateValue
): ScreeningStage | null {
  switch (currentState) {
    case "NOT_STARTED":
      return "SCREEN_1";
    case "SCREEN_1_FAILED":
      return "SCREEN_2";
    case "CLEARED_FOR_RESCREEN":
      return "RESCREEN_POST_REFERRAL";
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// §17.2 — CORE STATE TRANSITION
// Pure function: (currentState, event) → (nextState, sideEffects, warning?)
// ═══════════════════════════════════════════════════════════════

export function transitionEarState(
  currentState: EarStateValue,
  event: PathwayEvent
): StateTransitionResult {
  switch (event.type) {
    case "SCREENING_SAVED":
      return handleScreeningSaved(
        currentState,
        event.stage,
        event.result
      );

    case "REFERRAL_UPDATED":
      return handleReferralUpdated(currentState, event.referralStatus);

    case "DIAGNOSTIC_SAVED":
      return handleDiagnosticSaved(currentState, event.hasHearingLoss);

    case "NOTIFICATIONS_EXHAUSTED":
      return handleNotificationsExhausted(currentState);

    case "SUPERVISOR_MARKED_LTFU":
      return {
        nextState: "LOST_TO_FOLLOWUP",
        sideEffects: [
          { kind: "SET_FINAL_STATUS_LTFU" },
          { kind: "STOP_ALL_NOTIFICATIONS" },
        ],
      };

    case "CONTACT_REESTABLISHED":
      return {
        nextState: event.priorState ?? "NOT_STARTED",
        sideEffects: [
          { kind: "RESUME_PATHWAY" },
          { kind: "CANCEL_LTFU_FLAG" },
        ],
        warning: event.priorState
          ? undefined
          : "CONTACT_REESTABLISHED event had no priorState — defaulted to NOT_STARTED.",
      };

    default: {
      // Exhaustiveness guard — if a new event type is added to the
      // PathwayEvent union but not handled here, TypeScript errors.
      const _exhaustive: never = event;
      return { nextState: currentState, sideEffects: [] };
    }
  }
}

// ─── Internal handlers ───────────────────────────────────────

function handleScreeningSaved(
  currentState: EarStateValue,
  stage: ScreeningStage,
  result: "PASS" | "NOT_PASS" | "INCOMPLETE"
): StateTransitionResult {
  // INCOMPLETE: no state change, log and alert clerk
  if (result === "INCOMPLETE") {
    const label =
      stage === "SCREEN_1"
        ? "Screen 1"
        : stage === "SCREEN_2"
          ? "Screen 2"
          : "Rescreen";
    return {
      nextState: currentState,
      sideEffects: [
        { kind: "LOG_ATTEMPT", message: `${label} was incomplete.` },
        { kind: "ALERT_CLERK_RETRY" },
      ],
    };
  }

  switch (stage) {
    // ── Screen 1 ──
    case "SCREEN_1": {
      if (result === "PASS") {
        return {
          nextState: "SCREEN_1_PASSED",
          sideEffects: [
            { kind: "RECOMPUTE_MILESTONES" },
            { kind: "MARK_EAR_RESOLVED" },
          ],
        };
      }
      // NOT_PASS
      return {
        nextState: "SCREEN_1_FAILED",
        sideEffects: [{ kind: "SCHEDULE_SCREEN2_NOTIFICATIONS" }],
      };
    }

    // ── Screen 2 ──
    case "SCREEN_2": {
      if (result === "PASS") {
        return {
          nextState: "SCREEN_2_PASSED",
          sideEffects: [
            { kind: "RECOMPUTE_MILESTONES" },
            { kind: "MARK_EAR_RESOLVED" },
          ],
        };
      }
      // NOT_PASS
      return {
        nextState: "SCREEN_2_FAILED",
        sideEffects: [
          { kind: "AUTO_CREATE_HCP_REFERRAL" },
          { kind: "SCHEDULE_HCP_REFERRAL_NOTIFICATIONS" },
        ],
      };
    }

    // ── Rescreen post-referral ──
    case "RESCREEN_POST_REFERRAL": {
      if (result === "PASS") {
        return {
          nextState: "RESCREEN_PASSED",
          sideEffects: [
            { kind: "RECOMPUTE_MILESTONES" },
            { kind: "MARK_EAR_RESOLVED" },
          ],
        };
      }
      // NOT_PASS
      return {
        nextState: "RESCREEN_FAILED",
        sideEffects: [
          { kind: "AUTO_CREATE_AUDIOLOGY_REFERRAL" },
          { kind: "SCHEDULE_AUDIOLOGY_NOTIFICATIONS" },
        ],
      };
    }
  }
}

function handleReferralUpdated(
  currentState: EarStateValue,
  referralStatus: "CLEARED" | "TREATED" | "SEEN" | "NO_SHOW"
): StateTransitionResult {
  // Referral updates are only valid from SCREEN_2_FAILED
  if (currentState !== "SCREEN_2_FAILED") {
    return { nextState: currentState, sideEffects: [] };
  }

  switch (referralStatus) {
    case "CLEARED":
      return {
        nextState: "CLEARED_FOR_RESCREEN",
        sideEffects: [
          { kind: "SCHEDULE_RESCREEN_IMMEDIATELY" },
          { kind: "CANCEL_HCP_NOTIFICATION_SERIES" },
        ],
      };

    case "TREATED":
      return {
        nextState: "CLEARED_FOR_RESCREEN",
        sideEffects: [
          { kind: "SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY" },
          { kind: "CANCEL_HCP_NOTIFICATION_SERIES" },
        ],
      };

    case "SEEN":
      // Patient was seen but no specific clinical outcome recorded yet.
      // No state transition — stay in SCREEN_2_FAILED awaiting a
      // definitive outcome (CLEARED / TREATED / NO_SHOW).
      return {
        nextState: "SCREEN_2_FAILED",
        sideEffects: [],
        warning:
          "Referral marked SEEN but no clinical outcome (CLEARED/TREATED/NO_SHOW) recorded. Ear remains in SCREEN_2_FAILED.",
      };

    case "NO_SHOW":
      // State does NOT change — case stays in SCREEN_2_FAILED
      // (do NOT silently drop the case — §5)
      return {
        nextState: "SCREEN_2_FAILED",
        sideEffects: [
          { kind: "LOG_NO_SHOW_EVENT" },
          { kind: "RESUME_HCP_NOTIFICATION_SERIES" },
        ],
      };
  }
}

function handleDiagnosticSaved(
  currentState: EarStateValue,
  hasHearingLoss: boolean
): StateTransitionResult {
  if (currentState !== "RESCREEN_FAILED") {
    return { nextState: currentState, sideEffects: [] };
  }

  const effects: SideEffect[] = [
    { kind: "SET_DIAGNOSIS" },
    { kind: "RECOMPUTE_MILESTONES" },
  ];

  // Only schedule intervention notifications if hearing loss confirmed
  if (hasHearingLoss) {
    effects.push({ kind: "SCHEDULE_INTERVENTION_NOTIFICATIONS" });
  }

  return {
    nextState: "DIAGNOSED",
    sideEffects: effects,
  };
}

function handleNotificationsExhausted(
  currentState: EarStateValue
): StateTransitionResult {
  if (!isActiveState(currentState) || currentState === "PENDING_LTFU") {
    return { nextState: currentState, sideEffects: [] };
  }
  return {
    nextState: "PENDING_LTFU",
    sideEffects: [{ kind: "ALERT_SUPERVISOR_LTFU" }],
  };
}

// ═══════════════════════════════════════════════════════════════
// §17.5 — BILATERAL STATE → PATIENT-LEVEL STATUS
// ═══════════════════════════════════════════════════════════════

export function derivePatientStatus(
  leftEar: EarStateValue,
  rightEar: EarStateValue
): PatientPathwayStatus {
  const leftPassed = PASSED_STATES.has(leftEar);
  const rightPassed = PASSED_STATES.has(rightEar);

  // Both ears passed at some stage
  if (leftPassed && rightPassed) return "PASSED";

  // Either ear lost — most urgent status takes priority
  if (
    leftEar === "LOST_TO_FOLLOWUP" ||
    rightEar === "LOST_TO_FOLLOWUP"
  ) {
    return "LOST_TO_FOLLOWUP";
  }

  // Either ear has a diagnosis
  if (leftEar === "DIAGNOSED" || rightEar === "DIAGNOSED") {
    return "DIAGNOSED";
  }

  // Either ear failed rescreen (referred to audiology)
  if (
    leftEar === "RESCREEN_FAILED" ||
    rightEar === "RESCREEN_FAILED"
  ) {
    return "REFERRED_AUDIOLOGY";
  }

  // Everything else is still in progress
  return "IN_PROGRESS";
}

// ═══════════════════════════════════════════════════════════════
// EPISODE COMPLETION RULE (§5)
// Pathway is "complete" only when EVERY ear is either resolved
// (passed at some stage) or has a diagnostic evaluation on file.
// Enforced in code — not left to dashboard reporting — because
// it is the basis of the loss-to-follow-up calculation.
// ═══════════════════════════════════════════════════════════════

export function isPathwayComplete(
  leftEar: EarStateValue,
  rightEar: EarStateValue,
  hasLeftDiagnosis: boolean,
  hasRightDiagnosis: boolean
): boolean {
  const leftDone =
    isEarResolved(leftEar) ||
    (leftEar === "DIAGNOSED" && hasLeftDiagnosis);
  const rightDone =
    isEarResolved(rightEar) ||
    (rightEar === "DIAGNOSED" && hasRightDiagnosis);
  return leftDone && rightDone;
}

// ═══════════════════════════════════════════════════════════════
// DISPLAY LABELS
// Kept here so labels and states can never drift apart.
// Not part of the state machine logic itself.
// ═══════════════════════════════════════════════════════════════

const EAR_STATE_LABELS: Record<EarStateValue, string> = {
  NOT_STARTED: "Not Started",
  SCREEN_1_PASSED: "Screen 1 — Passed",
  SCREEN_1_FAILED: "Screen 1 — Not Passed",
  SCREEN_2_PASSED: "Screen 2 — Passed",
  SCREEN_2_FAILED: "Screen 2 — Not Passed",
  CLEARED_FOR_RESCREEN: "Cleared for Rescreen",
  RESCREEN_PASSED: "Rescreen — Passed",
  RESCREEN_FAILED: "Referred to Audiology",
  DIAGNOSED: "Diagnosed",
  PENDING_LTFU: "Pending LTFU Review",
  LOST_TO_FOLLOWUP: "Lost to Follow-up",
};

const PATIENT_STATUS_LABELS: Record<PatientPathwayStatus, string> = {
  PASSED: "Passed",
  IN_PROGRESS: "In Progress",
  REFERRED_AUDIOLOGY: "Referred to Audiology",
  DIAGNOSED: "Diagnosed",
  LOST_TO_FOLLOWUP: "Lost to Follow-up",
};

export function getEarStateLabel(state: EarStateValue): string {
  return EAR_STATE_LABELS[state];
}

export function getPatientStatusLabel(
  status: PatientPathwayStatus
): string {
  return PATIENT_STATUS_LABELS[status];
}