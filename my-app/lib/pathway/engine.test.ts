// lib/pathway/engine.test.ts
// One test per row in §17.2 state transition table.
// Run with: npx jest lib/pathway/engine.test.ts

import {
  transitionState,
  assignModality,
  derivePatientStatus,
  checkOrderViolation,
} from "./engine";

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
// §17.2 row 1 — NOT_STARTED + Screen 1 PASS → SCREEN_1_PASSED
// ---------------------------------------------------------------------------
describe("NOT_STARTED transitions", () => {
  it("row 1: Screen 1 PASS → SCREEN_1_PASSED with milestone recompute", () => {
    const result = transitionState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "PASS",
    });
    expect(result.nextState).toBe("SCREEN_1_PASSED");
    expect(result.sideEffects).toContain("RECOMPUTE_MILESTONES");
    expect(result.sideEffects).toContain("MARK_EAR_RESOLVED");
  });

  it("row 2: Screen 1 NOT_PASS → SCREEN_1_FAILED with notifications", () => {
    const result = transitionState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("SCREEN_1_FAILED");
    expect(result.sideEffects).toContain("SCHEDULE_SCREEN2_NOTIFICATIONS");
  });

  it("row 3: Screen 1 INCOMPLETE → NOT_STARTED (no state change)", () => {
    const result = transitionState("NOT_STARTED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_1",
      result: "INCOMPLETE",
    });
    expect(result.nextState).toBe("NOT_STARTED");
    expect(result.sideEffects).toContain("LOG_ATTEMPT");
    expect(result.sideEffects).toContain("ALERT_CLERK_RETRY");
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 4-6 — SCREEN_1_FAILED transitions
// ---------------------------------------------------------------------------
describe("SCREEN_1_FAILED transitions", () => {
  it("row 4: Screen 2 PASS → SCREEN_2_PASSED", () => {
    const result = transitionState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "PASS",
    });
    expect(result.nextState).toBe("SCREEN_2_PASSED");
    expect(result.sideEffects).toContain("RECOMPUTE_MILESTONES");
    expect(result.sideEffects).toContain("MARK_EAR_RESOLVED");
  });

  it("row 5: Screen 2 NOT_PASS → SCREEN_2_FAILED with HCP referral", () => {
    const result = transitionState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(result.sideEffects).toContain("AUTO_CREATE_HCP_REFERRAL");
    expect(result.sideEffects).toContain("SCHEDULE_HCP_REFERRAL_NOTIFICATIONS");
  });

  it("row 6: Screen 2 INCOMPLETE → SCREEN_1_FAILED (no state change)", () => {
    const result = transitionState("SCREEN_1_FAILED", {
      type: "SCREENING_SAVED",
      stage: "SCREEN_2",
      result: "INCOMPLETE",
    });
    expect(result.nextState).toBe("SCREEN_1_FAILED");
    expect(result.sideEffects).toContain("LOG_ATTEMPT");
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 7-10 — SCREEN_2_FAILED transitions
// ---------------------------------------------------------------------------
describe("SCREEN_2_FAILED transitions", () => {
  it("row 7: Referral CLEARED → CLEARED_FOR_RESCREEN", () => {
    const result = transitionState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "CLEARED",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(result.sideEffects).toContain("SCHEDULE_RESCREEN_IMMEDIATELY");
    expect(result.sideEffects).toContain("CANCEL_HCP_NOTIFICATION_SERIES");
  });

  it("row 8: Referral TREATED → CLEARED_FOR_RESCREEN with treatment delay", () => {
    const result = transitionState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "TREATED",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(result.sideEffects).toContain("SCHEDULE_RESCREEN_AFTER_TREATMENT_DELAY");
  });

  it("row 9: Referral SEEN (PE tube) → CLEARED_FOR_RESCREEN with PE delay", () => {
    const result = transitionState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "SEEN",
    });
    expect(result.nextState).toBe("CLEARED_FOR_RESCREEN");
    expect(result.sideEffects).toContain("SCHEDULE_RESCREEN_AFTER_PE_DELAY");
  });

  it("row 10: Referral NO_SHOW → SCREEN_2_FAILED (no state change, log no-show)", () => {
    const result = transitionState("SCREEN_2_FAILED", {
      type: "REFERRAL_UPDATED",
      referralStatus: "NO_SHOW",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(result.sideEffects).toContain("LOG_NO_SHOW_EVENT");
    expect(result.sideEffects).toContain("RESUME_HCP_NOTIFICATION_SERIES");
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 11-12 — CLEARED_FOR_RESCREEN transitions
// ---------------------------------------------------------------------------
describe("CLEARED_FOR_RESCREEN transitions", () => {
  it("row 11: Rescreen PASS → RESCREEN_PASSED", () => {
    const result = transitionState("CLEARED_FOR_RESCREEN", {
      type: "SCREENING_SAVED",
      stage: "RESCREEN_POST_REFERRAL",
      result: "PASS",
    });
    expect(result.nextState).toBe("RESCREEN_PASSED");
    expect(result.sideEffects).toContain("RECOMPUTE_MILESTONES");
    expect(result.sideEffects).toContain("MARK_EAR_RESOLVED");
  });

  it("row 12: Rescreen NOT_PASS → RESCREEN_FAILED with audiology referral", () => {
    const result = transitionState("CLEARED_FOR_RESCREEN", {
      type: "SCREENING_SAVED",
      stage: "RESCREEN_POST_REFERRAL",
      result: "NOT_PASS",
    });
    expect(result.nextState).toBe("RESCREEN_FAILED");
    expect(result.sideEffects).toContain("AUTO_CREATE_AUDIOLOGY_REFERRAL");
    expect(result.sideEffects).toContain("SCHEDULE_AUDIOLOGY_NOTIFICATIONS");
  });
});

// ---------------------------------------------------------------------------
// §17.2 row 13 — RESCREEN_FAILED → DIAGNOSED
// ---------------------------------------------------------------------------
describe("RESCREEN_FAILED transitions", () => {
  it("row 13: Diagnostic saved with hearing loss → DIAGNOSED with intervention notifications", () => {
    const result = transitionState("RESCREEN_FAILED", {
      type: "DIAGNOSTIC_SAVED",
      hasHearingLoss: true,
    });
    expect(result.nextState).toBe("DIAGNOSED");
    expect(result.sideEffects).toContain("SET_DIAGNOSIS");
    expect(result.sideEffects).toContain("SCHEDULE_INTERVENTION_NOTIFICATIONS");
  });

  it("row 13b: Diagnostic saved without hearing loss → DIAGNOSED without intervention notifications", () => {
    const result = transitionState("RESCREEN_FAILED", {
      type: "DIAGNOSTIC_SAVED",
      hasHearingLoss: false,
    });
    expect(result.nextState).toBe("DIAGNOSED");
    expect(result.sideEffects).not.toContain("SCHEDULE_INTERVENTION_NOTIFICATIONS");
  });
});

// ---------------------------------------------------------------------------
// §17.2 rows 14-16 — PENDING_LTFU transitions
// ---------------------------------------------------------------------------
describe("PENDING_LTFU transitions", () => {
  it("row 15: Supervisor marks LTFU → LOST_TO_FOLLOWUP", () => {
    const result = transitionState("PENDING_LTFU", {
      type: "SUPERVISOR_MARKED_LTFU",
    });
    expect(result.nextState).toBe("LOST_TO_FOLLOWUP");
    expect(result.sideEffects).toContain("SET_FINAL_STATUS_LTFU");
    expect(result.sideEffects).toContain("STOP_ALL_NOTIFICATIONS");
  });

  it("row 16: Contact re-established → resumes prior active state", () => {
    const result = transitionState("PENDING_LTFU", {
      type: "CONTACT_REESTABLISHED",
      priorState: "SCREEN_2_FAILED",
    });
    expect(result.nextState).toBe("SCREEN_2_FAILED");
    expect(result.sideEffects).toContain("RESUME_PATHWAY");
  });
});

// ---------------------------------------------------------------------------
// Terminal state guard — no transitions from resolved states
// ---------------------------------------------------------------------------
describe("Terminal state guard", () => {
  const terminalStates = [
    "SCREEN_1_PASSED",
    "SCREEN_2_PASSED",
    "RESCREEN_PASSED",
    "DIAGNOSED",
    "LOST_TO_FOLLOWUP",
  ] as const;

  terminalStates.forEach((state) => {
    it(`${state} returns self with a warning`, () => {
      const result = transitionState(state, {
        type: "SCREENING_SAVED",
        stage: "SCREEN_1",
        result: "PASS",
      });
      expect(result.nextState).toBe(state);
      expect(result.warning).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// §17.4 — Out-of-order entry protection
// ---------------------------------------------------------------------------
describe("checkOrderViolation", () => {
  it("blocks Screen 2 when state is NOT_STARTED", () => {
    expect(checkOrderViolation("NOT_STARTED", "SCREEN_2")).toBe(
      "SCREEN_2_WITHOUT_SCREEN_1"
    );
  });

  it("allows Screen 2 when state is SCREEN_1_FAILED", () => {
    expect(checkOrderViolation("SCREEN_1_FAILED", "SCREEN_2")).toBeNull();
  });

  it("blocks Rescreen when state is not CLEARED_FOR_RESCREEN", () => {
    expect(checkOrderViolation("SCREEN_2_FAILED", "RESCREEN_POST_REFERRAL")).toBe(
      "RESCREEN_WITHOUT_HCP_REFERRAL_RESOLVED"
    );
  });

  it("allows Rescreen when state is CLEARED_FOR_RESCREEN", () => {
    expect(checkOrderViolation("CLEARED_FOR_RESCREEN", "RESCREEN_POST_REFERRAL")).toBeNull();
  });

  it("blocks Diagnostic when state is not RESCREEN_FAILED", () => {
    expect(checkOrderViolation("SCREEN_1_FAILED", "DIAGNOSTIC")).toBe(
      "DIAGNOSTIC_WITHOUT_AUDIOLOGY_REFERRAL"
    );
  });

  it("allows Diagnostic when state is RESCREEN_FAILED", () => {
    expect(checkOrderViolation("RESCREEN_FAILED", "DIAGNOSTIC")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §17.5 — Bilateral state → patient-level status
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