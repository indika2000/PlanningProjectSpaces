import { describe, it, expect } from "vitest";
import {
  CAPTURE_SEQUENCES,
  DEFAULT_CARD_CAPTURE_SEQUENCE,
  SHOT_MATRIX_SEQUENCE,
  getCaptureSequence,
  firstStepIndexOfSide,
} from "../src/features/capture/captureSequences";
import { getLightingProfile } from "../src/features/capture/lightingProfiles";
import { VALIDATION_PROFILES } from "../src/features/validation/imageValidationService";

const validationIds = new Set(VALIDATION_PROFILES.map((p) => p.id));

describe("capture sequence catalog integrity", () => {
  it("has unique sequence ids and unique step ids within each sequence", () => {
    const seqIds = CAPTURE_SEQUENCES.map((s) => s.id);
    expect(new Set(seqIds).size).toBe(seqIds.length);
    for (const seq of CAPTURE_SEQUENCES) {
      const stepIds = seq.steps.map((s) => s.id);
      expect(new Set(stepIds).size, seq.id).toBe(stepIds.length);
    }
  });

  it("every step references an existing lighting profile", () => {
    for (const seq of CAPTURE_SEQUENCES) {
      for (const step of seq.steps) {
        expect(getLightingProfile(step.lightingProfileId), `${seq.id}/${step.id}`).toBeDefined();
      }
    }
  });

  it("every step references an existing validation profile", () => {
    for (const seq of CAPTURE_SEQUENCES) {
      for (const step of seq.steps) {
        expect(validationIds.has(step.validationProfileId), `${seq.id}/${step.id}`).toBe(true);
      }
    }
  });

  it("steps have sane settle times and retry budgets", () => {
    for (const seq of CAPTURE_SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.settleTimeMs).toBeGreaterThanOrEqual(100);
        expect(step.settleTimeMs).toBeLessThanOrEqual(5000);
        expect(step.maxRetries).toBeGreaterThanOrEqual(0);
        expect(step.maxRetries).toBeLessThanOrEqual(5);
        expect(step.expectedUse.length).toBeGreaterThan(0);
      }
    }
  });

  it("front steps come before back steps (single flip per sequence)", () => {
    for (const seq of CAPTURE_SEQUENCES) {
      const sides = seq.steps.map((s) => s.side).filter((s) => s === "front" || s === "back");
      const firstBack = sides.indexOf("back");
      if (firstBack >= 0) {
        expect(sides.slice(firstBack).every((s) => s === "back"), seq.id).toBe(true);
      }
    }
  });
});

describe("default sequence", () => {
  it("contains the required diagnostic shots", () => {
    const requiredIds = DEFAULT_CARD_CAPTURE_SEQUENCE.filter((s) => s.required).map((s) => s.id);
    expect(requiredIds).toEqual([
      "front_diffuse",
      "front_left_raking",
      "front_right_raking",
      "front_glare",
      "back_diffuse",
      "back_left_raking",
      "back_right_raking",
    ]);
  });

  it("top/bottom raking are optional", () => {
    for (const id of ["front_top_raking", "front_bottom_raking"]) {
      expect(DEFAULT_CARD_CAPTURE_SEQUENCE.find((s) => s.id === id)?.required).toBe(false);
    }
  });
});

describe("shot matrix sequence (schematic A-F)", () => {
  it("has 6 shots per side in schematic order", () => {
    const front = SHOT_MATRIX_SEQUENCE.filter((s) => s.side === "front");
    const back = SHOT_MATRIX_SEQUENCE.filter((s) => s.side === "back");
    expect(front).toHaveLength(6);
    expect(back).toHaveLength(6);
    expect(front.map((s) => s.lightingProfileId)).toEqual([
      "diffuse_full_front", // Shot A: D1
      "raking_top",         // Shot B: R1
      "raking_right",       // Shot C: R2
      "raking_bottom",      // Shot D: R3
      "raking_left",        // Shot E: R4
      "surface_glare",      // Shot F: O1-O2
    ]);
  });

  it("specular shot F is optional (O1/O2 may not be installed yet)", () => {
    const shotF = SHOT_MATRIX_SEQUENCE.filter((s) => s.id.includes("shot_f"));
    expect(shotF).toHaveLength(2);
    expect(shotF.every((s) => !s.required)).toBe(true);
  });

  it("is registered and retrievable", () => {
    expect(getCaptureSequence("shot_matrix_v1")?.steps).toHaveLength(12);
  });
});

describe("firstStepIndexOfSide", () => {
  it("finds the flip point", () => {
    const backIndex = firstStepIndexOfSide(SHOT_MATRIX_SEQUENCE, "back");
    expect(backIndex).toBe(6);
    expect(firstStepIndexOfSide(SHOT_MATRIX_SEQUENCE, "front")).toBe(0);
    expect(firstStepIndexOfSide(SHOT_MATRIX_SEQUENCE, "edge")).toBe(-1);
  });
});
