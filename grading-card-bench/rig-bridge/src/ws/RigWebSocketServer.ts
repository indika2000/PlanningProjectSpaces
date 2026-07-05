/**
 * WebSocket API for the web app.
 *
 * Client -> bridge messages are validated with zod (schemas.ts) and mapped to
 * RigStateService actions. Bridge -> client events broadcast rig status,
 * capabilities, heartbeats, errors and logs to every connected UI.
 *
 * Safety: when the LAST client disconnects and no capture session is active,
 * a grace timer starts; if nobody reconnects, lights go off. A page refresh
 * mid-session therefore never plunges an in-progress capture into darkness,
 * but an abandoned bench doesn't stay lit.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import { wsClientMessageSchema, type WsServerMessage, type WsServerEventType } from "../protocol/schemas.js";
import type { RigStateService } from "../services/RigStateService.js";
import type { BridgeConfig } from "../config.js";
import { RigCommandError } from "../serial/RigSerialClient.js";

export class RigWebSocketServer {
  private wss: WebSocketServer;
  private disconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    httpServer: HttpServer,
    private readonly rig: RigStateService,
    private readonly config: BridgeConfig,
    private readonly log: Logger
  ) {
    this.wss = new WebSocketServer({ server: httpServer, path: config.wsPath });
    this.wss.on("connection", (socket) => this.handleConnection(socket));

    rig.on("status", (status) => this.broadcast("rig:status", status));
    rig.on("capabilities", (caps) => this.broadcast("rig:capabilities", caps));
    rig.on("heartbeat", (payload) => this.broadcast("rig:heartbeat", payload));
    rig.on("rigEvent", (type, payload) => {
      if (type === "ERROR" || type === "WATCHDOG_TIMEOUT") {
        this.broadcast("rig:error", { source: "rig", event: type, ...payload });
      }
    });
    rig.on("log", (level, message, data) =>
      this.broadcast("rig:log", { level, message, data, at: new Date().toISOString() })
    );
  }

  get clientCount(): number {
    return this.wss.clients.size;
  }

  close(): void {
    for (const client of this.wss.clients) client.close();
    this.wss.close();
  }

  private handleConnection(socket: WebSocket): void {
    this.log.info({ clients: this.wss.clients.size }, "Web client connected");
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    // Bring the newcomer up to date immediately.
    this.sendTo(socket, "rig:status", this.rig.status);
    if (this.rig.capabilities) this.sendTo(socket, "rig:capabilities", this.rig.capabilities);

    socket.on("message", (raw) => void this.handleMessage(socket, raw.toString()));
    socket.on("close", () => this.handleClientClosed());
    socket.on("error", (err) => this.log.warn(`WS client error: ${err.message}`));
  }

  private handleClientClosed(): void {
    this.log.info({ clients: this.wss.clients.size }, "Web client disconnected");
    if (this.wss.clients.size > 0) return;
    if (!this.config.safety.allOffOnLastClientDisconnect) return;
    if (this.rig.captureSessionActive) {
      this.log.info("Last client gone but capture session active — keeping lights as-is");
      return;
    }
    this.disconnectTimer = setTimeout(() => {
      if (this.wss.clients.size === 0 && !this.rig.captureSessionActive) {
        void this.rig.safeAllOff("no web clients connected");
      }
    }, this.config.safety.clientDisconnectGraceMs);
    this.disconnectTimer.unref?.();
  }

  private async handleMessage(socket: WebSocket, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendTo(socket, "rig:error", { message: "Invalid JSON from client" });
      return;
    }
    const result = wsClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.sendTo(socket, "rig:error", {
        message: "Invalid message shape",
        issues: result.error.issues,
      });
      return;
    }
    const msg = result.data;
    const requestId = msg.requestId;

    try {
      switch (msg.type) {
        case "rig:connect": {
          const status = await this.rig.connect(msg.portPath);
          this.sendTo(socket, "rig:connected", status, requestId);
          break;
        }
        case "rig:disconnect":
          await this.rig.disconnect();
          this.sendTo(socket, "rig:disconnected", this.rig.status, requestId);
          break;
        case "rig:ping": {
          const res = await this.rig.ping();
          this.sendTo(socket, "rig:ack", { command: "ping", ...res.payload }, requestId);
          break;
        }
        case "rig:get-info": {
          const info = await this.rig.getInfo();
          this.sendTo(socket, "rig:ack", { command: "get-info", info }, requestId);
          break;
        }
        case "rig:get-capabilities": {
          const caps = await this.rig.refreshCapabilities();
          this.sendTo(socket, "rig:capabilities", caps, requestId);
          break;
        }
        case "rig:get-status": {
          const rigStatus = await this.rig.getRigStatus();
          this.sendTo(socket, "rig:status", { ...this.rig.status, rig: rigStatus }, requestId);
          break;
        }
        case "rig:set-profile": {
          const res = await this.rig.setProfile(msg.profile);
          this.broadcast("rig:profile-applied", {
            profileId: msg.profile.profileId,
            result: res.payload,
          }, requestId);
          break;
        }
        case "rig:set-zone": {
          const res = await this.rig.setZone(msg.zone);
          this.broadcast("rig:zone-updated", { zoneId: msg.zone.zoneId, result: res.payload }, requestId);
          break;
        }
        case "rig:all-off":
          await this.rig.allOff();
          this.broadcast("rig:profile-applied", { profileId: "all_off" }, requestId);
          break;
        case "rig:test-pattern": {
          const res = await this.rig.runTestPattern(msg.durationMs);
          this.sendTo(socket, "rig:ack", { command: "test-pattern", ...res.payload }, requestId);
          break;
        }
        case "rig:emergency-stop":
          await this.rig.emergencyStop();
          this.broadcast("rig:profile-applied", { profileId: "all_off", emergency: true }, requestId);
          break;
        case "rig:list-ports": {
          const ports = await this.rig.listPorts();
          this.sendTo(socket, "rig:ports", ports, requestId);
          break;
        }
        case "rig:capture-session":
          this.rig.setCaptureSessionActive(msg.active, msg.sessionId);
          this.sendTo(socket, "rig:ack", { command: "capture-session", active: msg.active }, requestId);
          break;
      }
    } catch (err) {
      const payload =
        err instanceof RigCommandError
          ? { code: err.code, message: err.message, commandId: err.commandId }
          : { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) };
      this.log.warn({ err: payload, type: msg.type }, "Command failed");
      this.sendTo(socket, "rig:error", { source: "bridge", forType: msg.type, ...payload }, requestId);
    }
  }

  private envelope(type: WsServerEventType, payload: unknown, requestId?: string): string {
    const message: WsServerMessage = { type, requestId, payload, at: new Date().toISOString() };
    return JSON.stringify(message);
  }

  private sendTo(socket: WebSocket, type: WsServerEventType, payload: unknown, requestId?: string): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(this.envelope(type, payload, requestId));
    }
  }

  private broadcast(type: WsServerEventType, payload: unknown, requestId?: string): void {
    const data = this.envelope(type, payload, requestId);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }
}
