import { describe, it, expect } from "vitest";
import { buildImageMetadata } from "../src/features/session/captureStorage";
import type { CapturedImageRecord } from "../src/features/capture/capture.types";

function record(overrides: Partial<CapturedImageRecord> = {}): CapturedImageRecord {
  return {
    imageId: "img_1",
    sessionId: "sess_1",
    sequenceId: "default_card_v1",
    stepId: "front_left_raking",
    stepName: "Front - Left Raking Light",
    side: "front",
    lightingProfileId: "raking_left",
    capturedAt: "2026-07-05T12:00:00.000Z",
    cameraMetadata: { resolutionWidth: 1920, resolutionHeight: 1080, label: "Bench Cam" },
    rigMetadata: {
      firmwareVersion: "0.1.0",
      controllerBoard: "ESP32-S3",
      activeProfileId: "raking_left",
      zones: [
        { zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 90 },
      ],
      globalBrightness: 85,
      settleTimeMs: 300,
    },
    validationResult: {
      passed: true,
      score: 100,
      validationProfileId: "surface_raking",
      checks: {} as never,
      warnings: [],
      errors: [],
    },
    accepted: true,
    origin: "sequence",
    ...overrides,
  };
}

describe("buildImageMetadata", () => {
  it("maps the full record into the persisted metadata document", () => {
    const metadata = buildImageMetadata(record());
    expect(metadata).toMatchObject({
      imageId: "img_1",
      sessionId: "sess_1",
      sequenceId: "default_card_v1",
      stepId: "front_left_raking",
      side: "front",
      lightingProfileId: "raking_left",
      lightingProfileName: "Left Raking Light", // resolved from the catalog
      createdAt: "2026-07-05T12:00:00.000Z",
    });
    expect(metadata.rig.firmwareVersion).toBe("0.1.0");
    expect(metadata.rig.board).toBe("ESP32-S3");
    expect(metadata.rig.activeZones).toHaveLength(1);
    expect(metadata.rig.globalBrightness).toBe(85);
    expect(metadata.rig.settleTimeMs).toBe(300);
    expect(metadata.camera.resolutionWidth).toBe(1920);
    expect(metadata.validation.passed).toBe(true);
  });

  it("falls back gracefully when optional metadata is missing", () => {
    const metadata = buildImageMetadata(
      record({
        cameraMetadata: undefined,
        rigMetadata: undefined,
        validationResult: undefined,
        lightingProfileId: "some_custom_profile",
        accepted: false,
      })
    );
    expect(metadata.lightingProfileName).toBe("some_custom_profile");
    expect(metadata.rig.activeZones).toEqual([]);
    expect(metadata.camera.resolutionWidth).toBe(0);
    expect(metadata.validation.passed).toBe(false);
  });
});
