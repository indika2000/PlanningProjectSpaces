import { describe, it, expect } from "vitest";
import {
  wsClientMessageSchema,
  rigCapabilitiesPayloadSchema,
  zoneCommandSchema,
  lightingProfilePayloadSchema,
  rigResponseSchema,
} from "../src/protocol/schemas.js";

const validZone = {
  zoneId: "ZONE_LEFT_RAKING",
  enabled: true,
  rgb: { r: 255, g: 255, b: 255 },
  brightness: 90,
};

describe("zoneCommandSchema", () => {
  it("accepts a valid zone command", () => {
    expect(zoneCommandSchema.safeParse(validZone).success).toBe(true);
  });

  it.each([
    ["brightness above 100", { ...validZone, brightness: 101 }],
    ["negative brightness", { ...validZone, brightness: -1 }],
    ["rgb channel above 255", { ...validZone, rgb: { r: 256, g: 0, b: 0 } }],
    ["rgb channel negative", { ...validZone, rgb: { r: -2, g: 0, b: 0 } }],
    ["non-integer rgb", { ...validZone, rgb: { r: 12.5, g: 0, b: 0 } }],
    ["empty zoneId", { ...validZone, zoneId: "" }],
    ["missing enabled", { ...validZone, enabled: undefined }],
  ])("rejects %s", (_name, payload) => {
    expect(zoneCommandSchema.safeParse(payload).success).toBe(false);
  });
});

describe("lightingProfilePayloadSchema", () => {
  it("accepts a valid profile and defaults fadeMs to 0", () => {
    const parsed = lightingProfilePayloadSchema.parse({
      profileId: "raking_left",
      globalBrightness: 85,
      zones: [validZone],
    });
    expect(parsed.fadeMs).toBe(0);
  });

  it("rejects fade beyond 5000ms and oversized zone lists", () => {
    expect(
      lightingProfilePayloadSchema.safeParse({
        profileId: "x",
        globalBrightness: 50,
        zones: [],
        fadeMs: 10_000,
      }).success
    ).toBe(false);
    expect(
      lightingProfilePayloadSchema.safeParse({
        profileId: "x",
        globalBrightness: 50,
        zones: Array.from({ length: 65 }, () => validZone),
      }).success
    ).toBe(false);
  });
});

describe("wsClientMessageSchema", () => {
  it("accepts every documented client message type", () => {
    const messages = [
      { type: "rig:connect" },
      { type: "rig:connect", portPath: "/dev/ttyUSB0" },
      { type: "rig:disconnect" },
      { type: "rig:ping", requestId: "r1" },
      { type: "rig:get-info" },
      { type: "rig:get-capabilities" },
      { type: "rig:get-status" },
      {
        type: "rig:set-profile",
        profile: { profileId: "p", globalBrightness: 50, zones: [validZone] },
      },
      { type: "rig:set-zone", zone: { ...validZone, fadeMs: 100 } },
      { type: "rig:all-off" },
      { type: "rig:test-pattern", durationMs: 3000 },
      { type: "rig:emergency-stop" },
      { type: "rig:list-ports" },
      { type: "rig:capture-session", active: true, sessionId: "s1" },
    ];
    for (const msg of messages) {
      const result = wsClientMessageSchema.safeParse(msg);
      expect(result.success, `${msg.type} should parse`).toBe(true);
    }
  });

  it.each([
    ["unknown type", { type: "rig:reboot-the-world" }],
    ["set-profile without profile", { type: "rig:set-profile" }],
    ["set-zone with bad zone", { type: "rig:set-zone", zone: { zoneId: "x" } }],
    ["test-pattern too long", { type: "rig:test-pattern", durationMs: 120_000 }],
    ["test-pattern too short", { type: "rig:test-pattern", durationMs: 100 }],
    ["capture-session without active", { type: "rig:capture-session" }],
    ["not an object", "rig:ping"],
  ])("rejects %s", (_name, payload) => {
    expect(wsClientMessageSchema.safeParse(payload).success).toBe(false);
  });
});

describe("rigCapabilitiesPayloadSchema", () => {
  const caps = {
    firmwareVersion: "0.1.0",
    board: "ESP32-S3",
    ledType: "WS2812B",
    maxBrightness: 200,
    zones: [
      { zoneId: "Z", name: "Zone", startPixel: 0, pixelCount: 10, installed: true },
    ],
    supportsFade: true,
    supportsProfiles: true,
    supportsSavedConfig: false,
  };

  it("accepts the firmware capabilities shape", () => {
    expect(rigCapabilitiesPayloadSchema.safeParse(caps).success).toBe(true);
  });

  it("rejects capabilities missing zones or version", () => {
    expect(rigCapabilitiesPayloadSchema.safeParse({ ...caps, zones: undefined }).success).toBe(false);
    expect(
      rigCapabilitiesPayloadSchema.safeParse({ ...caps, firmwareVersion: undefined }).success
    ).toBe(false);
  });
});

describe("rigResponseSchema", () => {
  it("fills defaults for lax firmware messages", () => {
    const parsed = rigResponseSchema.parse({ id: "cmd_1", type: "result" });
    expect(parsed.status).toBe("ok");
    expect(parsed.timestamp).toBe(0);
    expect(parsed.payload).toEqual({});
  });
});
