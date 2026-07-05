import { describe, it, expect, vi } from "vitest";
import { RigCommandQueue } from "../src/services/RigCommandQueue.js";
import { RigCommands, type RigCommand, type RigResponse } from "../src/protocol/RigProtocol.js";

function okResponse(id: string): RigResponse {
  return { id, type: "result", status: "ok", timestamp: 0, payload: {} };
}

describe("RigCommandQueue", () => {
  it("rejects when no sender is attached (rig disconnected)", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 8 });
    await expect(queue.enqueue(RigCommands.ping())).rejects.toThrow(/not connected/i);
  });

  it("sends commands one at a time in FIFO order", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 8 });
    const sent: string[] = [];
    let inFlight = 0;
    queue.setSender(async (cmd) => {
      inFlight += 1;
      expect(inFlight).toBe(1);
      sent.push(cmd.type);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return okResponse(cmd.id);
    });
    await Promise.all([
      queue.enqueue(RigCommands.ping()),
      queue.enqueue(RigCommands.getInfo()),
      queue.enqueue(RigCommands.allOff()),
    ]);
    expect(sent).toEqual(["PING", "GET_INFO", "SET_ALL_OFF"]);
  });

  it("coalesces queued lighting commands (latest wins)", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 8 });
    const sent: Array<RigCommand<unknown>> = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    queue.setSender(async (cmd) => {
      sent.push(cmd);
      if (sent.length === 1) await gate; // hold the first command in flight
      return okResponse(cmd.id);
    });

    const first = queue.enqueue(RigCommands.ping()); // occupies the wire
    const staleProfile = queue.enqueue(
      RigCommands.setProfile({ profileId: "old", globalBrightness: 50, zones: [] }),
      { coalesceKey: "lighting:profile" }
    );
    const freshProfile = queue.enqueue(
      RigCommands.setProfile({ profileId: "new", globalBrightness: 80, zones: [] }),
      { coalesceKey: "lighting:profile" }
    );

    await expect(staleProfile).rejects.toThrow(/superseded/i);
    release();
    await first;
    await freshProfile;
    const profileCommands = sent.filter((c) => c.type === "SET_PROFILE");
    expect(profileCommands).toHaveLength(1);
    expect((profileCommands[0]!.payload as { profileId: string }).profileId).toBe("new");
  });

  it("emergency stop flushes the queue and runs first", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 8 });
    const sent: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    queue.setSender(async (cmd) => {
      sent.push(cmd.type);
      if (sent.length === 1) await gate;
      return okResponse(cmd.id);
    });

    const first = queue.enqueue(RigCommands.ping());
    const doomed = queue.enqueue(
      RigCommands.setProfile({ profileId: "x", globalBrightness: 80, zones: [] })
    );
    const emergency = queue.enqueueEmergency(RigCommands.allOff());

    await expect(doomed).rejects.toThrow(/emergency/i);
    release();
    await first;
    await emergency;
    expect(sent).toEqual(["PING", "SET_ALL_OFF"]);
  });

  it("applies backpressure when the queue is full", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 1 });
    queue.setSender(() => new Promise(() => {})); // never resolves
    void queue.enqueue(RigCommands.ping()).catch(() => {}); // goes in flight
    void queue.enqueue(RigCommands.ping()).catch(() => {}); // queued (depth 1)
    await expect(queue.enqueue(RigCommands.ping())).rejects.toThrow(/queue full/i);
  });

  it("rejects queued commands when the rig disconnects", async () => {
    const queue = new RigCommandQueue({ maxQueueDepth: 8 });
    queue.setSender(() => new Promise(() => {}));
    void queue.enqueue(RigCommands.ping()).catch(() => {});
    const queued = queue.enqueue(RigCommands.getInfo());
    queue.setSender(null);
    await expect(queued).rejects.toThrow(/disconnected/i);
  });
});
