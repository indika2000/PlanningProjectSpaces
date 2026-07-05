/**
 * Runtime validation (zod) for everything that crosses a trust boundary:
 *  - messages arriving from the ESP32 over serial
 *  - messages arriving from web-app clients over WebSocket
 *
 * The firmware is embedded C++ and the web app is a separate codebase, so the
 * bridge never assumes either sends well-formed data.
 */

import { z } from "zod";

// ---- Shared primitives -------------------------------------------------------

export const rgbSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const zoneCommandSchema = z.object({
  zoneId: z.string().min(1).max(64),
  enabled: z.boolean(),
  rgb: rgbSchema,
  brightness: z.number().min(0).max(100),
});

export const lightingProfilePayloadSchema = z.object({
  profileId: z.string().min(1).max(64),
  globalBrightness: z.number().min(0).max(100),
  zones: z.array(zoneCommandSchema).max(64),
  fadeMs: z.number().int().min(0).max(5000).optional().default(0),
});

// ---- ESP32 -> bridge messages -------------------------------------------------

export const rigResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["ok", "error"]).optional().default("ok"),
  timestamp: z.number().optional().default(0),
  event: z.string().optional(),
  payload: z.record(z.unknown()).optional().default({}),
});

export const rigCapabilitiesPayloadSchema = z.object({
  firmwareVersion: z.string(),
  board: z.string(),
  ledType: z.string(),
  maxBrightness: z.number(),
  zones: z.array(
    z.object({
      zoneId: z.string(),
      name: z.string(),
      startPixel: z.number(),
      pixelCount: z.number(),
      installed: z.boolean(),
    })
  ),
  supportsFade: z.boolean(),
  supportsProfiles: z.boolean(),
  supportsSavedConfig: z.boolean(),
});

export const rigErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// ---- Web app -> bridge WebSocket messages --------------------------------------

const wsBase = { requestId: z.string().max(64).optional() };

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...wsBase, type: z.literal("rig:connect"), portPath: z.string().optional() }),
  z.object({ ...wsBase, type: z.literal("rig:disconnect") }),
  z.object({ ...wsBase, type: z.literal("rig:ping") }),
  z.object({ ...wsBase, type: z.literal("rig:get-info") }),
  z.object({ ...wsBase, type: z.literal("rig:get-capabilities") }),
  z.object({ ...wsBase, type: z.literal("rig:get-status") }),
  z.object({
    ...wsBase,
    type: z.literal("rig:set-profile"),
    profile: lightingProfilePayloadSchema,
  }),
  z.object({
    ...wsBase,
    type: z.literal("rig:set-zone"),
    zone: zoneCommandSchema.extend({ fadeMs: z.number().int().min(0).max(5000).optional() }),
  }),
  z.object({ ...wsBase, type: z.literal("rig:all-off") }),
  z.object({
    ...wsBase,
    type: z.literal("rig:test-pattern"),
    durationMs: z.number().int().min(500).max(60_000).optional(),
  }),
  z.object({ ...wsBase, type: z.literal("rig:emergency-stop") }),
  z.object({ ...wsBase, type: z.literal("rig:list-ports") }),
  z.object({
    ...wsBase,
    type: z.literal("rig:capture-session"),
    active: z.boolean(),
    sessionId: z.string().max(128).optional(),
  }),
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

/** Bridge -> web app event names (documented; payloads are plain objects). */
export const WS_SERVER_EVENTS = [
  "rig:connected",
  "rig:disconnected",
  "rig:status",
  "rig:capabilities",
  "rig:profile-applied",
  "rig:zone-updated",
  "rig:ports",
  "rig:error",
  "rig:heartbeat",
  "rig:log",
  "rig:ack",
] as const;
export type WsServerEventType = (typeof WS_SERVER_EVENTS)[number];

export interface WsServerMessage {
  type: WsServerEventType;
  requestId?: string;
  payload: unknown;
  at: string;
}
