// lib/pathway/types.ts
// Shared types for the pathway state machine (§17).
// No imports from database or framework.
//
// Naming convention: string literal unions (not TS enums) so the values
// can be reviewed line-by-line by a non-engineer clinical lead and
// match the protocol document exactly.

// ═══════════════════════════════════════════════════════════════
// PRIMITIVE VALUE TYPES
// ═══════════════════════════════════════════════════════════════

export type Modality = "OAE" | "AABR";
export type Ear = "LEFT" | "RIGHT";
export type ScreeningResult = "PASS" | "NOT_PASS" | "INCOMPLETE";
export type ScreeningStage = "SCREEN_1" | "SCREEN_2" | "RESCREEN_POST_REFERRAL";

// ═══════════════════════════════════════════════════════════════
// EAR STATE
// ═══════════════════════════════════════════════════════════════

export type EarStateValue =
  | "NOT_STARTED"
  | "SCREEN_1_PASSED"
  | "SCREEN_1_FAILED"
  | "SCREEN_2_PASSED"
  | "SCREEN_2_FAILED"
  | "CLEARED_FOR_RESCREEN"
  | "RESCREEN_PASSED"
  | "RESCREEN_FAILED"
  | "DIAGNOSED"
  | "PENDING_LTFU"
  | "LOST_TO_FOLLOWUP";

/** Composite ear state — what gets stored per ear in the DB */
export interface EarState {
  ear: Ear;
  state: EarStateValue;
  modality: Modality;
}

// ═══════════════════════════════════════════════════════════════
// PATIENT-LEVEL STATUS (derived from both ears — §17.5)
// ═══════════════════════════════════════════════════════════════

export type PatientPathwayStatus =
  | "PASSED"
  | "IN_PROGRESS"
  | "REFERRED_AUDIOLOGY"
  | "DIAGNOSED"
  | "LOST_TO_FOLLOWUP";

// ═══════════════════════════════════════════════════════════════
// PATHWAY EVENTS
// Each discriminated union member represents one thing that can
// trigger a state transition. The engine matches on `type`.
// ═══════════════════════════════════════════════════════════════

export type PathwayEvent =
  | {
      type: "SCREENING_SAVED";
      stage: ScreeningStage;
      result: ScreeningResult;
    }
  | {
      type: "REFERRAL_UPDATED";
      referralStatus: "CLEARED" | "TREATED" | "SEEN" | "NO_SHOW";
    }
  | {
      type: "DIAGNOSTIC_SAVED";
      hasHearingLoss: boolean;
    }
  | {
      type: "NOTIFICATIONS_EXHAUSTED";
    }
  | {
      type: "SUPERVISOR_MARKED_LTFU";
    }
  | {
      type: "CONTACT_REESTABLISHED";
      priorState?: EarStateValue;
    };

// ═══════════════════════════════════════════════════════════════
// SIDE EFFECTS
// Discriminated union — NOT executed inside the engine.
// Returned as data so the caller (API route) can execute them
// with database access. This keeps the engine pure and testable.
//
// Flat string unions lose information (e.g. which delay type,
// what the incomplete message said). The `kind` field carries
// the same label your original flat union used, so nothing
// breaks in downstream code that switches on the name.
// ═══════════════════════════════════════════════════════════════

export type SideEffect =
  | { kind: "RECOMPUTE_MILESTONES" }
  | { kind: "MARK_EAR_RESOLVED" }
  | { kind: "SCHEDULE_SCREEN2_NOTIFICATIONS" }
  | { kind: "SCHEDULE_HCP_REFERRAL_NOTIFICATIONS" }
  | { kind: "AUTO_CREATE_HCP_REFERRAL" }
  | { kind: "CANCEL_HCP_NOTIFICATION_SERIES" }
  | { kind: "SCHEDULE_RESCREEN_IMMEDIATELY" }
  | { kind: "SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY" }
  | { kind: "SCHEDULE_RESCREEN_AFTER_PE_DELAY" }
  | { kind: "LOG_NO_SHOW_EVENT" }
  | { kind: "RESUME_HCP_NOTIFICATION_SERIES" }
  | { kind: "AUTO_CREATE_AUDIOLOGY_REFERRAL" }
  | { kind: "SCHEDULE_AUDIOLOGY_NOTIFICATIONS" }
  | { kind: "SET_DIAGNOSIS" }
  | { kind: "SCHEDULE_INTERVENTION_NOTIFICATIONS" }
  | { kind: "ALERT_SUPERVISOR_LTFU" }
  | { kind: "SET_FINAL_STATUS_LTFU" }
  | { kind: "STOP_ALL_NOTIFICATIONS" }
  | { kind: "RESUME_PATHWAY" }
  | { kind: "CANCEL_LTFU_FLAG" }
  | { kind: "LOG_ATTEMPT"; message: string }
  | { kind: "ALERT_CLERK_RETRY" };

// ═══════════════════════════════════════════════════════════════
// TRANSITION RESULT
// ═══════════════════════════════════════════════════════════════

export interface StateTransitionResult {
  nextState: EarStateValue;
  sideEffects: readonly SideEffect[];
  warning?: string;
}

// ═══════════════════════════════════════════════════════════════
// MODALITY ASSIGNMENT
// ═══════════════════════════════════════════════════════════════

export interface ModalityAssignment {
  modality: Modality;
  reason: string;
}

// ═══════════════════════════════════════════════════════════════
// SEARCH TYPES (used by the search module — §47)
// ═══════════════════════════════════════════════════════════════

export interface SearchPatientResult {
  id: string;
  researchId: string | null;
  dateOfBirth: Date;
  sex: string;
  motherName: string | null;
  hospitalNumber: string | null;
  finalStatus: PatientPathwayStatus;
}
