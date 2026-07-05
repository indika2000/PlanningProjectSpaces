import { describe, it, expect } from "vitest";
import { MockRigTransport } from "../src/serial/MockRigTransport.js";
import { RigSerialClient, RigCommandError } from "../src/serial/RigSerialClient.js";
import { RigCommands, type RigEventType, type RigResponse } from "../src/protocol/RigProtocol.js";
import { rigCapabilitiesPayloadSchema } from "../src/protocol/schemas.js";

async function makeClient(timeoutMs = 500): Promise<{ mock: MockRigTransport; client: RigSerialClient }> {
  const mock = new MockRigTransport();
  await mock.open();
  const client = new RigSerialClient(mock, { commandTimeoutMs: timeoutMs });
  return { mock, client };
}

describe("RigSerialClient against the mock rig", () => {
  it("round-trips a PING", async () => {
    const { client } = await makeClient();
    const res = await client.send(RigCommands.ping());
    expect(res.status).toBe("ok");
    expect(res.payload.pong).toBe(true);
    await client.close();
  });

  it("returns a schema-valid capabilities payload", async () => {
    const { client } = await makeClient();
    const res = await client.send(RigCommands.getCapabilities());
    const caps = rigCapabilitiesPayloadSchema.parse(res.payload);
    expect(caps.zones.length).toBeGreaterThan(5);
    expect(caps.zones.some((z) => !z.installed)).toBe(true); // capability discovery matters
    await client.close();
  });

  it("applies a lighting profile and reports the active profile", async () => {
    const { client } = await makeClient();
    const res = await client.send(
      RigCommands.setProfile({
        profileId: "raking_left",
        globalBrightness: 85,
        zones: [
          { zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 90 },
        ],
      })
    );
    expect(res.payload).toMatchObject({ profileApplied: true, activeProfileId: "raking_left" });

    const status = await client.send(RigCommands.getStatus());
    expect(status.payload.activeProfileId).toBe("raking_left");
    await client.close();
  });

  it("rejects with a typed error for unknown zones", async () => {
    const { client } = await makeClient();
    const bad = client.send(
      RigCommands.setZone({
        zoneId: "ZONE_FAKE",
        enabled: true,
        rgb: { r: 1, g: 2, b: 3 },
        brightness: 10,
      })
    );
    await expect(bad).rejects.toBeInstanceOf(RigCommandError);
    await expect(
      client.send(
        RigCommands.setZone({ zoneId: "ZONE_FAKE", enabled: true, rgb: { r: 1, g: 2, b: 3 }, brightness: 10 })
      )
    ).rejects.toMatchObject({ code: "UNKNOWN_ZONE" });
    await client.close();
  });

  it("rejects not-installed zones", async () => {
    const { client } = await makeClient();
    await expect(
      client.send(
        RigCommands.setZone({
          zoneId: "ZONE_EDGE_LEFT",
          enabled: true,
          rgb: { r: 255, g: 255, b: 255 },
          brightness: 50,
        })
      )
    ).rejects.toMatchObject({ code: "ZONE_NOT_INSTALLED" });
    await client.close();
  });

  it("times out when the rig drops a response", async () => {
    const { mock, client } = await makeClient(150);
    mock.dropNextResponses = 1;
    await expect(client.send(RigCommands.ping())).rejects.toMatchObject({
      code: "COMMAND_TIMEOUT",
    });
    // The connection is still usable afterwards.
    const res = await client.send(RigCommands.ping());
    expect(res.payload.pong).toBe(true);
    await client.close();
  });

  it("survives garbage lines from the rig", async () => {
    const { mock, client } = await makeClient(200);
    const garbage: string[] = [];
    client.on("garbage", (_raw: string, reason: string) => garbage.push(reason));
    mock.respondWithGarbageOnce = true;
    await expect(client.send(RigCommands.ping())).rejects.toMatchObject({ code: "COMMAND_TIMEOUT" });
    expect(garbage.length).toBeGreaterThan(0);
    await client.close();
  });

  it("delivers heartbeat events", async () => {
    const { client } = await makeClient();
    const events: RigEventType[] = [];
    client.on("event", (type: RigEventType, _msg: RigResponse) => events.push(type));
    await client.send(RigCommands.startHeartbeat(250)); // mock clamps to >= 250ms
    await new Promise((r) => setTimeout(r, 600));
    expect(events).toContain("HEARTBEAT");
    await client.send(RigCommands.stopHeartbeat());
    await client.close();
  });

  it("fails pending commands when the port closes", async () => {
    const { mock, client } = await makeClient(5000);
    mock.dropNextResponses = 1;
    const pending = client.send(RigCommands.ping());
    await client.close();
    await expect(pending).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });
});
