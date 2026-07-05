/**
 * rigClient — the web app's connection to the photo rig.
 *
 * Two transports implement the same RigClient interface:
 *
 *  1. BridgeRigClient (production): WebSocket to the local Rig Bridge Service,
 *     which owns the serial port. Fully implemented.
 *  2. WebSerialRigClient (fallback): direct Web Serial from Chrome/Edge with
 *     no bridge process. Scaffolded with the same protocol layer; see TODOs.
 *
 * The rest of the app (hooks, capture engine) only sees RigClient.
 */

import type {
  LightingProfile,
  LightingZoneCommand,
  RigCapabilities,
  RigState,
  SerialPortInfo,
  ZoneState,
} from "./rig.types";
import { RigError } from "./rig.types";
import { LIGHTING_PROFILES, adaptProfileToCapabilities, getLightingProfile } from "../capture/lightingProfiles";
import type { AppliedLighting, RigController } from "../capture/captureSequenceEngine";

export type RigClientListener = (state: RigState) => void;

export interface RigClient extends RigController {
  getState(): RigState;
  subscribe(listener: RigClientListener): () => void;
  connectBridge(): Promise<void>;
  connectRig(portPath?: string): Promise<void>;
  disconnectRig(): Promise<void>;
  listPorts(): Promise<SerialPortInfo[]>;
  ping(): Promise<void>;
  refreshStatus(): Promise<void>;
  setZone(zone: LightingZoneCommand, fadeMs?: number): Promise<void>;
  runTestPattern(durationMs?: number): Promise<void>;
  emergencyStop(): Promise<void>;
}

const INITIAL_STATE: RigState = {
  connected: false,
  connecting: false,
  bridgeReachable: false,
  zones: {},
  logs: [],
};

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Production client: talks to the Rig Bridge Service over WebSocket.
 */
export class BridgeRigClient implements RigClient {
  private ws: WebSocket | null = null;
  private state: RigState = { ...INITIAL_STATE };
  private listeners = new Set<RigClientListener>();
  private pending = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly options: {
      url?: string;
      requestTimeoutMs?: number;
    } = {}
  ) {}

  private get url(): string {
    return this.options.url ?? "ws://localhost:8787/rig";
  }

  // ---- State observation -----------------------------------------------------

  getState(): RigState {
    return this.state;
  }

  subscribe(listener: RigClientListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private patch(patch: Partial<RigState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  private appendLog(level: RigState["logs"][number]["level"], message: string): void {
    const logs = [...this.state.logs, { level, message, at: new Date().toISOString() }];
    this.patch({ logs: logs.slice(-200) });
  }

  // ---- Bridge connection ------------------------------------------------------

  async connectBridge(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      const failTimer = setTimeout(
        () => reject(new RigError("BRIDGE_UNREACHABLE", "Rig Bridge did not respond",
          "Start the Rig Bridge Service (npm run dev in rig-bridge/) and try again.")),
        4000
      );
      ws.onopen = () => {
        clearTimeout(failTimer);
        this.ws = ws;
        this.patch({ bridgeReachable: true, error: undefined });
        this.appendLog("info", "Connected to Rig Bridge");
        resolve();
      };
      ws.onmessage = (event) => this.handleServerMessage(String(event.data));
      ws.onclose = () => {
        clearTimeout(failTimer);
        this.ws = null;
        this.pending.forEach((p) => p.reject(new RigError("BRIDGE_LOST", "Bridge connection closed")));
        this.pending.clear();
        this.patch({ bridgeReachable: false, connected: false });
        this.appendLog("warn", "Lost connection to Rig Bridge; retrying in 3s");
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        clearTimeout(failTimer);
        reject(
          new RigError(
            "BRIDGE_UNREACHABLE",
            `Could not reach Rig Bridge at ${this.url}`,
            "Start the Rig Bridge Service (rig-bridge: npm run dev) and refresh."
          )
        );
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectBridge().catch(() => this.scheduleReconnect());
    }, 3000);
  }

  private handleServerMessage(raw: string): void {
    let msg: { type: string; requestId?: string; payload: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Resolve a pending request if this is its reply.
    if (msg.requestId) {
      const pending = this.pending.get(msg.requestId);
      if (pending) {
        this.pending.delete(msg.requestId);
        clearTimeout(pending.timer);
        if (msg.type === "rig:error") {
          const p = msg.payload as { message?: string; code?: string };
          pending.reject(new RigError(p.code ?? "RIG_ERROR", p.message ?? "Rig command failed"));
        } else {
          pending.resolve(msg.payload);
        }
        // fall through: status-type payloads should still update state below
      }
    }

    switch (msg.type) {
      case "rig:status":
      case "rig:connected":
      case "rig:disconnected": {
        const s = msg.payload as Partial<RigState> & { state?: string };
        this.patch({
          connected: Boolean(s.connected),
          connecting: s.state === "connecting",
          portPath: s.portPath,
          firmwareVersion: s.firmwareVersion,
          board: s.board,
          activeProfileId: s.activeProfileId,
          lastHeartbeatAt: s.lastHeartbeatAt,
          heartbeatStale: s.heartbeatStale,
          error: s.error,
        });
        break;
      }
      case "rig:capabilities":
        this.patch({ capabilities: msg.payload as RigCapabilities });
        break;
      case "rig:heartbeat":
        this.patch({ lastHeartbeatAt: new Date().toISOString(), heartbeatStale: false });
        break;
      case "rig:profile-applied": {
        const p = msg.payload as { profileId: string };
        this.patch({ activeProfileId: p.profileId, zones: this.zonesForProfile(p.profileId) });
        break;
      }
      case "rig:error": {
        const p = msg.payload as { message?: string };
        if (!msg.requestId) this.appendLog("error", p.message ?? "Rig error");
        break;
      }
      case "rig:log": {
        const p = msg.payload as { level?: RigState["logs"][number]["level"]; message?: string };
        this.appendLog(p.level ?? "info", p.message ?? "");
        break;
      }
    }
  }

  private zonesForProfile(profileId: string): Record<string, ZoneState> {
    const profile = getLightingProfile(profileId);
    const zones: Record<string, ZoneState> = {};
    if (profile) {
      for (const z of profile.zones) zones[z.zoneId] = { ...z };
    }
    return zones;
  }

  // ---- Request/response over WS ------------------------------------------------

  private request<T = unknown>(message: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new RigError("BRIDGE_UNREACHABLE", "Not connected to the Rig Bridge",
          "Start the Rig Bridge Service and reconnect.")
      );
    }
    const requestId = `req_${++this.requestCounter}`;
    const timeout = timeoutMs ?? this.options.requestTimeoutMs ?? 8000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new RigError("REQUEST_TIMEOUT", `Bridge request timed out: ${String(message.type)}`,
          "The rig did not respond. Check USB connection and try reconnecting."));
      }, timeout);
      this.pending.set(requestId, { resolve: resolve as (p: unknown) => void, reject, timer });
      ws.send(JSON.stringify({ ...message, requestId }));
    });
  }

  // ---- RigClient API -------------------------------------------------------------

  isConnected(): boolean {
    return this.state.connected;
  }

  async ensureConnected(): Promise<void> {
    await this.connectBridge();
    if (!this.state.connected) {
      await this.connectRig();
    }
  }

  async connectRig(portPath?: string): Promise<void> {
    await this.connectBridge();
    this.patch({ connecting: true, error: undefined });
    try {
      await this.request({ type: "rig:connect", portPath }, 15000);
    } finally {
      this.patch({ connecting: false });
    }
  }

  async disconnectRig(): Promise<void> {
    await this.request({ type: "rig:disconnect" });
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    await this.connectBridge();
    return this.request<SerialPortInfo[]>({ type: "rig:list-ports" });
  }

  async ping(): Promise<void> {
    await this.request({ type: "rig:ping" });
  }

  async refreshStatus(): Promise<void> {
    await this.request({ type: "rig:get-status" });
  }

  async applyLightingProfile(profileId: string): Promise<AppliedLighting> {
    const profile = getLightingProfile(profileId);
    if (!profile) throw new RigError("UNKNOWN_PROFILE", `Unknown lighting profile ${profileId}`);

    // Filter to installed zones so partial rigs still work.
    const installed = new Set(
      (this.state.capabilities?.zones ?? [])
        .filter((z) => z.installed)
        .map((z) => z.zoneId)
    );
    const { profile: adapted, droppedZoneIds } =
      installed.size > 0
        ? adaptProfileToCapabilities(profile, installed)
        : { profile, droppedZoneIds: [] };
    if (droppedZoneIds.length > 0) {
      this.appendLog(
        "warn",
        `Profile ${profileId}: zones not installed on this rig were skipped: ${droppedZoneIds.join(", ")}`
      );
    }

    await this.request({
      type: "rig:set-profile",
      profile: {
        profileId: adapted.id,
        globalBrightness: adapted.globalBrightness,
        zones: adapted.zones,
        fadeMs: 80,
      },
    });
    this.patch({ activeProfileId: profileId, zones: this.zonesForProfile(profileId) });
    return {
      profile,
      appliedZones: adapted.zones,
      droppedZoneIds,
      firmwareVersion: this.state.firmwareVersion,
      board: this.state.board,
    };
  }

  async setZone(zone: LightingZoneCommand, fadeMs = 0): Promise<void> {
    await this.request({ type: "rig:set-zone", zone: { ...zone, fadeMs } });
    this.patch({
      activeProfileId: "custom",
      zones: { ...this.state.zones, [zone.zoneId]: { ...zone } },
    });
  }

  async allOff(): Promise<void> {
    await this.request({ type: "rig:all-off" });
    this.patch({ activeProfileId: "all_off", zones: {} });
  }

  async runTestPattern(durationMs = 5000): Promise<void> {
    await this.request({ type: "rig:test-pattern", durationMs });
  }

  async emergencyStop(): Promise<void> {
    await this.request({ type: "rig:emergency-stop" });
    this.patch({ activeProfileId: "all_off", zones: {} });
  }

  async setCaptureSessionActive(active: boolean, sessionId?: string): Promise<void> {
    await this.request({ type: "rig:capture-session", active, sessionId });
  }
}

/**
 * WebSerialRigClient — direct browser->ESP32 connection using the Web Serial
 * API (Chrome/Edge, HTTPS or localhost). Useful when running the bench with
 * no bridge process.
 *
 * TODO(web-serial): implement using the same newline-JSON protocol:
 *   - navigator.serial.requestPort() in connectRig() (must be a user gesture)
 *   - port.open({ baudRate: 115200 })
 *   - pipe reader through a line splitter identical to the bridge's
 *     LineBuffer, match replies by command id with timeouts
 *   - reuse the exact payload shapes from docs/protocol.md
 * The class exists so the UI can offer the option and so the interface stays
 * honest about supporting both transports.
 */
export class WebSerialRigClient {
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }
  // Intentionally not implementing RigClient yet — construction throws to
  // prevent accidental use until the TODO above is done.
  constructor() {
    throw new RigError(
      "NOT_IMPLEMENTED",
      "Web Serial transport is scaffolded but not implemented; use the Rig Bridge Service.",
      "Run the Rig Bridge Service (rig-bridge: npm run dev)."
    );
  }
}

/** Singleton used by the app; tests construct their own clients. */
export const rigClient: RigClient = new BridgeRigClient({
  url: (import.meta as { env?: Record<string, string> }).env?.VITE_RIG_BRIDGE_WS ?? undefined,
});

export { LIGHTING_PROFILES };
