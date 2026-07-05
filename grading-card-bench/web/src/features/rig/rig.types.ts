/**
 * Rig domain types (web side). Mirrors rig-bridge/src/types/rig.types.ts —
 * keep the two in sync when the protocol evolves (see docs/protocol.md).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LightingZoneCommand {
  zoneId: string;
  enabled: boolean;
  rgb: RgbColor;
  /** 0-100, scaled by the profile's globalBrightness. */
  brightness: number;
}

export interface LightingProfile {
  id: string;
  name: string;
  description: string;
  zones: LightingZoneCommand[];
  globalBrightness: number;
  colorTemperatureHint?: number;
  purpose: string[];
}

export interface RigZoneCapability {
  zoneId: string;
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

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  likelyRig: boolean;
}

export interface ZoneState {
  zoneId: string;
  enabled: boolean;
  rgb: RgbColor;
  brightness: number;
}

export interface RigState {
  connected: boolean;
  connecting: boolean;
  bridgeReachable: boolean;
  portPath?: string;
  firmwareVersion?: string;
  board?: string;
  capabilities?: RigCapabilities;
  activeProfileId?: string;
  zones: Record<string, ZoneState>;
  lastHeartbeatAt?: string;
  heartbeatStale?: boolean;
  error?: string;
  logs: RigLogEntry[];
}

export interface RigLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  at: string;
}

export interface RigImageMetadata {
  firmwareVersion?: string;
  controllerBoard?: string;
  activeProfileId: string;
  zones: LightingZoneCommand[];
  globalBrightness: number;
  settleTimeMs: number;
}

/** Errors surfaced by rig operations, with operator-friendly messaging. */
export class RigError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly operatorHint?: string
  ) {
    super(message);
    this.name = "RigError";
  }
}
