/**
 * JSON-over-serial protocol between the bridge and the ESP32 firmware.
 *
 * Framing: newline-delimited JSON (one object per line, UTF-8, LF terminated).
 * Every outbound command carries a unique `id`; the firmware echoes the id on
 * its ack/result/error. Unsolicited firmware messages use type "event".
 *
 * This file is the single source of truth for command names, error codes and
 * message construction on the bridge side. The firmware mirror lives in
 * firmware/src/protocol/RigProtocol.h and the docs in docs/protocol.md.
 */

import type { LightingZoneCommand } from "../types/rig.types.js";

export const RIG_COMMAND_TYPES = [
  "PING",
  "GET_INFO",
  "GET_CAPABILITIES",
  "GET_STATUS",
  "SET_PROFILE",
  "SET_ZONE",
  "SET_ALL_OFF",
  "RUN_TEST_PATTERN",
  "SET_BRIGHTNESS",
  "SAVE_CONFIG",
  "LOAD_CONFIG",
  "RESET_CONTROLLER",
  "START_HEARTBEAT",
  "STOP_HEARTBEAT",
] as const;
export type RigCommandType = (typeof RIG_COMMAND_TYPES)[number];

export const RIG_EVENT_TYPES = [
  "READY",
  "STATUS_CHANGED",
  "LIGHTS_UPDATED",
  "ERROR",
  "WATCHDOG_TIMEOUT",
  "HEARTBEAT",
] as const;
export type RigEventType = (typeof RIG_EVENT_TYPES)[number];

export const RIG_ERROR_CODES = [
  "INVALID_JSON",
  "UNKNOWN_COMMAND",
  "INVALID_PAYLOAD",
  "UNKNOWN_ZONE",
  "ZONE_NOT_INSTALLED",
  "PROFILE_APPLY_FAILED",
  "BRIGHTNESS_OUT_OF_RANGE",
  "INTERNAL_ERROR",
  // Bridge-side synthetic errors (never emitted by firmware):
  "COMMAND_TIMEOUT",
  "NOT_CONNECTED",
  "WRITE_FAILED",
] as const;
export type RigErrorCode = (typeof RIG_ERROR_CODES)[number];

export interface RigCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: RigCommandType;
  /** ISO timestamp from the bridge's clock. Firmware ignores it. */
  timestamp: string;
  payload: TPayload;
}

export type RigResponseKind = "ack" | "result" | "error" | "event";

export interface RigResponse<TPayload = Record<string, unknown>> {
  /** Echo of the command id, or an event id like "evt_12" for events. */
  id: string;
  type: RigResponseKind | RigEventType;
  status: "ok" | "error";
  /** Firmware uptime in milliseconds (no wall clock on the ESP32). */
  timestamp: number;
  event?: RigEventType;
  payload: Record<string, unknown>;
}

export interface RigErrorPayload {
  code: RigErrorCode;
  message: string;
}

let commandCounter = 0;

/** Monotonic, human-scannable command ids: cmd_0001, cmd_0002, ... */
export function nextCommandId(): string {
  commandCounter += 1;
  return `cmd_${String(commandCounter).padStart(4, "0")}`;
}

export function buildCommand<TPayload extends Record<string, unknown>>(
  type: RigCommandType,
  payload: TPayload,
  id: string = nextCommandId()
): RigCommand<TPayload> {
  return { id, type, timestamp: new Date().toISOString(), payload };
}

// ---- Typed command builders ------------------------------------------------

export const RigCommands = {
  ping: () => buildCommand("PING", {}),
  getInfo: () => buildCommand("GET_INFO", {}),
  getCapabilities: () => buildCommand("GET_CAPABILITIES", {}),
  getStatus: () => buildCommand("GET_STATUS", {}),
  setProfile: (args: {
    profileId: string;
    globalBrightness: number;
    zones: LightingZoneCommand[];
    fadeMs?: number;
  }) => buildCommand("SET_PROFILE", { fadeMs: 0, ...args }),
  setZone: (zone: LightingZoneCommand & { fadeMs?: number }) =>
    buildCommand("SET_ZONE", { fadeMs: 0, ...zone }),
  allOff: () => buildCommand("SET_ALL_OFF", {}),
  runTestPattern: (args: { durationMs?: number } = {}) =>
    buildCommand("RUN_TEST_PATTERN", args),
  setBrightness: (globalBrightness: number) =>
    buildCommand("SET_BRIGHTNESS", { globalBrightness }),
  saveConfig: () => buildCommand("SAVE_CONFIG", {}),
  loadConfig: () => buildCommand("LOAD_CONFIG", {}),
  resetController: () => buildCommand("RESET_CONTROLLER", {}),
  startHeartbeat: (intervalMs = 1000) =>
    buildCommand("START_HEARTBEAT", { intervalMs }),
  stopHeartbeat: () => buildCommand("STOP_HEARTBEAT", {}),
};

// ---- Framing ---------------------------------------------------------------

/** Serialize a command to its wire form (JSON + trailing newline). */
export function encodeCommand(command: RigCommand<unknown>): string {
  return `${JSON.stringify(command)}\n`;
}

/**
 * Incremental line splitter for the serial byte stream. Feed it chunks; it
 * returns complete lines and buffers partials. Tolerates CRLF.
 */
export class LineBuffer {
  private buffer = "";
  constructor(private readonly maxLineLength = 16 * 1024) {}

  push(chunk: string | Buffer): string[] {
    this.buffer += chunk.toString("utf8");
    const lines: string[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "").trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0) lines.push(line);
    }
    if (this.buffer.length > this.maxLineLength) {
      // A runaway line means framing is broken (noise on the wire, wrong
      // baud rate). Drop it rather than grow unbounded.
      this.buffer = "";
      lines.push("__LINE_OVERFLOW__");
    }
    return lines;
  }

  reset(): void {
    this.buffer = "";
  }
}

export type ParsedRigMessage =
  | { kind: "response"; message: RigResponse }
  | { kind: "garbage"; raw: string; reason: string };

/**
 * Parse one line from the firmware. Never throws — firmware boot noise and
 * malformed lines are reported as "garbage" so callers can log and continue.
 */
export function parseRigLine(line: string): ParsedRigMessage {
  if (line === "__LINE_OVERFLOW__") {
    return { kind: "garbage", raw: "", reason: "line overflow (framing broken?)" };
  }
  if (!line.startsWith("{")) {
    return { kind: "garbage", raw: line, reason: "not a JSON object" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    return { kind: "garbage", raw: line, reason: `invalid JSON: ${String(err)}` };
  }
  const msg = parsed as Partial<RigResponse>;
  if (typeof msg.id !== "string" || typeof msg.type !== "string") {
    return { kind: "garbage", raw: line, reason: "missing id/type" };
  }
  return {
    kind: "response",
    message: {
      id: msg.id,
      type: msg.type as RigResponse["type"],
      status: msg.status === "error" ? "error" : "ok",
      timestamp: typeof msg.timestamp === "number" ? msg.timestamp : 0,
      event: msg.event as RigEventType | undefined,
      payload: (msg.payload ?? {}) as Record<string, unknown>,
    },
  };
}

/** True when a firmware message is an unsolicited event (vs a command reply). */
export function isEventMessage(message: RigResponse): boolean {
  return (
    message.type === "event" ||
    (RIG_EVENT_TYPES as readonly string[]).includes(message.type)
  );
}

/** Extract the event type from an event message. */
export function eventTypeOf(message: RigResponse): RigEventType | undefined {
  if (message.event && (RIG_EVENT_TYPES as readonly string[]).includes(message.event)) {
    return message.event;
  }
  if ((RIG_EVENT_TYPES as readonly string[]).includes(message.type)) {
    return message.type as RigEventType;
  }
  return undefined;
}
