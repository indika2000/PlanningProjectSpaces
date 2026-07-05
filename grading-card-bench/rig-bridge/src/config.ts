/**
 * Bridge configuration. Everything is overridable via environment variables so
 * operators can tune the bench without rebuilding.
 */

export interface BridgeConfig {
  httpPort: number;
  wsPath: string;
  serial: {
    baudRate: number;
    /** Auto-connect to the first likely-rig port on startup. */
    autoConnect: boolean;
    /** Preferred port path (overrides auto-detection when set). */
    portPath?: string;
    reconnectDelayMs: number;
  };
  command: {
    timeoutMs: number;
    /** Max queued commands before rejecting new ones (backpressure guard). */
    maxQueueDepth: number;
  };
  heartbeat: {
    intervalMs: number;
    /** Mark the rig stale when no heartbeat for this long. */
    staleAfterMs: number;
  };
  safety: {
    /** Turn lights off when the last WS client disconnects and no capture session is active. */
    allOffOnLastClientDisconnect: boolean;
    /** Grace period before the disconnect all-off fires (client refresh shouldn't kill lights). */
    clientDisconnectGraceMs: number;
  };
  /** Run with a simulated ESP32 instead of real hardware (dev/tests). */
  mockRig: boolean;
  logLevel: string;
}

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function loadConfig(argv: string[] = process.argv): BridgeConfig {
  return {
    httpPort: envInt("RIG_BRIDGE_PORT", 8787),
    wsPath: env("RIG_BRIDGE_WS_PATH", "/rig"),
    serial: {
      baudRate: envInt("RIG_SERIAL_BAUD", 115200),
      autoConnect: envBool("RIG_AUTO_CONNECT", true),
      portPath: process.env.RIG_SERIAL_PORT,
      reconnectDelayMs: envInt("RIG_RECONNECT_DELAY_MS", 2000),
    },
    command: {
      timeoutMs: envInt("RIG_COMMAND_TIMEOUT_MS", 3000),
      maxQueueDepth: envInt("RIG_MAX_QUEUE_DEPTH", 32),
    },
    heartbeat: {
      intervalMs: envInt("RIG_HEARTBEAT_INTERVAL_MS", 1000),
      staleAfterMs: envInt("RIG_HEARTBEAT_STALE_MS", 5000),
    },
    safety: {
      allOffOnLastClientDisconnect: envBool("RIG_ALL_OFF_ON_CLIENT_DISCONNECT", true),
      clientDisconnectGraceMs: envInt("RIG_CLIENT_DISCONNECT_GRACE_MS", 10_000),
    },
    mockRig: argv.includes("--mock") || envBool("RIG_MOCK", false),
    logLevel: env("RIG_LOG_LEVEL", "info"),
  };
}
