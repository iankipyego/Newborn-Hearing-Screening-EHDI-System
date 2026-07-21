// lib/pathway/engine.test.ts
// One test per row in §17.2 state transition table.
// Run with: npm test  (vitest)

import { describe, it, expect } from "vitest";
import {
  transitionEarState,
  assignModality,
  derivePatientStatus,
  guardScreening,
  guardVisualInspection,
} from "./engine";
import type { SideEffect } from "./types";

/** Helper: does the side-effect list contain a given kind? */
function hasEffect(effects: readonly SideEffect[], kind: SideEffect["kind"]): boolean {
  return effects.some((e) => e.kind === kind);
}

// ---------------------------------------------------------------------------
// §17.1 — Modality assignment
// ---------------------------------------------------------------------------
describe("assignModality", () => {
  it("returns AABR when nicu_days > 5", () => {
    expect(assignModality(6).modality).toBe("AABR");
    expect(assignModality(30).modality).toBe("AABR");
  });

  it("returns OAE when nicu_days = 5", () => {
    expect(assignModality(5).modality).toBe("OAE");
  });

  it("returns OAE when nicu_days = 0", () => {
    expect(assignModality(0).modality).toBe("OAE");
  });

  it("returns OAE when nicu_days is null", () => {
    expect(assignModality(null).modality).toBe("OAE");
  });
});

// ---------------------------------------------------------------------------
// §17.2 row 1-3 — NOT_STARTED transitions
// ---------------------------------------------------------------------------
describe("NOT_STARTED transitions", () => {
  it("row 1: Screen 1 PASS -> SCREEN_1_PASSED with milestone recompute", () => {
    const result = transitionEarState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "PASS",
    });
    expect(result.nextState).toBe("SCREEN_1_PASSED");
    expect(hasEffect(result.sideEffects, "RECOMPUTE_MILESTONES")).toBe(true);
    expect(hasEffect(result.sideEffects, "MARK_EAR_RESOLVED")).toBe(true);
  });

  it("row 2: Screen 1 NOT_PASS -> SCREEN_1_FAILED with notifications", () => {
    const result = transitionEarState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("SCREEN_1_FAILED");
    expect(hasEffect(result.sideEffects, "SCHEDULE_SCREEN2_NOTIFICATIONS")).toBe(true);
  });

  it("row 3: Screen 1 INCOMPLETE -> NOT_STARTED (no state change)", () => {
    const result = transitionEarState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "INCOMPLETE",
    });
    expect(result.nextState).toBe("NOT_STARTED");
    expect(hasEffect(result.sideEffects, "LOG_ATTEMPT")).toBe(true);
    expect(hasEffect(result.sideEffects, "ALERT_CLERK_RETRY")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 4-6 — SCREEN_1_FAILED transitions
// ---------------------------------------------------------------------------
describe("SCREEN_1_FAILED transitions", () => {
  it("row 4: Screen 2 PASS -> SCREEN_2_PASSED", () => {
    const result = transitionEarState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "PASS",
    });
    expect(result.nextState).toBe("SCREEN_2_PASSED");
    expect(hasEffect(result.sideEffects, "RECOMPUTE_MILESTONES")).toBe(true);
    expect(hasEffect(result.sideEffects, "MARK_EAR_RESOLVED")).toBe(true);
  });

  it("row 5: Screen 2 NOT_PASS -> SCREEN_2_FAILED with HCP referral", () => {
    const result = transitionEarState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(hasEffect(result.sideEffects, "AUTO_CREATE_HCP_REFERRAL")).toBe(true);
    expect(hasEffect(result.sideEffects, "SCHEDULE_HCP_REFERRAL_NOTIFICATIONS")).toBe(true);
  });

  it("row 6: Screen 2 INCOMPLETE -> SCREEN_1_FAILED (no state change)", () => {
    const result = transitionEarState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "INCOMPLETE",
    });
    expect(result.nextState).toBe("SCREEN_1_FAILED");
    expect(hasEffect(result.sideEffects, "LOG_ATTEMPT")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 7-10 — SCREEN_2_FAILED (referral resolution) transitions
// ---------------------------------------------------------------------------
describe("SCREEN_2_FAILED transitions (referral resolution)", () => {
  it("row 7: Referral CLEARED -> CLEARED_FOR_RESCREEN, immediate rescreen", () => {
    const result = transitionEarState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "CLEARED",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(hasEffect(result.sideEffects, "SCHEDULE_RESCREEN_IMMEDIATELY")).toBe(true);
    expect(hasEffect(result.sideEffects, "CANCEL_HCP_NOTIFICATION_SERIES")).toBe(true);
  });

  it("row 8: Referral TREATED -> CLEARED_FOR_RESCREEN with treatment delay", () => {
    const result = transitionEarState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "TREATED",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(hasEffect(result.sideEffects, "SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY")).toBe(true);
    expect(hasEffect(result.sideEffects, "CANCEL_HCP_NOTIFICATION_SERIES")).toBe(true);
  });

  it("row 9: Referral SEEN (PE tube placed) -> CLEARED_FOR_RESCREEN with PE delay", () => {
    const result = transitionEarState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "SEEN",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(hasEffect(result.sideEffects, "SCHEDULE_RESCREEN_AFTER_PE_DELAY")).toBe(true);
    expect(hasEffect(result.sideEffects, "CANCEL_HCP_NOTIFICATION_SERIES")).toBe(true);
  });

  it("row 10: Referral NO_SHOW -> SCREEN_2_FAILED (no state change, log no-show, do not drop case)", () => {
    const result = transitionEarState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "NO_SHOW",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(hasEffect(result.sideEffects, "LOG_NO_SHOW_EVENT")).toBe(true);
    expect(hasEffect(result.sideEffects, "RESUME_HCP_NOTIFICATION_SERIES")).toBe(true);
  });

  it("referral updates are ignored when the ear is not in SCREEN_2_FAILED", () => {
    const result = transitionEarState("NOT_STARTED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "CLEARED",
    });
    expect(result.nextState).toBe("NOT_STARTED");
    expect(result.sideEffects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 11-12 — CLEARED_FOR_RESCREEN transitions
// ---------------------------------------------------------------------------
describe("CLEARED_FOR_RESCREEN transitions", () => {
  it("row 11: Rescreen PASS -> RESCREEN_PASSED", () => {
    const result = transitionEarState("CLEARED_FOR_RESCREEN", {
      type: "SCREENING_SAVED",
      stage: "RESCREEN_POST_REFERRAL",
      result: "PASS",
    });
    expect(result.nextState).toBe("RESCREEN_PASSED");
    expect(hasEffect(result.sideEffects, "RECOMPUTE_MILESTONES")).toBe(true);
    expect(hasEffect(result.sideEffects, "MARK_EAR_RESOLVED")).toBe(true);
  });

  it("row 12: Rescreen NOT_PASS -> RESCREEN_FAILED with audiology referral", () => {
    const result = transitionEarState("CLEARED_FOR_RESCREEN", {
      type: "SCREENING_SAVED",
      stage: "RESCREEN_POST_REFERRAL",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("RESCREEN_FAILED");
    expect(hasEffect(result.sideEffects, "AUTO_CREATE_AUDIOLOGY_REFERRAL")).toBe(true);
    expect(hasEffect(result.sideEffects, "SCHEDULE_AUDIOLOGY_NOTIFICATIONS")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §17.2 row 13 — RESCREEN_FAILED -> DIAGNOSED
// ---------------------------------------------------------------------------
describe("RESCREEN_FAILED transitions", () => {
  it("row 13: Diagnostic saved with hearing loss -> DIAGNOSED with intervention notifications", () => {
    const result = transitionEarState("RESCREEN_FAILED", {
      type: "DIAGNOSTIC_SAVED",
      hasHearingLoss: true,
    });
    expect(result.nextState).toBe("DIAGNOSED");
    expect(hasEffect(result.sideEffects, "SET_DIAGNOSIS")).toBe(true);
    expect(hasEffect(result.sideEffects, "SCHEDULE_INTERVENTION_NOTIFICATIONS")).toBe(true);
  });

  it("row 13b: Diagnostic saved without hearing loss -> DIAGNOSED without intervention notifications", () => {
    const result = transitionEarState("RESCREEN_FAILED", {
      type: "DIAGNOSTIC_SAVED",
      hasHearingLoss: false,
    });
    expect(result.nextState).toBe("DIAGNOSED");
    expect(hasEffect(result.sideEffects, "SCHEDULE_INTERVENTION_NOTIFICATIONS")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 14-16 — LTFU transitions
// ---------------------------------------------------------------------------
describe("LTFU transitions", () => {
  it("row 14: Notifications exhausted on an active state -> PENDING_LTFU", () => {
    const result = transitionEarState("SCREEN_1_FAILED", {
      type: "NOTIFICATIONS_EXHAUSTED",
    });
    expect(result.nextState).toBe("PENDING_LTFU");
    expect(hasEffect(result.sideEffects, "ALERT_SUPERVISOR_LTFU")).toBe(true);
  });

  it("row 15: Supervisor marks LTFU -> LOST_TO_FOLLOWUP", () => {
    const result = transitionEarState("PENDING_LTFU", {
      type: "SUPERVISOR_MARKED_LTFU",
    });
    expect(result.nextState).toBe("LOST_TO_FOLLOWUP");
    expect(hasEffect(result.sideEffects, "SET_FINAL_STATUS_LTFU")).toBe(true);
    expect(hasEffect(result.sideEffects, "STOP_ALL_NOTIFICATIONS")).toBe(true);
  });

  it("row 16: Contact re-established -> resumes prior active state", () => {
    const result = transitionEarState("PENDING_LTFU", {
      type: "CONTACT_REESTABLISHED",
      priorState: "SCREEN_2_FAILED",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(hasEffect(result.sideEffects, "RESUME_PATHWAY")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §17.4 — Out-of-order entry protection (guardScreening)
// ---------------------------------------------------------------------------
describe("guardScreening — out-of-order entry protection", () => {
  it("blocks Screen 2 when state is NOT_STARTED", () => {
    expect(guardScreening("NOT_STARTED", "SCREEN_2")).toMatch(/SCREEN_1_FAILED/);
  });

  it("allows Screen 2 when state is SCREEN_1_FAILED", () => {
    expect(guardScreening("SCREEN_1_FAILED", "SCREEN_2")).toBeNull();
  });

  it("blocks Rescreen when the HCP referral has not been resolved", () => {
    expect(guardScreening("SCREEN_2_FAILED", "RESCREEN_POST_REFERRAL")).toMatch(
      /CLEARED_FOR_RESCREEN/
    );
  });

  it("allows Rescreen when state is CLEARED_FOR_RESCREEN", () => {
    expect(guardScreening("CLEARED_FOR_RESCREEN", "RESCREEN_POST_REFERRAL")).toBeNull();
  });

  it("blocks Screen 1 when the ear already has a Screen 1 result", () => {
    expect(guardScreening("SCREEN_1_PASSED", "SCREEN_1")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §17.5 — Bilateral state -> patient-level status
// ---------------------------------------------------------------------------
describe("derivePatientStatus", () => {
  it("PASSED when both ears resolved", () => {
    expect(derivePatientStatus("SCREEN_1_PASSED", "SCREEN_2_PASSED")).toBe("PASSED");
    expect(derivePatientStatus("RESCREEN_PASSED", "SCREEN_1_PASSED")).toBe("PASSED");
  });

  it("LOST_TO_FOLLOWUP if either ear is LTFU", () => {
    expect(derivePatientStatus("LOST_TO_FOLLOWUP", "SCREEN_1_PASSED")).toBe("LOST_TO_FOLLOWUP");
  });

  it("DIAGNOSED if either ear is DIAGNOSED", () => {
    expect(derivePatientStatus("DIAGNOSED", "SCREEN_1_PASSED")).toBe("DIAGNOSED");
  });

  it("REFERRED_AUDIOLOGY if either ear is RESCREEN_FAILED", () => {
    expect(derivePatientStatus("RESCREEN_FAILED", "SCREEN_1_PASSED")).toBe("REFERRED_AUDIOLOGY");
  });

  it("IN_PROGRESS otherwise", () => {
    expect(derivePatientStatus("NOT_STARTED", "NOT_STARTED")).toBe("IN_PROGRESS");
    expect(derivePatientStatus("SCREEN_1_FAILED", "NOT_STARTED")).toBe("IN_PROGRESS");
  });
});

// ---------------------------------------------------------------------------
// §2.1 — Visual inspection and case history (pre-OAE)
// ---------------------------------------------------------------------------
describe("guardVisualInspection", () => {
  it("allows visual inspection from NOT_STARTED", () => {
    expect(guardVisualInspection("NOT_STARTED")).toBeNull();
  });

  it("blocks a second visual inspection once referred for clearance", () => {
    expect(guardVisualInspection("PENDING_MEDICAL_CLEARANCE_PRESCREEN")).not.toBeNull();
  });

  it("blocks visual inspection once Screen 1 has already been recorded", () => {
    expect(guardVisualInspection("SCREEN_1_PASSED")).not.toBeNull();
    expect(guardVisualInspection("SCREEN_1_FAILED")).not.toBeNull();
  });
});

describe("transitionEarState — VISUAL_INSPECTION_SAVED", () => {
  it("PASS keeps the ear at NOT_STARTED, ready for Screen 1", () => {
    const t = transitionEarState("NOT_STARTED", {
      type: "VISUAL_INSPECTION_SAVED",
      outcome: "PASS",
    });
    expect(t.nextState).toBe("NOT_STARTED");
  });

  it("MINOR_ANOMALY proceeds to screening but logs a note", () => {
    const t = transitionEarState("NOT_STARTED", {
      type: "VISUAL_INSPECTION_SAVED",
      outcome: "MINOR_ANOMALY",
    });
    expect(t.nextState).toBe("NOT_STARTED");
    expect(hasEffect(t.sideEffects, "LOG_VISUAL_INSPECTION_NOTE")).toBe(true);
  });

  it("PE_TUBE proceeds to screening and logs an equipment note", () => {
    const t = transitionEarState("NOT_STARTED", {
      type: "VISUAL_INSPECTION_SAVED",
      outcome: "PE_TUBE",
    });
    expect(t.nextState).toBe("NOT_STARTED");
    expect(hasEffect(t.sideEffects, "LOG_VISUAL_INSPECTION_NOTE")).toBe(true);
  });

  it("REFER_MEDICAL blocks screening and creates an HCP referral", () => {
    const t = transitionEarState("NOT_STARTED", {
      type: "VISUAL_INSPECTION_SAVED",
      outcome: "REFER_MEDICAL",
    });
    expect(t.nextState).toBe("PENDING_MEDICAL_CLEARANCE_PRESCREEN");
    expect(hasEffect(t.sideEffects, "AUTO_CREATE_HCP_REFERRAL_PRESCREEN")).toBe(true);
  });
});

describe("guardScreening — blocked by pre-screening visual inspection referral", () => {
  it("Screen 1 cannot be saved while awaiting medical clearance", () => {
    expect(guardScreening("PENDING_MEDICAL_CLEARANCE_PRESCREEN", "SCREEN_1")).not.toBeNull();
  });
});

describe("transitionEarState — REFERRAL_UPDATED from a visual-inspection referral", () => {
  it("CLEARED unblocks Screen 1 (returns to NOT_STARTED, not CLEARED_FOR_RESCREEN)", () => {
    const t = transitionEarState("PENDING_MEDICAL_CLEARANCE_PRESCREEN", {
      type: "REFERRAL_UPDATED",
      referralStatus: "CLEARED",
    });
    expect(t.nextState).toBe("NOT_STARTED");
  });

  it("NO_SHOW keeps the ear blocked pending medical clearance", () => {
    const t = transitionEarState("PENDING_MEDICAL_CLEARANCE_PRESCREEN", {
      type: "REFERRAL_UPDATED",
      referralStatus: "NO_SHOW",
    });
    expect(t.nextState).toBe("PENDING_MEDICAL_CLEARANCE_PRESCREEN");
  });
});
