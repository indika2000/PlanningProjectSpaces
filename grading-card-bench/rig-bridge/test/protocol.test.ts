import { describe, it, expect } from "vitest";
import {
  LineBuffer,
  parseRigLine,
  encodeCommand,
  buildCommand,
  isEventMessage,
  eventTypeOf,
  RigCommands,
} from "../src/protocol/RigProtocol.js";

describe("command formatting", () => {
  it("encodes newline-delimited JSON with id/type/timestamp/payload", () => {
    const cmd = buildCommand("PING", {}, "cmd_test");
    const wire = encodeCommand(cmd);
    expect(wire.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(wire);
    expect(parsed).toMatchObject({ id: "cmd_test", type: "PING", payload: {} });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("builds SET_PROFILE with zones and default fade", () => {
    const cmd = RigCommands.setProfile({
      profileId: "raking_left",
      globalBrightness: 85,
      zones: [
        {
          zoneId: "ZONE_LEFT_RAKING",
          enabled: true,
          rgb: { r: 255, g: 255, b: 255 },
          brightness: 90,
        },
      ],
    });
    expect(cmd.type).toBe("SET_PROFILE");
    expect(cmd.payload.fadeMs).toBe(0);
    expect(cmd.payload.zones).toHaveLength(1);
  });

  it("generates unique sequential command ids", () => {
    const a = RigCommands.ping();
    const b = RigCommands.ping();
    expect(a.id).not.toBe(b.id);
  });
});

describe("LineBuffer", () => {
  it("reassembles lines split across chunks", () => {
    const buf = new LineBuffer();
    expect(buf.push('{"id":"a"')).toEqual([]);
    expect(buf.push(',"type":"result"}\n{"id":"b"}\n')).toEqual([
      '{"id":"a","type":"result"}',
      '{"id":"b"}',
    ]);
  });

  it("tolerates CRLF and blank lines", () => {
    const buf = new LineBuffer();
    expect(buf.push("\r\n{\"id\":\"x\",\"type\":\"result\"}\r\n\n")).toEqual([
      '{"id":"x","type":"result"}',
    ]);
  });

  it("drops runaway lines instead of growing unbounded", () => {
    const buf = new LineBuffer(64);
    const lines = buf.push("x".repeat(100));
    expect(lines).toContain("__LINE_OVERFLOW__");
  });
});

describe("parseRigLine", () => {
  it("parses a valid result", () => {
    const parsed = parseRigLine(
      '{"id":"cmd_1","type":"result","status":"ok","timestamp":42,"payload":{"pong":true}}'
    );
    expect(parsed.kind).toBe("response");
    if (parsed.kind === "response") {
      expect(parsed.message.payload.pong).toBe(true);
      expect(parsed.message.timestamp).toBe(42);
    }
  });

  it("flags boot noise as garbage without throwing", () => {
    expect(parseRigLine("ets Jul 29 2019 rst:0x1").kind).toBe("garbage");
    expect(parseRigLine("{broken json").kind).toBe("garbage");
    expect(parseRigLine('{"noId": true}').kind).toBe("garbage");
  });

  it("detects events in both wire styles", () => {
    const styleA = parseRigLine(
      '{"id":"evt_1","type":"event","event":"HEARTBEAT","status":"ok","timestamp":1,"payload":{}}'
    );
    const styleB = parseRigLine(
      '{"id":"evt_2","type":"HEARTBEAT","status":"ok","timestamp":1,"payload":{}}'
    );
    for (const parsed of [styleA, styleB]) {
      expect(parsed.kind).toBe("response");
      if (parsed.kind === "response") {
        expect(isEventMessage(parsed.message)).toBe(true);
        expect(eventTypeOf(parsed.message)).toBe("HEARTBEAT");
      }
    }
  });
});
