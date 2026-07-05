import { describe, it, expect, vi } from "vitest";
import { pino } from "pino";
import { loadConfig } from "../src/config.js";
import { SerialPortManager } from "../src/serial/SerialPortManager.js";
import { RigCommandQueue } from "../src/services/RigCommandQueue.js";
import { RigStateService } from "../src/services/RigStateService.js";
import { RigHealthService } from "../src/services/RigHealthService.js";

const silentLog = pino({ level: "silent" });

function makeService() {
  const config = loadConfig(["node", "index", "--mock"]);
  config.heartbeat.intervalMs = 250;
  const ports = new SerialPortManager({ baudRate: 115200, mock: true });
  const queue = new RigCommandQueue({ maxQueueDepth: 32 });
  const rig = new RigStateService(ports, queue, config, silentLog);
  return { rig, queue, config };
}

describe("RigStateService lifecycle", () => {
  it("connects to the mock rig, discovers capabilities, and starts all-off", async () => {
    const { rig } = makeService();
    const statusEvents: string[] = [];
    rig.on("status", (s) => statusEvents.push(s.state));

    const status = await rig.connect();
    expect(status.connected).toBe(true);
    expect(status.state).toBe("connected");
    expect(status.portPath).toBe("mock://esp32");
    expect(status.firmwareVersion).toBe("0.1.0-mock");
    expect(status.board).toBe("MOCK-ESP32-S3");
    expect(status.activeProfileId).toBe("all_off"); // known-safe start state
    expect(rig.capabilities?.zones.length).toBeGreaterThan(5);
    expect(statusEvents).toContain("connecting");
    await rig.disconnect();
  });

  it("lists mock ports with likelyRig flag", async () => {
    const { rig } = makeService();
    const ports = await rig.listPorts();
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatchObject({ path: "mock://esp32", likelyRig: true });
  });

  it("connect is idempotent while connected", async () => {
    const { rig } = makeService();
    await rig.connect();
    const again = await rig.connect();
    expect(again.connected).toBe(true);
    await rig.disconnect();
  });

  it("disconnect turns lights off first and clears state", async () => {
    const { rig } = makeService();
    await rig.connect();
    await rig.setProfile({
      profileId: "raking_left",
      globalBrightness: 85,
      zones: [
        { zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 90 },
      ],
    });
    expect(rig.status.activeProfileId).toBe("raking_left");
    await rig.disconnect();
    expect(rig.status.connected).toBe(false);
    expect(rig.status.state).toBe("disconnected");
    expect(rig.status.portPath).toBeUndefined();
  });
});

describe("RigStateService commands", () => {
  it("setProfile updates activeProfileId and rig-side status agrees", async () => {
    const { rig } = makeService();
    await rig.connect();
    await rig.setProfile({
      profileId: "surface_glare",
      globalBrightness: 90,
      zones: [
        { zoneId: "ZONE_SURFACE_GLARE", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 95 },
      ],
    });
    const rigStatus = await rig.getRigStatus();
    expect(rigStatus.activeProfileId).toBe("surface_glare");
    await rig.disconnect();
  });

  it("rejects profiles that use zones missing from capabilities BEFORE hitting the wire", async () => {
    const { rig } = makeService();
    await rig.connect();
    await expect(
      rig.setProfile({
        profileId: "bad",
        globalBrightness: 50,
        zones: [{ zoneId: "ZONE_DOES_NOT_EXIST", enabled: true, rgb: { r: 1, g: 1, b: 1 }, brightness: 10 }],
      })
    ).rejects.toMatchObject({ code: "UNKNOWN_ZONE" });
    await rig.disconnect();
  });

  it("rejects enabling not-installed zones locally", async () => {
    const { rig } = makeService();
    await rig.connect();
    await expect(
      rig.setZone({
        zoneId: "ZONE_EDGE_LEFT", // installed=false on the mock rig
        enabled: true,
        rgb: { r: 255, g: 255, b: 255 },
        brightness: 40,
      })
    ).rejects.toMatchObject({ code: "ZONE_NOT_INSTALLED" });
    await rig.disconnect();
  });

  it("emergencyStop forces all_off", async () => {
    const { rig } = makeService();
    await rig.connect();
    await rig.setProfile({
      profileId: "raking_left",
      globalBrightness: 85,
      zones: [
        { zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 90 },
      ],
    });
    await rig.emergencyStop();
    expect(rig.status.activeProfileId).toBe("all_off");
    const rigStatus = await rig.getRigStatus();
    expect(rigStatus.activeProfileId).toBe("all_off");
    await rig.disconnect();
  });

  it("safeAllOff is a no-op when disconnected", async () => {
    const { rig } = makeService();
    await expect(rig.safeAllOff("test")).resolves.toBeUndefined();
  });

  it("commands reject when not connected", async () => {
    const { rig } = makeService();
    await expect(rig.ping()).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });

  it("tracks capture session activity", () => {
    const { rig } = makeService();
    expect(rig.captureSessionActive).toBe(false);
    rig.setCaptureSessionActive(true, "sess_1");
    expect(rig.captureSessionActive).toBe(true);
    rig.setCaptureSessionActive(false);
    expect(rig.captureSessionActive).toBe(false);
  });
});

describe("RigStateService events + health", () => {
  it("receives heartbeats and stamps lastHeartbeatAt", async () => {
    const { rig } = makeService();
    const heartbeats: unknown[] = [];
    rig.on("heartbeat", (p) => heartbeats.push(p));
    await rig.connect();
    await vi.waitFor(
      () => {
        expect(heartbeats.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );
    expect(rig.status.lastHeartbeatAt).toBeTruthy();
    expect(rig.status.heartbeatStale).toBe(false);
    await rig.disconnect();
  });

  it("markHeartbeatStale flips the status flag and health service marks fresh again", async () => {
    const { rig } = makeService();
    await rig.connect();
    rig.markHeartbeatStale(true);
    expect(rig.status.heartbeatStale).toBe(true);

    const health = new RigHealthService(
      rig,
      { staleAfterMs: 10_000, checkIntervalMs: 20 },
      silentLog
    );
    // A heartbeat arrives -> next check clears the stale flag.
    health.start();
    await vi.waitFor(
      () => {
        expect(rig.status.heartbeatStale).toBe(false);
      },
      { timeout: 2000 }
    );
    health.stop();
    await rig.disconnect();
  });

  it("marks the rig unavailable when serial closes underneath it", async () => {
    const { rig } = makeService();
    await rig.connect();
    // Reach into the client's transport and slam it shut (simulates USB pull).
    const client = (rig as unknown as { client: { close(): Promise<void> } }).client;
    await client.close();
    await vi.waitFor(() => {
      expect(rig.status.connected).toBe(false);
    });
    expect(rig.status.state).toBe("error");
    expect(rig.status.error).toMatch(/serial connection lost/i);
  });
});
