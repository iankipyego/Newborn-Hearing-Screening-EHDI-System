// lib/pathway/types.ts
// Shared types for the pathway state machine (§17).
// No imports from database or framework.

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

export type PatientPathwayStatus =
  | "PASSED"
  | "IN_PROGRESS"
  | "REFERRED_AUDIOLOGY"
  | "DIAGNOSED"
  | "LOST_TO_FOLLOWUP";

export type SideEffect =
  | "RECOMPUTE_MILESTONES"
  | "MARK_EAR_RESOLVED"
  | "SCHEDULE_SCREEN2_NOTIFICATIONS"
  | "SCHEDULE_HCP_REFERRAL_NOTIFICATIONS"
  | "AUTO_CREATE_HCP_REFERRAL"
  | "CANCEL_HCP_NOTIFICATION_SERIES"
  | "SCHEDULE_RESCREEN_IMMEDIATELY"
  | "SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY"
  | "SCHEDULE_RESCREEN_AFTER_PE_DELAY"
  | "LOG_NO_SHOW_EVENT"
  | "RESUME_HCP_NOTIFICATION_SERIES"
  | "AUTO_CREATE_AUDIOLOGY_REFERRAL"
  | "SCHEDULE_AUDIOLOGY_NOTIFICATIONS"
  | "SET_DIAGNOSIS"
  | "SCHEDULE_INTERVENTION_NOTIFICATIONS"
  | "SET_FINAL_STATUS_LTFU"
  | "STOP_ALL_NOTIFICATIONS"
  | "RESUME_PATHWAY"
  | "CANCEL_LTFU_FLAG"
  | "LOG_ATTEMPT"
  | "ALERT_CLERK_RETRY";

export type PathwayEvent =
  | {
      type: "SCREENING_SAVED";
      stage: "SCREEN_1" | "SCREEN_2" | "RESCREEN_POST_REFERRAL";
      result: "PASS" | "NOT_PASS" | "INCOMPLETE";
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
      type: "SUPERVISOR_MARKED_LTFU";
    }
  | {
      type: "NOTIFICATIONS_EXHAUSTED";
    }
  | {
      type: "CONTACT_REESTABLISHED";
      priorState?: EarStateValue;
    };

export interface StateTransitionResult {
  nextState: EarStateValue;
  sideEffects: readonly SideEffect[];
  warning?: string;
}

export interface ModalityAssignment {
  modality: "OAE" | "AABR";
  reason: string;
}

export interface EarState {
  ear: "LEFT" | "RIGHT";
  state: EarStateValue;
  modality: "OAE" | "AABR";
}