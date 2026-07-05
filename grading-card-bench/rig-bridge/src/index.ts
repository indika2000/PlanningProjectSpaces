/**
 * Rig Bridge Service entry point.
 *
 * Wires together: HTTP diagnostics + WebSocket API + serial rig client.
 * Run with `--mock` (or RIG_MOCK=1) to use the simulated ESP32.
 */

import express from "express";
import http from "node:http";
import { pino } from "pino";
import { loadConfig } from "./config.js";
import { SerialPortManager } from "./serial/SerialPortManager.js";
import { RigCommandQueue } from "./services/RigCommandQueue.js";
import { RigStateService } from "./services/RigStateService.js";
import { RigHealthService } from "./services/RigHealthService.js";
import { RigWebSocketServer } from "./ws/RigWebSocketServer.js";
import { createDiagnosticsRouter } from "./routes/diagnostics.routes.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = pino({ level: config.logLevel, name: "rig-bridge" });

  const ports = new SerialPortManager({
    baudRate: config.serial.baudRate,
    mock: config.mockRig,
  });
  const queue = new RigCommandQueue({ maxQueueDepth: config.command.maxQueueDepth });
  const rig = new RigStateService(ports, queue, config, log.child({ mod: "rig" }));
  const health = new RigHealthService(
    rig,
    { staleAfterMs: config.heartbeat.staleAfterMs },
    log.child({ mod: "health" })
  );
  health.start();

  const app = express();
  app.use(express.json());
  // Local-only service, but the web app may run on a different dev port.
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    next();
  });
  app.use(createDiagnosticsRouter(rig));

  const server = http.createServer(app);
  const wsServer = new RigWebSocketServer(server, rig, config, log.child({ mod: "ws" }));

  server.listen(config.httpPort, () => {
    log.info(
      `Rig Bridge listening on http://localhost:${config.httpPort} (ws path ${config.wsPath})` +
        (config.mockRig ? " [MOCK RIG]" : "")
    );
  });

  if (config.serial.autoConnect) {
    rig.connect().catch((err) => {
      log.warn(`Auto-connect failed (will wait for manual connect): ${err.message}`);
    });
  }

  // ---- Failsafe shutdown: always try to leave the LEDs off. ----
  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Shutting down (${signal}) — turning lights off`);
    health.stop();
    try {
      await Promise.race([
        rig.safeAllOff(`bridge shutdown: ${signal}`),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      await rig.disconnect().catch(() => undefined);
    } finally {
      wsServer.close();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1000).unref();
    }
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    log.error(err, "Uncaught exception");
    void shutdown("uncaughtException");
  });
}

main().catch((err) => {
  console.error("Fatal error starting rig-bridge:", err);
  process.exit(1);
});
