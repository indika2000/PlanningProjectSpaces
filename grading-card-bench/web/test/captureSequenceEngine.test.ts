import { describe, it, expect, vi } from "vitest";
import {
  CaptureSequenceEngine,
  type AppliedLighting,
  type CameraController,
  type CaptureStorage,
  type CapturedFrame,
  type ImageValidator,
  type RigController,
} from "../src/features/capture/captureSequenceEngine";
import type {
  CaptureSequenceDefinition,
  CaptureSessionState,
  CapturedImageRecord,
} from "../src/features/capture/capture.types";
import type { ImageValidationResult, PixelImage } from "../src/features/validation/validation.types";
import { getLightingProfile } from "../src/features/capture/lightingProfiles";

// ---- Fakes -------------------------------------------------------------------

function makeFakeRig(): RigController & { calls: string[]; failNextProfile?: boolean } {
  const rig = {
    calls: [] as string[],
    failNextProfile: false,
    isConnected: () => true,
    ensureConnected: vi.fn(async () => {
      rig.calls.push("ensureConnected");
    }),
    applyLightingProfile: vi.fn(async (profileId: string): Promise<AppliedLighting> => {
      rig.calls.push(`profile:${profileId}`);
      if (rig.failNextProfile) {
        rig.failNextProfile = false;
        throw new Error("Rig timeout applying profile");
      }
      const profile = getLightingProfile(profileId) ?? {
        id: profileId,
        name: profileId,
        description: "",
        zones: [],
        globalBrightness: 80,
        purpose: [],
      };
      return {
        profile,
        appliedZones: profile.zones,
        droppedZoneIds: [],
        firmwareVersion: "0.1.0-test",
        board: "TEST",
      };
    }),
    allOff: vi.fn(async () => {
      rig.calls.push("allOff");
    }),
    setCaptureSessionActive: vi.fn(async (active: boolean) => {
      rig.calls.push(`session:${active}`);
    }),
  };
  return rig;
}

function fakeFrame(): CapturedFrame {
  return {
    pixels: { width: 4, height: 4, data: new Uint8ClampedArray(64) } as PixelImage,
    cameraMetadata: { resolutionWidth: 4, resolutionHeight: 4 },
  };
}

function makeFakeCamera(): CameraController & { captures: number } {
  const cam = {
    captures: 0,
    ensureReady: vi.fn(async () => {}),
    capture: vi.fn(async () => {
      cam.captures += 1;
      return fakeFrame();
    }),
  };
  return cam;
}

function passResult(): ImageValidationResult {
  return {
    passed: true,
    score: 100,
    validationProfileId: "test",
    checks: {} as ImageValidationResult["checks"],
    warnings: [],
    errors: [],
  };
}

function failResult(): ImageValidationResult {
  return {
    ...passResult(),
    passed: false,
    score: 20,
    errors: ["too blurry"],
    suggestedAction: "The image appears blurry.",
  };
}

function makeValidator(script: Array<boolean>): ImageValidator {
  let i = 0;
  return {
    validate: vi.fn(async () => {
      const pass = script[Math.min(i, script.length - 1)];
      i += 1;
      return pass ? passResult() : failResult();
    }),
  };
}

function makeStorage(): CaptureStorage & { saved: CapturedImageRecord[]; states: CaptureSessionState[] } {
  const storage = {
    saved: [] as CapturedImageRecord[],
    states: [] as CaptureSessionState[],
    saveImage: vi.fn(async (record: CapturedImageRecord) => {
      storage.saved.push(record);
      return { ...record, storageUrl: `mem://${record.imageId}` };
    }),
    saveSessionState: vi.fn(async (state: CaptureSessionState) => {
      storage.states.push(state);
    }),
  };
  return storage;
}

function sequence(stepIds: Array<[string, "front" | "back", boolean]>): CaptureSequenceDefinition {
  return {
    id: "test_seq",
    name: "Test",
    description: "",
    version: 1,
    steps: stepIds.map(([id, side, required]) => ({
      id,
      name: id,
      side,
      lightingProfileId: "raking_left",
      required,
      description: "",
      expectedUse: [],
      settleTimeMs: 1,
      validationProfileId: "surface_raking",
      maxRetries: 2,
    })),
  };
}

function makeEngine(deps?: Partial<Parameters<typeof buildDeps>[0]>) {
  return buildDeps({ ...deps });
}

function buildDeps(overrides: {
  rig?: ReturnType<typeof makeFakeRig>;
  camera?: ReturnType<typeof makeFakeCamera>;
  validator?: ImageValidator;
  storage?: ReturnType<typeof makeStorage>;
}) {
  const rig = overrides.rig ?? makeFakeRig();
  const camera = overrides.camera ?? makeFakeCamera();
  const validator = overrides.validator ?? makeValidator([true]);
  const storage = overrides.storage ?? makeStorage();
  const engine = new CaptureSequenceEngine({
    rig,
    camera,
    validator,
    storage,
    sleep: async () => {},
  });
  return { engine, rig, camera, validator, storage };
}

// ---- Tests --------------------------------------------------------------------

describe("CaptureSequenceEngine", () => {
  it("runs a two-step sequence to completion and turns lights off", async () => {
    const { engine, rig, storage } = makeEngine();
    const final = await engine.start({
      sessionId: "s1",
      sequence: sequence([
        ["front_diffuse", "front", true],
        ["front_raking", "front", true],
      ]),
    });

    expect(final.status).toBe("review");
    expect(final.steps.every((s) => s.status === "accepted")).toBe(true);
    expect(final.images).toHaveLength(2);
    expect(rig.calls.at(-1)).toBe("session:false");
    expect(rig.calls).toContain("allOff");
    // Lighting profile metadata rides along on every image.
    expect(storage.saved[0]!.rigMetadata?.activeProfileId).toBe("raking_left");
    expect(storage.saved[0]!.rigMetadata?.zones.length).toBeGreaterThan(0);
  });

  it("retries failed validation and succeeds within maxRetries", async () => {
    const validator = makeValidator([false, true]); // fail once, then pass
    const { engine, camera } = makeEngine({ validator });
    const final = await engine.start({
      sessionId: "s2",
      sequence: sequence([["front_diffuse", "front", true]]),
    });
    expect(final.steps[0]!.status).toBe("accepted");
    expect(camera.captures).toBe(2);
    // The failed capture is stored too (marked not accepted).
    expect(final.images).toHaveLength(2);
    expect(final.images[0]!.accepted).toBe(false);
    expect(final.images[1]!.accepted).toBe(true);
  });

  it("asks the operator after retries are exhausted; skip moves on", async () => {
    const validator = makeValidator([false, false, false, true]);
    const { engine } = makeEngine({ validator });

    const statuses: string[] = [];
    engine.subscribe((s) => statuses.push(s.status));

    const done = engine.start({
      sessionId: "s3",
      sequence: sequence([
        ["front_diffuse", "front", true],
        ["front_raking", "front", true],
      ]),
    });

    // Wait for the operator prompt.
    await vi.waitFor(() => {
      expect(engine.getState()?.status).toBe("awaiting_operator");
    });
    engine.resolveOperatorDecision("skip");

    const final = await done;
    expect(final.steps[0]!.status).toBe("skipped");
    expect(final.steps[1]!.status).toBe("accepted");
    expect(final.status).toBe("review");
  });

  it("prompts for a card flip between front and back sides", async () => {
    const { engine, rig } = makeEngine();
    const done = engine.start({
      sessionId: "s4",
      sequence: sequence([
        ["front_diffuse", "front", true],
        ["back_diffuse", "back", true],
      ]),
    });

    await vi.waitFor(() => {
      expect(engine.getState()?.status).toBe("awaiting_flip");
    });
    // Lights go off while the operator's hands are in the rig.
    expect(rig.calls.filter((c) => c === "allOff").length).toBeGreaterThan(0);
    engine.confirmCardFlipped();

    const final = await done;
    expect(final.status).toBe("review");
    expect(final.steps.map((s) => s.status)).toEqual(["accepted", "accepted"]);
  });

  it("handles rig failure mid-sequence via operator retry", async () => {
    const rig = makeFakeRig();
    const { engine } = makeEngine({ rig });
    const done = engine.start({
      sessionId: "s5",
      sequence: sequence([["front_diffuse", "front", true]]),
    });
    // First profile application fails.
    rig.failNextProfile = true;

    await vi.waitFor(() => {
      expect(engine.getState()?.status).toBe("awaiting_operator");
    });
    expect(engine.getState()?.steps[0]!.error).toMatch(/rig timeout/i);
    engine.resolveOperatorDecision("retry");

    const final = await done;
    expect(final.steps[0]!.status).toBe("accepted");
  });

  it("cancel stops the sequence and turns lights off", async () => {
    const validator = makeValidator([false, false, false]); // will hit operator prompt
    const { engine, rig } = makeEngine({ validator });
    const done = engine.start({
      sessionId: "s6",
      sequence: sequence([
        ["a", "front", true],
        ["b", "front", true],
      ]),
    });
    await vi.waitFor(() => {
      expect(engine.getState()?.status).toBe("awaiting_operator");
    });
    engine.cancel();
    const final = await done;
    expect(final.status).toBe("cancelled");
    expect(rig.calls).toContain("allOff");
    expect(rig.calls.at(-1)).toBe("session:false");
  });

  it("pause holds before the next step; resume continues", async () => {
    const { engine } = makeEngine();
    const done = engine.start({
      sessionId: "s7",
      sequence: sequence([
        ["a", "front", true],
        ["b", "front", true],
      ]),
    });
    engine.pause();
    await new Promise((r) => setTimeout(r, 20));
    expect(["paused", "capturing"]).toContain(engine.getState()!.status);
    engine.resume();
    const final = await done;
    expect(final.status).toBe("review");
  });

  it("fails the session when camera is unavailable and operator aborts", async () => {
    const camera = makeFakeCamera();
    camera.ensureReady = vi.fn(async () => {
      throw new Error("Camera not found");
    });
    const { engine, rig } = makeEngine({ camera });
    const final = await engine.start({
      sessionId: "s8",
      sequence: sequence([["a", "front", true]]),
    });
    expect(final.status).toBe("failed");
    expect(final.error).toMatch(/camera not found/i);
    expect(rig.calls).toContain("allOff");
  });

  it("session metadata is created correctly", async () => {
    const { engine, storage } = makeEngine();
    const final = await engine.start({
      sessionId: "s9",
      sequence: sequence([["front_diffuse", "front", true]]),
      cardId: "card-42",
      customerId: "cust-7",
    });
    expect(final.sessionId).toBe("s9");
    expect(final.cardId).toBe("card-42");
    expect(final.customerId).toBe("cust-7");
    expect(final.startedAt).toBeTruthy();
    expect(final.completedAt).toBeTruthy();
    const img = storage.saved[0]!;
    expect(img.sessionId).toBe("s9");
    expect(img.stepId).toBe("front_diffuse");
    expect(img.lightingProfileId).toBe("raking_left");
    // Session state was persisted along the way.
    expect(storage.states.length).toBeGreaterThan(0);
  });
});
