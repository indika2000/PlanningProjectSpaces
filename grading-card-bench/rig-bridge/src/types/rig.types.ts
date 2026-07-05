/**
 * Core rig domain types shared across the bridge.
 *
 * These mirror the types used by the web app (web/src/features/rig/rig.types.ts).
 * The serial protocol wire shapes live in ../protocol/schemas.ts; these are the
 * app-friendly, normalized representations.
 */

/** Well-known LED zone identifiers. Rigs may install any subset of these. */
export const KNOWN_ZONE_IDS = [
  "ZONE_TOP_DIFFUSE",
  "ZONE_BOTTOM_DIFFUSE",
  "ZONE_LEFT_DIFFUSE",
  "ZONE_RIGHT_DIFFUSE",
  "ZONE_FRONT_FILL",
  "ZONE_BACK_FILL",
  "ZONE_LEFT_RAKING",
  "ZONE_RIGHT_RAKING",
  "ZONE_TOP_RAKING",
  "ZONE_BOTTOM_RAKING",
  "ZONE_EDGE_LEFT",
  "ZONE_EDGE_RIGHT",
  "ZONE_EDGE_TOP",
  "ZONE_EDGE_BOTTOM",
  "ZONE_SURFACE_GLARE",
  "ZONE_CALIBRATION_WHITE",
] as const;

export type KnownZoneId = (typeof KNOWN_ZONE_IDS)[number];
/** Zone ids are open-ended strings so future rig revisions can add zones. */
export type ZoneId = string;

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface LightingZoneCommand {
  zoneId: ZoneId;
  enabled: boolean;
  rgb: RgbColor;
  /** 0-100 zone-relative brightness (scaled by globalBrightness). */
  brightness: number;
}

export interface LightingProfile {
  id: string;
  name: string;
  description: string;
  zones: LightingZoneCommand[];
  /** 0-100 overall brightness scaler. */
  globalBrightness: number;
  colorTemperatureHint?: number;
  purpose: string[];
}

export interface RigZoneCapability {
  zoneId: ZoneId;
  name: string;
  startPixel: number;
  pixelCount: number;
  installed: boolean;
}

export interface RigCapabilities {
  firmwareVersion: string;
  board: string;
  ledType: string;
  maxBrightness: number;
  zones: RigZoneCapability[];
  supportsFade: boolean;
  supportsProfiles: boolean;
  supportsSavedConfig: boolean;
}

export interface RigInfo {
  firmwareVersion: string;
  board: string;
  controllerId?: string;
  uptimeMs?: number;
}

export type RigLifecycleState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface RigConnectionStatus {
  connected: boolean;
  state: RigLifecycleState;
  portPath?: string;
  firmwareVersion?: string;
  board?: string;
  activeProfileId?: string;
  lastHeartbeatAt?: string;
  heartbeatStale?: boolean;
  error?: string;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  /** Heuristic: looks like an ESP32 dev board USB-UART chip. */
  likelyRig: boolean;
}

/** Bridge -> web app log line for the diagnostics console. */
export interface RigLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  at: string;
  data?: unknown;
}
