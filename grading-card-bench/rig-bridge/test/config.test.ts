import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

const ENV_KEYS = [
  "RIG_BRIDGE_PORT",
  "RIG_SERIAL_BAUD",
  "RIG_AUTO_CONNECT",
  "RIG_SERIAL_PORT",
  "RIG_COMMAND_TIMEOUT_MS",
  "RIG_MOCK",
  "RIG_ALL_OFF_ON_CLIENT_DISCONNECT",
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("loadConfig", () => {
  it("provides sane defaults", () => {
    const config = loadConfig(["node", "index"]);
    expect(config.httpPort).toBe(8787);
    expect(config.wsPath).toBe("/rig");
    expect(config.serial.baudRate).toBe(115200);
    expect(config.serial.autoConnect).toBe(true);
    expect(config.command.timeoutMs).toBe(3000);
    expect(config.mockRig).toBe(false);
    expect(config.safety.allOffOnLastClientDisconnect).toBe(true);
  });

  it("reads environment overrides", () => {
    process.env.RIG_BRIDGE_PORT = "9999";
    process.env.RIG_SERIAL_BAUD = "230400";
    process.env.RIG_SERIAL_PORT = "/dev/ttyACM7";
    process.env.RIG_AUTO_CONNECT = "false";
    process.env.RIG_COMMAND_TIMEOUT_MS = "1234";
    const config = loadConfig(["node", "index"]);
    expect(config.httpPort).toBe(9999);
    expect(config.serial.baudRate).toBe(230400);
    expect(config.serial.portPath).toBe("/dev/ttyACM7");
    expect(config.serial.autoConnect).toBe(false);
    expect(config.command.timeoutMs).toBe(1234);
  });

  it("ignores garbage numeric env values", () => {
    process.env.RIG_BRIDGE_PORT = "not-a-number";
    expect(loadConfig(["node", "index"]).httpPort).toBe(8787);
  });

  it("enables mock mode via --mock flag or RIG_MOCK env", () => {
    expect(loadConfig(["node", "index", "--mock"]).mockRig).toBe(true);
    process.env.RIG_MOCK = "1";
    expect(loadConfig(["node", "index"]).mockRig).toBe(true);
    process.env.RIG_MOCK = "true";
    expect(loadConfig(["node", "index"]).mockRig).toBe(true);
  });
});
