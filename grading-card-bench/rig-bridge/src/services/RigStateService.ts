/**
 * RigStateService: the bridge's single owner of rig connection lifecycle and
 * lighting state. Everything the WebSocket server and HTTP routes do goes
 * through here, so there is exactly one place that knows:
 *  - whether we're connected and to which port
 *  - the rig's capabilities
 *  - which lighting profile is active
 *  - whether a capture session is in progress (safety decisions depend on it)
 */

import { EventEmitter } from "node:events";
import type { Logger } from "pino";
import {
  RigCommands,
  type RigResponse,
  type RigEventType,
} from "../protocol/RigProtocol.js";
import { rigCapabilitiesPayloadSchema } from "../protocol/schemas.js";
import { RigSerialClient, RigCommandError } from "../serial/RigSerialClient.js";
import { SerialPortManager } from "../serial/SerialPortManager.js";
import { RigCommandQueue } from "./RigCommandQueue.js";
import type {
  LightingZoneCommand,
  RigCapabilities,
  RigConnectionStatus,
  SerialPortInfo,
} from "../types/rig.types.js";
import type { BridgeConfig } from "../config.js";

export interface RigStateEvents {
  status: (status: RigConnectionStatus) => void;
  capabilities: (caps: RigCapabilities) => void;
  heartbeat: (payload: Record<string, unknown>) => void;
  rigEvent: (type: RigEventType, payload: Record<string, unknown>) => void;
  log: (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => void;
}

export class RigStateService extends EventEmitter {
  private client: RigSerialClient | null = null;
  private capabilities_: RigCapabilities | null = null;
  private status_: RigConnectionStatus = { connected: false, state: "disconnected" };
  private activeCaptureSessionId: string | null = null;
  private connecting = false;

  constructor(
    private readonly ports: SerialPortManager,
    private readonly queue: RigCommandQueue,
    private readonly config: BridgeConfig,
    private readonly log: Logger
  ) {
    super();
  }

  // ---- Introspection --------------------------------------------------------

  get status(): RigConnectionStatus {
    return { ...this.status_ };
  }

  get capabilities(): RigCapabilities | null {
    return this.capabilities_;
  }

  get connected(): boolean {
    return this.status_.connected && (this.client?.isOpen() ?? false);
  }

  get captureSessionActive(): boolean {
    return this.activeCaptureSessionId !== null;
  }

  setCaptureSessionActive(active: boolean, sessionId?: string): void {
    this.activeCaptureSessionId = active ? (sessionId ?? "unknown-session") : null;
    this.emitLog("info", active
      ? `Capture session active: ${this.activeCaptureSessionId}`
      : "Capture session ended");
  }

  listPorts(): Promise<SerialPortInfo[]> {
    return this.ports.listPorts();
  }

  // ---- Connection lifecycle ---------------------------------------------------

  async connect(portPath?: string): Promise<RigConnectionStatus> {
    if (this.connecting) throw new Error("Already connecting");
    if (this.connected) return this.status;

    this.connecting = true;
    this.patchStatus({ state: "connecting", error: undefined });
    try {
      const resolvedPath =
        portPath ??
        this.config.serial.portPath ??
        (await this.ports.autoDetectPort())?.path;
      if (!resolvedPath) {
        throw new Error("No serial ports found. Is the rig plugged in?");
      }

      const transport = await this.ports.createTransport(resolvedPath);
      await transport.open();

      const client = new RigSerialClient(transport, {
        commandTimeoutMs: this.config.command.timeoutMs,
      });
      this.client = client;
      client.on("event", (type: RigEventType, message: RigResponse) =>
        this.handleRigEvent(type, message)
      );
      client.on("garbage", (raw: string, reason: string) =>
        this.emitLog("debug", `Ignored serial line (${reason})`, { raw })
      );
      client.on("close", () => this.handleSerialClosed());
      client.on("error", (err: Error) => this.emitLog("error", `Serial error: ${err.message}`));

      this.queue.setSender((command) => client.send(command));

      // Give the ESP32 a moment to reboot (opening the port toggles DTR/RTS
      // on most dev boards) before the first command.
      await delay(300);

      const info = await this.commandWithRetry(() =>
        this.queue.enqueue(RigCommands.ping(), { priority: true })
      );
      this.emitLog("info", `Rig answered ping in ${info ? "time" : "?"} on ${resolvedPath}`);

      const caps = await this.refreshCapabilities();
      await this.queue.enqueue(RigCommands.startHeartbeat(this.config.heartbeat.intervalMs));
      // Known-safe starting state: everything off.
      await this.queue.enqueue(RigCommands.allOff());

      this.patchStatus({
        connected: true,
        state: "connected",
        portPath: resolvedPath,
        firmwareVersion: caps.firmwareVersion,
        board: caps.board,
        activeProfileId: "all_off",
        error: undefined,
      });
      return this.status;
    } catch (err) {
      await this.teardownClient();
      const message = err instanceof Error ? err.message : String(err);
      this.patchStatus({ connected: false, state: "error", error: message });
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // Best effort: leave the hardware dark before dropping the line.
      try {
        await this.queue.enqueueEmergency(RigCommands.allOff());
      } catch (err) {
        this.emitLog("warn", `All-off before disconnect failed: ${String(err)}`);
      }
    }
    await this.teardownClient();
    this.patchStatus({
      connected: false,
      state: "disconnected",
      portPath: undefined,
      activeProfileId: undefined,
      error: undefined,
    });
  }

  private async teardownClient(): Promise<void> {
    this.queue.setSender(null);
    const client = this.client;
    this.client = null;
    if (client) {
      client.removeAllListeners();
      await client.close().catch(() => undefined);
    }
  }

  private handleSerialClosed(): void {
    this.emitLog("warn", "Serial port closed unexpectedly — rig unavailable");
    this.queue.setSender(null);
    this.client = null;
    this.patchStatus({
      connected: false,
      state: "error",
      error: "Serial connection lost. Check the USB cable and reconnect.",
    });
  }

  // ---- Commands -----------------------------------------------------------------

  async ping(): Promise<RigResponse> {
    return this.queue.enqueue(RigCommands.ping(), { priority: true });
  }

  async getInfo(): Promise<Record<string, unknown>> {
    const res = await this.queue.enqueue(RigCommands.getInfo());
    return res.payload;
  }

  async getRigStatus(): Promise<Record<string, unknown>> {
    const res = await this.queue.enqueue(RigCommands.getStatus());
    return res.payload;
  }

  async refreshCapabilities(): Promise<RigCapabilities> {
    const res = await this.queue.enqueue(RigCommands.getCapabilities());
    const caps = rigCapabilitiesPayloadSchema.parse(res.payload);
    this.capabilities_ = caps;
    this.emit("capabilities", caps);
    return caps;
  }

  async setProfile(args: {
    profileId: string;
    globalBrightness: number;
    zones: LightingZoneCommand[];
    fadeMs?: number;
  }): Promise<RigResponse> {
    this.assertZonesInstalled(args.zones);
    const res = await this.queue.enqueue(RigCommands.setProfile(args), {
      coalesceKey: "lighting:profile",
    });
    this.patchStatus({ activeProfileId: args.profileId });
    return res;
  }

  async setZone(zone: LightingZoneCommand & { fadeMs?: number }): Promise<RigResponse> {
    this.assertZonesInstalled([zone]);
    const res = await this.queue.enqueue(RigCommands.setZone(zone), {
      coalesceKey: `lighting:zone:${zone.zoneId}`,
    });
    this.patchStatus({ activeProfileId: "custom" });
    return res;
  }

  async allOff(): Promise<RigResponse> {
    const res = await this.queue.enqueue(RigCommands.allOff());
    this.patchStatus({ activeProfileId: "all_off" });
    return res;
  }

  async runTestPattern(durationMs?: number): Promise<RigResponse> {
    return this.queue.enqueue(RigCommands.runTestPattern({ durationMs }));
  }

  /** Emergency stop: flush the queue and force lights off ahead of everything. */
  async emergencyStop(): Promise<void> {
    this.emitLog("warn", "EMERGENCY STOP triggered");
    try {
      await this.queue.enqueueEmergency(RigCommands.allOff());
      this.patchStatus({ activeProfileId: "all_off" });
    } catch (err) {
      // Even the emergency all-off failed — surface loudly.
      const message = `Emergency all-off FAILED: ${String(err)}. Cut rig power manually.`;
      this.emitLog("error", message);
      this.patchStatus({ error: message });
      throw err;
    }
  }

  /** Best-effort all-off used by shutdown hooks and safety timers. */
  async safeAllOff(reason: string): Promise<void> {
    if (!this.connected) return;
    this.emitLog("info", `Turning all lights off (${reason})`);
    try {
      await this.queue.enqueueEmergency(RigCommands.allOff());
      this.patchStatus({ activeProfileId: "all_off" });
    } catch (err) {
      this.emitLog("error", `Safety all-off failed: ${String(err)}`);
    }
  }

  markHeartbeatStale(stale: boolean): void {
    if (this.status_.heartbeatStale !== stale) {
      this.patchStatus({ heartbeatStale: stale });
      if (stale) this.emitLog("warn", "Rig heartbeat is stale — connection may be dead");
    }
  }

  // ---- Internals ---------------------------------------------------------------

  private assertZonesInstalled(zones: LightingZoneCommand[]): void {
    const caps = this.capabilities_;
    if (!caps) return; // firmware will validate anyway
    for (const z of zones) {
      const zone = caps.zones.find((c) => c.zoneId === z.zoneId);
      if (!zone) {
        throw new RigCommandError("UNKNOWN_ZONE", `Zone ${z.zoneId} does not exist on this rig`);
      }
      if (!zone.installed && z.enabled) {
        throw new RigCommandError(
          "ZONE_NOT_INSTALLED",
          `Zone ${z.zoneId} is not installed on this rig`
        );
      }
    }
  }

  private async commandWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        this.emitLog("debug", `Command attempt ${i + 1}/${attempts} failed: ${String(err)}`);
        await delay(250 * (i + 1));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private handleRigEvent(type: RigEventType, message: RigResponse): void {
    switch (type) {
      case "HEARTBEAT":
        this.patchStatus(
          { lastHeartbeatAt: new Date().toISOString(), heartbeatStale: false },
          /* silent */ true
        );
        this.emit("heartbeat", message.payload);
        break;
      case "READY":
        this.emitLog("info", "Rig reported READY", message.payload);
        this.emit("rigEvent", type, message.payload);
        break;
      case "WATCHDOG_TIMEOUT":
        this.emitLog("warn", "Rig watchdog fired — firmware turned lights off", message.payload);
        this.patchStatus({ activeProfileId: "all_off" });
        this.emit("rigEvent", type, message.payload);
        break;
      case "ERROR":
        this.emitLog("error", "Rig reported error event", message.payload);
        this.emit("rigEvent", type, message.payload);
        break;
      default:
        this.emit("rigEvent", type, message.payload);
    }
  }

  private patchStatus(patch: Partial<RigConnectionStatus>, silent = false): void {
    this.status_ = { ...this.status_, ...patch };
    if (!silent) this.emit("status", this.status);
  }

  private emitLog(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: unknown
  ): void {
    this.log[level]({ data }, message);
    this.emit("log", level, message, data);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
