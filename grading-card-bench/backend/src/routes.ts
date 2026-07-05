/**
 * REST routes for capture sessions, captured images, lighting profiles and
 * capture sequences. The backend never touches the rig — physical control is
 * the local web app + Rig Bridge's job. This separation lets one backend
 * serve many bench stations.
 */

import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import type { JsonStore, StoredImage, StoredSession } from "./store.js";

export function createRoutes(store: JsonStore): Router {
  const router = Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: store.imagesDir,
      filename: (_req, file, cb) => cb(null, file.originalname),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // ---- Capture sessions -------------------------------------------------------

  router.post("/api/capture-sessions", async (req, res) => {
    const { sessionId, customerId, cardId, cardType, sequenceId } = req.body ?? {};
    if (!sessionId || !sequenceId) {
      return res.status(400).json({ error: "sessionId and sequenceId are required" });
    }
    const session: StoredSession = {
      sessionId,
      customerId,
      cardId,
      cardType,
      sequenceId,
      status: "idle",
      createdAt: new Date().toISOString(),
    };
    res.status(201).json(await store.upsertSession(session));
  });

  router.get("/api/capture-sessions/:sessionId", (req, res) => {
    const session = store.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "session not found" });
    res.json(session);
  });

  router.patch("/api/capture-sessions/:sessionId", async (req, res) => {
    // The web app PATCHes its full CaptureSessionState snapshot here.
    const patch = req.body ?? {};
    const updated = await store.patchSession(req.params.sessionId, {
      state: patch,
      status: typeof patch.status === "string" ? patch.status : undefined,
    });
    if (!updated) return res.status(404).json({ error: "session not found" });
    res.json(updated);
  });

  const transition = (status: string, stamp?: "startedAt" | "completedAt") =>
    async (req: Request, res: import("express").Response) => {
      const patch: Partial<StoredSession> = { status };
      if (stamp) patch[stamp] = new Date().toISOString();
      const updated = await store.patchSession(req.params.sessionId!, patch);
      if (!updated) return res.status(404).json({ error: "session not found" });
      res.json(updated);
    };

  router.post("/api/capture-sessions/:sessionId/start", transition("capturing", "startedAt"));
  router.post("/api/capture-sessions/:sessionId/complete", transition("completed", "completedAt"));
  router.post("/api/capture-sessions/:sessionId/cancel", transition("cancelled"));

  // ---- Captured images -----------------------------------------------------------

  router.post(
    "/api/capture-sessions/:sessionId/images",
    upload.single("file"),
    async (req, res) => {
      let record: Record<string, unknown>;
      let metadata: Record<string, unknown>;
      try {
        record = JSON.parse(String(req.body.record ?? "{}"));
        metadata = JSON.parse(String(req.body.metadata ?? "{}"));
      } catch {
        return res.status(400).json({ error: "record/metadata must be valid JSON" });
      }
      const imageId = String(record.imageId ?? "");
      if (!imageId) return res.status(400).json({ error: "record.imageId is required" });

      let filePath: string | undefined;
      if (req.file) {
        // Normalize the stored name to the imageId to avoid collisions.
        filePath = path.join(store.imagesDir, `${imageId}.jpg`);
        const fs = await import("node:fs/promises");
        await fs.rename(req.file.path, filePath).catch(async () => {
          await fs.copyFile(req.file!.path, filePath!);
        });
      }

      const image: StoredImage = {
        imageId,
        sessionId: req.params.sessionId!,
        stepId: String(record.stepId ?? "unknown"),
        accepted: Boolean(record.accepted),
        filePath,
        record,
        metadata,
        createdAt: new Date().toISOString(),
      };
      await store.upsertImage(image);
      res.status(201).json({
        imageId,
        storageUrl: filePath ? `/api/captured-images/${imageId}/file` : undefined,
      });
    }
  );

  router.get("/api/capture-sessions/:sessionId/images", (req, res) => {
    res.json(store.listImagesForSession(req.params.sessionId!));
  });

  router.get("/api/captured-images/:imageId", (req, res) => {
    const image = store.getImage(req.params.imageId!);
    if (!image) return res.status(404).json({ error: "image not found" });
    res.json(image);
  });

  router.get("/api/captured-images/:imageId/file", (req, res) => {
    const image = store.getImage(req.params.imageId!);
    if (!image?.filePath) return res.status(404).json({ error: "image file not found" });
    res.sendFile(path.resolve(image.filePath));
  });

  router.patch("/api/captured-images/:imageId", async (req, res) => {
    const updated = await store.patchImage(req.params.imageId!, { record: req.body });
    if (!updated) return res.status(404).json({ error: "image not found" });
    res.json(updated);
  });

  router.post("/api/captured-images/:imageId/accept", async (req, res) => {
    const updated = await store.patchImage(req.params.imageId!, {
      accepted: true,
      rejectedReason: undefined,
    });
    if (!updated) return res.status(404).json({ error: "image not found" });
    res.json(updated);
  });

  router.post("/api/captured-images/:imageId/reject", async (req, res) => {
    const updated = await store.patchImage(req.params.imageId!, {
      accepted: false,
      rejectedReason: String(req.body?.reason ?? "rejected"),
    });
    if (!updated) return res.status(404).json({ error: "image not found" });
    res.json(updated);
  });

  // ---- Lighting profiles -----------------------------------------------------------

  router.get("/api/lighting-profiles", (_req, res) => {
    res.json(store.listLightingProfiles());
  });

  router.post("/api/lighting-profiles", async (req, res) => {
    const profile = req.body ?? {};
    if (!profile.id) return res.status(400).json({ error: "profile.id is required" });
    await store.upsertLightingProfile(String(profile.id), profile);
    res.status(201).json(profile);
  });

  router.patch("/api/lighting-profiles/:profileId", async (req, res) => {
    await store.upsertLightingProfile(req.params.profileId!, {
      ...req.body,
      id: req.params.profileId,
    });
    res.json({ ok: true });
  });

  router.delete("/api/lighting-profiles/:profileId", async (req, res) => {
    const existed = await store.deleteLightingProfile(req.params.profileId!);
    res.status(existed ? 200 : 404).json({ deleted: existed });
  });

  // ---- Capture sequences -------------------------------------------------------------

  router.get("/api/capture-sequences", (_req, res) => {
    res.json(store.listCaptureSequences());
  });

  router.post("/api/capture-sequences", async (req, res) => {
    const sequence = req.body ?? {};
    if (!sequence.id) return res.status(400).json({ error: "sequence.id is required" });
    await store.upsertCaptureSequence(String(sequence.id), sequence);
    res.status(201).json(sequence);
  });

  router.patch("/api/capture-sequences/:sequenceId", async (req, res) => {
    await store.upsertCaptureSequence(req.params.sequenceId!, {
      ...req.body,
      id: req.params.sequenceId,
    });
    res.json({ ok: true });
  });

  return router;
}
