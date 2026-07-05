/**
 * Additional engine tests: operator overrides, re-run, manual capture,
 * review accept/reject, and abort semantics.
 */

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
import type { ImageValidationResult } from "../src/features/validation/validation.types";
import { getLightingProfile } from "../src/features/capture/lightingProfiles";

function fakeRig(): RigController & { profileLog: string[] } {
  const rig = {
    profileLog: [] as string[],
    isConnected: () => true,
    ensureConnected: vi.fn(async () => {}),
    applyLightingProfile: vi.fn(async (profileId: string): Promise<AppliedLighting> => {
      rig.profileLog.push(profileId);
      const profile = getLightingProfile(profileId)!;
      return { profile, appliedZones: profile.zones, droppedZoneIds: [] };
    }),
    allOff: vi.fn(async () => {
      rig.profileLog.push("all_off");
    }),
    setCaptureSessionActive: vi.fn(async () => {}),
  };
  return rig;
}

function fakeCamera(): CameraController {
  return {
    ensureReady: vi.fn(async () => {}),
    capture: vi.fn(
      async (): Promise<CapturedFrame> => ({
        pixels: { width: 4, height: 4, data: new Uint8ClampedArray(64) },
        cameraMetadata: { resolutionWidth: 4, resolutionHeight: 4 },
      })
    ),
  };
}

function result(passed: boolean): ImageValidationResult {
  return {
    passed,
    score: passed ? 100 : 10,
    validationProfileId: "t",
    checks: {} as ImageValidationResult["checks"],
    warnings: [],
    errors: passed ? [] : ["bad image"],
    suggestedAction: passed ? undefined : "Fix it.",
  };
}

function scriptedValidator(script: boolean[]): ImageValidator {
  let i = 0;
  return { validate: vi.fn(async () => result(script[Math.min(i++, script.length - 1)]!)) };
}

function memStorage(): CaptureStorage & { saved: CapturedImageRecord[] } {
  const s = {
    saved: [] as CapturedImageRecord[],
    saveImage: vi.fn(async (r: CapturedImageRecord) => {
      s.saved.push(r);
      return r;
    }),
    saveSessionState: vi.fn(async (_state: CaptureSessionState) => {}),
  };
  return s;
}

function seq(ids: string[], side: "front" | "back" = "front"): CaptureSequenceDefinition {
  return {
    id: "seq",
    name: "seq",
    description: "",
    version: 1,
    steps: ids.map((id) => ({
      id,
      name: id,
      side,
      lightingProfileId: "raking_left",
      required: true,
      description: "",
      expectedUse: ["x"],
      settleTimeMs: 1,
      validationProfileId: "surface_raking",
      maxRetries: 1,
    })),
  };
}

function build(validator: ImageValidator = scriptedValidator([true])) {
  const rig = fakeRig();
  const camera = fakeCamera();
  const storage = memStorage();
  const engine = new CaptureSequenceEngine({
    rig,
    camera,
    validator,
    storage,
    sleep: async () => {},
  });
  return { engine, rig, camera, storage };
}

describe("operator override paths", () => {
  it("accept_anyway marks the step accepted and flips the image to accepted", async () => {
    const { engine } = build(scriptedValidator([false, false, false]));
    const done = engine.start({ sessionId: "s", sequence: seq(["a"]) });
    await vi.waitFor(() => expect(engine.getState()?.status).toBe("awaiting_operator"));
    engine.resolveOperatorDecision("accept_anyway");
    const final = await done;
    expect(final.steps[0]!.status).toBe("accepted");
    const lastImage = final.images.at(-1)!;
    expect(lastImage.accepted).toBe(true); // operator override recorded on the record
  });

  it("abort after failed validation fails the whole session", async () => {
    const { engine, rig } = build(scriptedValidator([false, false, false]));
    const done = engine.start({ sessionId: "s", sequence: seq(["a", "b"]) });
    await vi.waitFor(() => expect(engine.getState()?.status).toBe("awaiting_operator"));
    engine.resolveOperatorDecision("abort");
    const final = await done;
    expect(final.status).toBe("failed");
    expect(rig.profileLog).toContain("all_off"); // lights never left on
  });

  it("operator retry resets the attempt budget", async () => {
    // maxRetries=1 => 2 automatic attempts, both fail -> operator retry
    // grants 2 more attempts; the 4th attempt passes.
    const { engine } = build(scriptedValidator([false, false, false, true]));
    const done = engine.start({ sessionId: "s", sequence: seq(["a"]) });
    await vi.waitFor(() => expect(engine.getState()?.status).toBe("awaiting_operator"));
    engine.resolveOperatorDecision("retry");
    const final = await done;
    expect(final.steps[0]!.status).toBe("accepted");
    expect(final.images).toHaveLength(4);
  });
});

describe("re-run and manual capture", () => {
  it("rerunStep captures a fresh image for a completed step", async () => {
    const { engine, storage } = build();
    await engine.start({ sessionId: "s", sequence: seq(["a"]) });
    expect(storage.saved).toHaveLength(1);

    await engine.rerunStep("a");
    expect(storage.saved).toHaveLength(2);
    expect(storage.saved[1]!.origin).toBe("rerun");
    expect(engine.getState()!.status).toBe("review");
  });

  it("rerunStep rejects unknown steps and refuses to run mid-sequence", async () => {
    const { engine } = build(scriptedValidator([false, false, false]));
    const done = engine.start({ sessionId: "s", sequence: seq(["a"]) });
    await vi.waitFor(() => expect(engine.getState()?.status).toBe("awaiting_operator"));
    await expect(engine.rerunStep("a")).rejects.toThrow(/while a sequence is running/i);
    engine.resolveOperatorDecision("skip");
    await done;
    await expect(engine.rerunStep("nope")).rejects.toThrow(/unknown step/i);
  });

  it("captureManual stores an image with origin manual and chosen lighting", async () => {
    const { engine, storage, rig } = build();
    await engine.start({ sessionId: "s", sequence: seq(["a"]) });
    const record = await engine.captureManual("surface_glare");
    expect(record.origin).toBe("manual");
    expect(record.lightingProfileId).toBe("surface_glare");
    expect(rig.profileLog).toContain("surface_glare");
    expect(storage.saved.at(-1)!.imageId).toBe(record.imageId);
    expect(engine.getState()!.images.some((i) => i.imageId === record.imageId)).toBe(true);
  });
});

describe("review controls", () => {
  it("acceptImage / rejectImage / markSessionCompleted", async () => {
    const { engine } = build();
    const final = await engine.start({ sessionId: "s", sequence: seq(["a"]) });
    const imageId = final.images[0]!.imageId;

    engine.rejectImage(imageId, "operator did not like it");
    expect(engine.getState()!.images[0]).toMatchObject({
      accepted: false,
      rejectedReason: "operator did not like it",
    });

    engine.acceptImage(imageId);
    expect(engine.getState()!.images[0]!.accepted).toBe(true);

    engine.markSessionCompleted();
    expect(engine.getState()!.status).toBe("completed");
    expect(engine.getState()!.completedAt).toBeTruthy();
  });

  it("refuses to start while already running", async () => {
    const { engine } = build(scriptedValidator([false, false, false]));
    const done = engine.start({ sessionId: "s", sequence: seq(["a"]) });
    await vi.waitFor(() => expect(engine.getState()?.status).toBe("awaiting_operator"));
    await expect(engine.start({ sessionId: "s2", sequence: seq(["b"]) })).rejects.toThrow(
      /already running/i
    );
    engine.resolveOperatorDecision("skip");
    await done;
  });
});

describe("subscription", () => {
  it("subscribers get every state transition and can unsubscribe", async () => {
    const { engine } = build();
    const statuses: string[] = [];
    const unsubscribe = engine.subscribe((s) => statuses.push(s.status));
    await engine.start({ sessionId: "s", sequence: seq(["a"]) });
    expect(statuses).toContain("capturing");
    expect(statuses.at(-1)).toBe("review");
    const count = statuses.length;
    unsubscribe();
    engine.markSessionCompleted();
    expect(statuses.length).toBe(count);
  });
});
