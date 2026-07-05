/**
 * In-process simulation of the ESP32 firmware, used for:
 *  - developing the web app with no hardware attached (`npm run dev:mock`)
 *  - unit/integration tests of the bridge
 *
 * It implements the same JSON-over-serial protocol as firmware/src, including
 * heartbeats, capability discovery, zone state and error responses, so the
 * full capture workflow can be exercised end-to-end on a laptop.
 */

import type { SerialTransport } from "./SerialTransport.js";

interface MockZone {
  zoneId: string;
  name: string;
  startPixel: number;
  pixelCount: number;
  installed: boolean;
  enabled: boolean;
  rgb: { r: number; g: number; b: number };
  brightness: number;
}

const MOCK_ZONES: Array<[string, string, number, number, boolean]> = [
  ["ZONE_TOP_DIFFUSE", "Top Diffuse", 0, 20, true],
  ["ZONE_BOTTOM_DIFFUSE", "Bottom Diffuse", 20, 20, true],
  ["ZONE_LEFT_DIFFUSE", "Left Diffuse", 40, 20, true],
  ["ZONE_RIGHT_DIFFUSE", "Right Diffuse", 60, 20, true],
  ["ZONE_FRONT_FILL", "Front Fill", 80, 10, true],
  ["ZONE_LEFT_RAKING", "Left Raking", 90, 10, true],
  ["ZONE_RIGHT_RAKING", "Right Raking", 100, 10, true],
  ["ZONE_TOP_RAKING", "Top Raking", 110, 10, true],
  ["ZONE_BOTTOM_RAKING", "Bottom Raking", 120, 10, true],
  ["ZONE_SURFACE_GLARE", "Surface Glare", 130, 15, true],
  ["ZONE_CALIBRATION_WHITE", "Calibration White", 145, 15, true],
  ["ZONE_EDGE_LEFT", "Edge Left", 160, 8, false], // not installed on the mock rig
];

export class MockRigTransport implements SerialTransport {
  private open_ = false;
  private dataListeners: Array<(chunk: Buffer) => void> = [];
  private closeListeners: Array<(err?: Error) => void> = [];
  private errorListeners: Array<(err: Error) => void> = [];
  private inbound = "";
  private bootedAt = Date.now();
  private zones: MockZone[];
  private globalBrightness = 0;
  private activeProfileId = "all_off";
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventCounter = 0;

  /** Test hooks. */
  public dropNextResponses = 0;
  public respondWithGarbageOnce = false;
  public responseDelayMs = 5;

  constructor(public readonly path: string = "mock://esp32") {
    this.zones = MOCK_ZONES.map(([zoneId, name, startPixel, pixelCount, installed]) => ({
      zoneId,
      name,
      startPixel,
      pixelCount,
      installed,
      enabled: false,
      rgb: { r: 0, g: 0, b: 0 },
      brightness: 0,
    }));
  }

  async open(): Promise<void> {
    this.open_ = true;
    this.bootedAt = Date.now();
    // Firmware emits READY shortly after boot; simulate boot-loader noise first.
    setTimeout(() => {
      this.emitRaw("ets Jul 29 2019 12:21:46 (mock boot noise)\n");
      this.emitEvent("READY", {
        firmwareVersion: "0.1.0-mock",
        board: "MOCK-ESP32-S3",
      });
    }, 20);
  }

  async close(): Promise<void> {
    this.open_ = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    for (const l of this.closeListeners) l();
  }

  isOpen(): boolean {
    return this.open_;
  }

  async write(data: string): Promise<void> {
    if (!this.open_) throw new Error("mock transport not open");
    this.inbound += data;
    let idx: number;
    while ((idx = this.inbound.indexOf("\n")) >= 0) {
      const line = this.inbound.slice(0, idx).trim();
      this.inbound = this.inbound.slice(idx + 1);
      if (line) this.handleLine(line);
    }
  }

  onData(listener: (chunk: Buffer) => void): void {
    this.dataListeners.push(listener);
  }
  onClose(listener: (err?: Error) => void): void {
    this.closeListeners.push(listener);
  }
  onError(listener: (err: Error) => void): void {
    this.errorListeners.push(listener);
  }

  // ---- Simulated firmware behavior ----------------------------------------

  private uptime(): number {
    return Date.now() - this.bootedAt;
  }

  private emitRaw(text: string): void {
    if (!this.open_) return;
    const buf = Buffer.from(text, "utf8");
    // Deliver in two chunks to exercise the bridge's line reassembly.
    const mid = Math.floor(buf.length / 2);
    setTimeout(() => {
      for (const l of this.dataListeners) l(buf.subarray(0, mid));
      for (const l of this.dataListeners) l(buf.subarray(mid));
    }, this.responseDelayMs);
  }

  private emitJson(obj: Record<string, unknown>): void {
    this.emitRaw(`${JSON.stringify(obj)}\n`);
  }

  private emitEvent(event: string, payload: Record<string, unknown>): void {
    this.eventCounter += 1;
    this.emitJson({
      id: `evt_${this.eventCounter}`,
      type: "event",
      event,
      status: "ok",
      timestamp: this.uptime(),
      payload,
    });
  }

  private reply(id: string, payload: Record<string, unknown>, type = "result"): void {
    if (this.dropNextResponses > 0) {
      this.dropNextResponses -= 1;
      return;
    }
    if (this.respondWithGarbageOnce) {
      this.respondWithGarbageOnce = false;
      this.emitRaw("!!not-json!!\n");
      return;
    }
    this.emitJson({ id, type, status: "ok", timestamp: this.uptime(), payload });
  }

  private replyError(id: string, code: string, message: string): void {
    this.emitJson({
      id,
      type: "error",
      status: "error",
      timestamp: this.uptime(),
      payload: { code, message },
    });
  }

  private capabilities(): Record<string, unknown> {
    return {
      firmwareVersion: "0.1.0-mock",
      board: "MOCK-ESP32-S3",
      ledType: "WS2812B",
      maxBrightness: 255,
      zones: this.zones.map(({ zoneId, name, startPixel, pixelCount, installed }) => ({
        zoneId,
        name,
        startPixel,
        pixelCount,
        installed,
      })),
      supportsFade: true,
      supportsProfiles: true,
      supportsSavedConfig: false,
    };
  }

  private handleLine(line: string): void {
    let cmd: { id?: string; type?: string; payload?: Record<string, unknown> };
    try {
      cmd = JSON.parse(line);
    } catch {
      this.replyError("unknown", "INVALID_JSON", "Could not parse command JSON");
      return;
    }
    const id = cmd.id ?? "unknown";
    const payload = cmd.payload ?? {};

    switch (cmd.type) {
      case "PING":
        this.reply(id, { pong: true, uptimeMs: this.uptime() });
        return;
      case "GET_INFO":
        this.reply(id, {
          firmwareVersion: "0.1.0-mock",
          board: "MOCK-ESP32-S3",
          controllerId: "mock-rig-001",
          uptimeMs: this.uptime(),
        });
        return;
      case "GET_CAPABILITIES":
        this.reply(id, this.capabilities());
        return;
      case "GET_STATUS":
        this.reply(id, {
          activeProfileId: this.activeProfileId,
          globalBrightness: this.globalBrightness,
          zones: this.zones
            .filter((z) => z.installed)
            .map(({ zoneId, enabled, rgb, brightness }) => ({ zoneId, enabled, rgb, brightness })),
          uptimeMs: this.uptime(),
        });
        return;
      case "SET_PROFILE": {
        const zones = payload.zones as Array<Record<string, unknown>> | undefined;
        const profileId = payload.profileId as string | undefined;
        if (!profileId || !Array.isArray(zones)) {
          this.replyError(id, "INVALID_PAYLOAD", "SET_PROFILE requires profileId and zones[]");
          return;
        }
        for (const z of this.zones) {
          z.enabled = false;
          z.brightness = 0;
        }
        for (const zc of zones) {
          const zone = this.zones.find((z) => z.zoneId === zc.zoneId);
          if (!zone) {
            this.replyError(id, "UNKNOWN_ZONE", `Zone ID ${String(zc.zoneId)} does not exist`);
            return;
          }
          if (!zone.installed) {
            this.replyError(id, "ZONE_NOT_INSTALLED", `Zone ${zone.zoneId} is not installed`);
            return;
          }
          zone.enabled = Boolean(zc.enabled);
          zone.rgb = (zc.rgb as MockZone["rgb"]) ?? { r: 0, g: 0, b: 0 };
          zone.brightness = Number(zc.brightness ?? 0);
        }
        this.globalBrightness = Number(payload.globalBrightness ?? 100);
        this.activeProfileId = profileId;
        this.reply(id, { profileApplied: true, activeProfileId: profileId });
        this.emitEvent("LIGHTS_UPDATED", { activeProfileId: profileId });
        return;
      }
      case "SET_ZONE": {
        const zone = this.zones.find((z) => z.zoneId === payload.zoneId);
        if (!zone) {
          this.replyError(id, "UNKNOWN_ZONE", `Zone ID ${String(payload.zoneId)} does not exist`);
          return;
        }
        if (!zone.installed) {
          this.replyError(id, "ZONE_NOT_INSTALLED", `Zone ${zone.zoneId} is not installed`);
          return;
        }
        const brightness = Number(payload.brightness ?? 0);
        if (brightness < 0 || brightness > 100) {
          this.replyError(id, "BRIGHTNESS_OUT_OF_RANGE", "brightness must be 0-100");
          return;
        }
        zone.enabled = Boolean(payload.enabled);
        zone.rgb = (payload.rgb as MockZone["rgb"]) ?? zone.rgb;
        zone.brightness = brightness;
        this.activeProfileId = "custom";
        this.reply(id, { zoneApplied: true, zoneId: zone.zoneId });
        return;
      }
      case "SET_ALL_OFF":
        for (const z of this.zones) {
          z.enabled = false;
          z.brightness = 0;
        }
        this.activeProfileId = "all_off";
        this.globalBrightness = 0;
        this.reply(id, { allOff: true });
        this.emitEvent("LIGHTS_UPDATED", { activeProfileId: "all_off" });
        return;
      case "RUN_TEST_PATTERN":
        this.reply(id, { testPatternStarted: true, durationMs: payload.durationMs ?? 5000 });
        return;
      case "SET_BRIGHTNESS": {
        const value = Number(payload.globalBrightness);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          this.replyError(id, "BRIGHTNESS_OUT_OF_RANGE", "globalBrightness must be 0-100");
          return;
        }
        this.globalBrightness = value;
        this.reply(id, { globalBrightness: value });
        return;
      }
      case "START_HEARTBEAT": {
        const intervalMs = Math.max(250, Number(payload.intervalMs ?? 1000));
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          this.emitEvent("HEARTBEAT", {
            uptimeMs: this.uptime(),
            activeProfileId: this.activeProfileId,
            freeHeap: 200_000,
          });
        }, intervalMs);
        this.reply(id, { heartbeatStarted: true, intervalMs });
        return;
      }
      case "STOP_HEARTBEAT":
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.reply(id, { heartbeatStopped: true });
        return;
      case "RESET_CONTROLLER":
        this.reply(id, { resetting: true });
        setTimeout(() => this.emitEvent("READY", { firmwareVersion: "0.1.0-mock" }), 50);
        return;
      case "SAVE_CONFIG":
      case "LOAD_CONFIG":
        this.replyError(id, "UNKNOWN_COMMAND", `${cmd.type} not supported by mock rig`);
        return;
      default:
        this.replyError(id, "UNKNOWN_COMMAND", `Unknown command type ${String(cmd.type)}`);
    }
  }
}
