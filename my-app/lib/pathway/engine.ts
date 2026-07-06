// lib/pathway/engine.ts
// Pure state machine implementing §17 (pathway state machine).
// ZERO imports from database, Next.js, or any network layer.
// Takes typed inputs, returns typed outputs — unit testable in isolation.
// Reviewable line-by-line by a non-engineer against the protocol.

import type {
  EarState,
  PathwayEvent,
  StateTransitionResult,
  ModalityAssignment,
  PatientPathwayStatus,
  EarStateValue,
} from "./types";

// ---------------------------------------------------------------------------
// §17.1 — Modality assignment (runs once at intake)
// ---------------------------------------------------------------------------

export function assignModality(nicuDays: number | null | undefined): ModalityAssignment {
  const days = nicuDays ?? 0;
  if (days > 5) {
    return { modality: "AABR", reason: "NICU admission > 5 days (§2, §17.1)" };
  }
  return { modality: "OAE", reason: "Standard protocol" };
}

// ---------------------------------------------------------------------------
// §17.2 — State transition table
// One function per (currentState, event) pair — each is independently testable.
// ---------------------------------------------------------------------------

export function transitionState(
  currentState: EarStateValue,
  event: PathwayEvent
): StateTransitionResult {
  switch (currentState) {
    case "NOT_STARTED": {
      if (event.type === "SCREENING_SAVED" && event.stage === "SCREEN_1") {
        if (event.result === "PASS") {
          return {
            nextState: "SCREEN_1_PASSED",
            sideEffects: ["RECOMPUTE_MILESTONES", "MARK_EAR_RESOLVED"],
          };
        }
        if (event.result === "NOT_PASS") {
          return {
            nextState: "SCREEN_1_FAILED",
            sideEffects: ["SCHEDULE_SCREEN2_NOTIFICATIONS"],
          };
        }
        if (event.result === "INCOMPLETE") {
          return {
            nextState: "NOT_STARTED",
            sideEffects: ["LOG_ATTEMPT", "ALERT_CLERK_RETRY"],
          };
        }
      }
      break;
    }

    case "SCREEN_1_FAILED": {
      if (event.type === "SCREENING_SAVED" && event.stage === "SCREEN_2") {
        if (event.result === "PASS") {
          return {
            nextState: "SCREEN_2_PASSED",
            sideEffects: ["RECOMPUTE_MILESTONES", "MARK_EAR_RESOLVED"],
          };
        }
        if (event.result === "NOT_PASS") {
          return {
            nextState: "SCREEN_2_FAILED",
            sideEffects: ["AUTO_CREATE_HCP_REFERRAL", "SCHEDULE_HCP_REFERRAL_NOTIFICATIONS"],
          };
        }
        if (event.result === "INCOMPLETE") {
          return {
            nextState: "SCREEN_1_FAILED",
            sideEffects: ["LOG_ATTEMPT"],
          };
        }
      }
      break;
    }

    case "SCREEN_2_FAILED": {
      if (event.type === "REFERRAL_UPDATED") {
        if (event.referralStatus === "CLEARED") {
          return {
            nextState: "CLEARED_FOR_RESCREEN",
            sideEffects: ["SCHEDULE_RESCREEN_IMMEDIATELY", "CANCEL_HCP_NOTIFICATION_SERIES"],
          };
        }
        if (event.referralStatus === "TREATED") {
          return {
            nextState: "CLEARED_FOR_RESCREEN",
            sideEffects: ["SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY", "CANCEL_HCP_NOTIFICATION_SERIES"],
          };
        }
        if (event.referralStatus === "SEEN") {
          return {
            nextState: "CLEARED_FOR_RESCREEN",
            sideEffects: ["SCHEDULE_RESCREEN_AFTER_PE_DELAY", "CANCEL_HCP_NOTIFICATION_SERIES"],
          };
        }
        if (event.referralStatus === "NO_SHOW") {
          return {
            nextState: "SCREEN_2_FAILED",
            sideEffects: ["LOG_NO_SHOW_EVENT", "RESUME_HCP_NOTIFICATION_SERIES"],
          };
        }
      }
      break;
    }

    case "CLEARED_FOR_RESCREEN": {
      if (event.type === "SCREENING_SAVED" && event.stage === "RESCREEN_POST_REFERRAL") {
        if (event.result === "PASS") {
          return {
            nextState: "RESCREEN_PASSED",
            sideEffects: ["RECOMPUTE_MILESTONES", "MARK_EAR_RESOLVED"],
          };
        }
        if (event.result === "NOT_PASS") {
          return {
            nextState: "RESCREEN_FAILED",
            sideEffects: ["AUTO_CREATE_AUDIOLOGY_REFERRAL", "SCHEDULE_AUDIOLOGY_NOTIFICATIONS"],
          };
        }
        if (event.result === "INCOMPLETE") {
          return {
            nextState: "CLEARED_FOR_RESCREEN",
            sideEffects: ["LOG_ATTEMPT"],
          };
        }
      }
      break;
    }

    case "RESCREEN_FAILED": {
      if (event.type === "DIAGNOSTIC_SAVED") {
        return {
          nextState: "DIAGNOSED",
          sideEffects: [
            "SET_DIAGNOSIS",
            "RECOMPUTE_MILESTONES",
            ...(event.hasHearingLoss
              ? (["SCHEDULE_INTERVENTION_NOTIFICATIONS"] as const)
              : []),
          ],
        };
      }
      break;
    }

    case "PENDING_LTFU": {
      if (event.type === "SUPERVISOR_MARKED_LTFU") {
        return {
          nextState: "LOST_TO_FOLLOWUP",
          sideEffects: ["SET_FINAL_STATUS_LTFU", "STOP_ALL_NOTIFICATIONS"],
        };
      }
      if (event.type === "CONTACT_REESTABLISHED") {
        return {
          nextState: event.priorState ?? "NOT_STARTED",
          sideEffects: ["RESUME_PATHWAY", "CANCEL_LTFU_FLAG"],
        };
      }
      break;
    }

    // Terminal states — no further transitions
    case "SCREEN_1_PASSED":
    case "SCREEN_2_PASSED":
    case "RESCREEN_PASSED":
    case "DIAGNOSED":
    case "LOST_TO_FOLLOWUP":
      return {
        nextState: currentState,
        sideEffects: [],
        warning: `State ${currentState} is terminal — no transition applied`,
      };
  }

  // Unhandled combination — return current state with a warning
  return {
    nextState: currentState,
    sideEffects: [],
    warning: `No transition defined for state=${currentState} event=${event.type}`,
  };
}

// ---------------------------------------------------------------------------
// §17.4 — Out-of-order entry protection
// ---------------------------------------------------------------------------

export type OrderViolation =
  | "SCREEN_2_WITHOUT_SCREEN_1"
  | "RESCREEN_WITHOUT_HCP_REFERRAL_RESOLVED"
  | "DIAGNOSTIC_WITHOUT_AUDIOLOGY_REFERRAL";

export function checkOrderViolation(
  currentState: EarStateValue,
  incomingStage: "SCREEN_1" | "SCREEN_2" | "RESCREEN_POST_REFERRAL" | "DIAGNOSTIC"
): OrderViolation | null {
  if (incomingStage === "SCREEN_2" && currentState === "NOT_STARTED") {
    return "SCREEN_2_WITHOUT_SCREEN_1";
  }
  if (
    incomingStage === "RESCREEN_POST_REFERRAL" &&
    currentState !== "CLEARED_FOR_RESCREEN"
  ) {
    return "RESCREEN_WITHOUT_HCP_REFERRAL_RESOLVED";
  }
  if (incomingStage === "DIAGNOSTIC" && currentState !== "RESCREEN_FAILED") {
    return "DIAGNOSTIC_WITHOUT_AUDIOLOGY_REFERRAL";
  }
  return null;
}

// ---------------------------------------------------------------------------
// §17.5 — Bilateral state → patient-level status
// ---------------------------------------------------------------------------

export function derivePatientStatus(
  leftEarState: EarStateValue,
  rightEarState: EarStateValue
): PatientPathwayStatus {
  const resolved: EarStateValue[] = ["SCREEN_1_PASSED", "SCREEN_2_PASSED", "RESCREEN_PASSED"];

  if (resolved.includes(leftEarState) && resolved.includes(rightEarState)) {
    return "PASSED";
  }
  if (leftEarState === "LOST_TO_FOLLOWUP" || rightEarState === "LOST_TO_FOLLOWUP") {
    return "LOST_TO_FOLLOWUP";
  }
  if (leftEarState === "DIAGNOSED" || rightEarState === "DIAGNOSED") {
    return "DIAGNOSED";
  }
  if (leftEarState === "RESCREEN_FAILED" || rightEarState === "RESCREEN_FAILED") {
    return "REFERRED_AUDIOLOGY";
  }
  return "IN_PROGRESS";
}

// ---------------------------------------------------------------------------
// §17.3 — Delay window constants (⚠ values marked TBD need clinician sign-off)
// ---------------------------------------------------------------------------

export const DELAY_WINDOWS = {
  /** Screen 1 → Screen 2 scheduling window — CONFIRMED by client (§17.3) */
  SCREEN1_TO_SCREEN2_DAYS: 14,

  /** HCP clearance → rescreen — ⚠ NEEDS AUDIOLOGIST SIGN-OFF */
  HCP_CLEARANCE_TO_RESCREEN_DAYS: 7,

  /** Otitis media treatment → rescreen — ⚠ NEEDS AUDIOLOGIST SIGN-OFF */
  OTITIS_MEDIA_TO_RESCREEN_DAYS: 42, // placeholder: ~6 weeks

  /** PE tube placement → rescreen — ⚠ NEEDS AUDIOLOGIST SIGN-OFF */
  PE_TUBE_TO_RESCREEN_DAYS: 28, // placeholder: ~4 weeks

  /** Audiology referral → evaluation (JCIH 1-3-6 — CONFIRMED) */
  AUDIOLOGY_REFERRAL_TO_EVAL_DAYS: 90,

  /** Diagnosis → intervention start (JCIH 1-3-6 — CONFIRMED) */
  DIAGNOSIS_TO_INTERVENTION_DAYS: 180,

  /** No-contact cutoff before PENDING_LTFU — ⚠ NEEDS CLINICAL LEAD + IREC SIGN-OFF */
  NO_CONTACT_LTFU_DAYS: 60, // placeholder
} as const;