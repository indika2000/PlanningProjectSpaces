/**
 * End-to-end bridge test: real HTTP server + RigWebSocketServer +
 * RigStateService wired to the in-process mock ESP32, exercised through an
 * actual WebSocket client — the same path the web app uses.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import express from "express";
import { WebSocket } from "ws";
import { pino } from "pino";
import { loadConfig } from "../src/config.js";
import { SerialPortManager } from "../src/serial/SerialPortManager.js";
import { RigCommandQueue } from "../src/services/RigCommandQueue.js";
import { RigStateService } from "../src/services/RigStateService.js";
import { RigWebSocketServer } from "../src/ws/RigWebSocketServer.js";
import { createDiagnosticsRouter } from "../src/routes/diagnostics.routes.js";

interface ServerMessage {
  type: string;
  requestId?: string;
  payload: Record<string, unknown> & { [k: string]: unknown };
  at: string;
}

class TestClient {
  private ws!: WebSocket;
  public received: ServerMessage[] = [];

  async connect(url: string): Promise<void> {
    this.ws = new WebSocket(url);
    // Attach the message listener BEFORE open resolves — the bridge pushes
    // rig:status immediately on connection.
    this.ws.on("message", (raw) => {
      this.received.push(JSON.parse(raw.toString()) as ServerMessage);
    });
    await new Promise<void>((resolve, reject) => {
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
    });
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  sendRaw(raw: string): void {
    this.ws.send(raw);
  }

  async waitFor(
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs = 3000
  ): Promise<ServerMessage> {
    const started = Date.now();
    for (;;) {
      const found = this.received.find(predicate);
      if (found) return found;
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          `Timed out waiting for message. Seen: ${this.received.map((m) => m.type).join(", ")}`
        );
      }
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  close(): void {
    this.ws.close();
  }
}

let server: http.Server;
let rig: RigStateService;
let wsServer: RigWebSocketServer;
let baseUrl: string;
let wsUrl: string;

beforeAll(async () => {
  const config = loadConfig(["node", "index", "--mock"]);
  config.safety.clientDisconnectGraceMs = 100;
  const log = pino({ level: "silent" });
  const ports = new SerialPortManager({ baudRate: 115200, mock: true });
  const queue = new RigCommandQueue({ maxQueueDepth: 32 });
  rig = new RigStateService(ports, queue, config, log);

  const app = express();
  app.use(express.json());
  app.use(createDiagnosticsRouter(rig));
  server = http.createServer(app);
  wsServer = new RigWebSocketServer(server, rig, config, log);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/rig`;
});

afterAll(async () => {
  await rig.disconnect().catch(() => undefined);
  wsServer.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("WebSocket API integration", () => {
  it("sends current status to a client on connect", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);
    const status = await client.waitFor((m) => m.type === "rig:status");
    expect(status.payload).toHaveProperty("connected");
    client.close();
  });

  it("connects the rig, applies a profile, reads status, and emergency-stops", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);

    client.send({ type: "rig:connect", requestId: "c1" });
    const connected = await client.waitFor(
      (m) => m.type === "rig:connected" && m.requestId === "c1",
      8000
    );
    expect(connected.payload.connected).toBe(true);
    expect(connected.payload.firmwareVersion).toBe("0.1.0-mock");

    // Capabilities broadcast during connect.
    const caps = await client.waitFor((m) => m.type === "rig:capabilities");
    expect(Array.isArray((caps.payload as { zones: unknown[] }).zones)).toBe(true);

    client.send({
      type: "rig:set-profile",
      requestId: "p1",
      profile: {
        profileId: "raking_left",
        globalBrightness: 85,
        zones: [
          { zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 90 },
        ],
      },
    });
    const applied = await client.waitFor((m) => m.type === "rig:profile-applied" && m.requestId === "p1");
    expect(applied.payload.profileId).toBe("raking_left");

    client.send({ type: "rig:get-status", requestId: "s1" });
    const status = await client.waitFor((m) => m.type === "rig:status" && m.requestId === "s1");
    expect((status.payload as { rig: { activeProfileId: string } }).rig.activeProfileId).toBe(
      "raking_left"
    );

    client.send({ type: "rig:emergency-stop", requestId: "e1" });
    const stopped = await client.waitFor(
      (m) => m.type === "rig:profile-applied" && m.payload.emergency === true
    );
    expect(stopped.payload.profileId).toBe("all_off");
    client.close();
  });

  it("routes firmware errors back as rig:error with the firmware code", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);
    client.send({
      type: "rig:set-zone",
      requestId: "z1",
      zone: { zoneId: "ZONE_EDGE_LEFT", enabled: true, rgb: { r: 1, g: 1, b: 1 }, brightness: 10 },
    });
    const error = await client.waitFor((m) => m.type === "rig:error" && m.requestId === "z1");
    expect(error.payload.code).toBe("ZONE_NOT_INSTALLED");
    client.close();
  });

  it("rejects malformed and invalid-shape client messages without crashing", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);
    client.sendRaw("this is not json");
    const invalidJson = await client.waitFor(
      (m) => m.type === "rig:error" && String(m.payload.message).includes("Invalid JSON")
    );
    expect(invalidJson).toBeTruthy();

    client.send({ type: "rig:set-profile" }); // missing profile
    const invalidShape = await client.waitFor(
      (m) => m.type === "rig:error" && String(m.payload.message).includes("Invalid message shape")
    );
    expect(invalidShape).toBeTruthy();

    // Bridge still alive:
    client.send({ type: "rig:ping", requestId: "alive" });
    await client.waitFor((m) => m.type === "rig:ack" && m.requestId === "alive");
    client.close();
  });

  it("lists ports and heartbeats flow to clients", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);
    client.send({ type: "rig:list-ports", requestId: "lp" });
    const ports = await client.waitFor((m) => m.type === "rig:ports" && m.requestId === "lp");
    expect((ports.payload as unknown[]).length).toBeGreaterThan(0);
    await client.waitFor((m) => m.type === "rig:heartbeat", 5000);
    client.close();
  });

  it("marks capture sessions active via WS", async () => {
    const client = new TestClient();
    await client.connect(wsUrl);
    client.send({ type: "rig:capture-session", active: true, sessionId: "sess_x", requestId: "cs" });
    await client.waitFor((m) => m.type === "rig:ack" && m.requestId === "cs");
    expect(rig.captureSessionActive).toBe(true);
    client.send({ type: "rig:capture-session", active: false, requestId: "cs2" });
    await client.waitFor((m) => m.type === "rig:ack" && m.requestId === "cs2");
    expect(rig.captureSessionActive).toBe(false);
    client.close();
  });
});

describe("HTTP diagnostics integration", () => {
  it("GET /health reports rig connectivity", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("rig-bridge");
  });

  it("GET /rig/status and /rig/ports respond", async () => {
    const status = (await (await fetch(`${baseUrl}/rig/status`)).json()) as {
      status: { connected: boolean };
    };
    expect(typeof status.status.connected).toBe("boolean");

    const ports = (await (await fetch(`${baseUrl}/rig/ports`)).json()) as { ports: unknown[] };
    expect(ports.ports.length).toBeGreaterThan(0);
  });

  it("POST /rig/all-off and /rig/test-pattern work when connected", async () => {
    await rig.connect();
    const pattern = await fetch(`${baseUrl}/rig/test-pattern`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMs: 1000 }),
    });
    expect(pattern.status).toBe(200);

    const off = await fetch(`${baseUrl}/rig/all-off`, { method: "POST" });
    expect(off.status).toBe(200);
    expect(rig.status.activeProfileId).toBe("all_off");
  });
});
