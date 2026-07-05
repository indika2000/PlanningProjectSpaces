/**
 * HTTP diagnostics endpoints. These duplicate a subset of the WebSocket API so
 * operators can poke the rig with curl and monitoring can scrape /health.
 */

import { Router } from "express";
import type { RigStateService } from "../services/RigStateService.js";

export function createDiagnosticsRouter(rig: RigStateService): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "rig-bridge",
      rigConnected: rig.connected,
      at: new Date().toISOString(),
    });
  });

  router.get("/rig/status", (_req, res) => {
    res.json({ status: rig.status, capabilities: rig.capabilities });
  });

  router.get("/rig/ports", async (_req, res) => {
    try {
      res.json({ ports: await rig.listPorts() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/rig/connect", async (req, res) => {
    try {
      const portPath = typeof req.body?.portPath === "string" ? req.body.portPath : undefined;
      res.json({ status: await rig.connect(portPath) });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/rig/disconnect", async (_req, res) => {
    await rig.disconnect();
    res.json({ status: rig.status });
  });

  router.post("/rig/all-off", async (_req, res) => {
    try {
      await rig.emergencyStop();
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  });

  router.post("/rig/test-pattern", async (req, res) => {
    try {
      const durationMs = Number(req.body?.durationMs) || undefined;
      const result = await rig.runTestPattern(durationMs);
      res.json({ ok: true, result: result.payload });
    } catch (err) {
      res.status(502).json({ error: String(err) });
    }
  });

  return router;
}
