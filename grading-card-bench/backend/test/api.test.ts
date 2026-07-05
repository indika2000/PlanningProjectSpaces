/**
 * Backend REST API tests: real express app + JsonStore on a temp directory,
 * exercised over HTTP with fetch (including multipart image upload).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { JsonStore } from "../src/store.js";
import { createApp } from "../src/app.js";

let server: http.Server;
let baseUrl: string;
let dataDir: string;

async function api(method: string, urlPath: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => undefined);
  return { status: res.status, json };
}

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "gcb-backend-test-"));
  const store = new JsonStore(dataDir);
  await store.init();
  const app = createApp(store);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("health", () => {
  it("GET /health", async () => {
    const { status, json } = await api("GET", "/health");
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });
});

describe("capture sessions", () => {
  it("creates, reads and transitions a session through its lifecycle", async () => {
    const created = await api("POST", "/api/capture-sessions", {
      sessionId: "sess_api_1",
      sequenceId: "default_card_v1",
      cardId: "card-9",
      customerId: "cust-3",
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ sessionId: "sess_api_1", status: "idle" });

    const fetched = await api("GET", "/api/capture-sessions/sess_api_1");
    expect(fetched.status).toBe(200);
    expect(fetched.json.cardId).toBe("card-9");

    const started = await api("POST", "/api/capture-sessions/sess_api_1/start");
    expect(started.json.status).toBe("capturing");
    expect(started.json.startedAt).toBeTruthy();

    const patched = await api("PATCH", "/api/capture-sessions/sess_api_1", {
      status: "review",
      currentStepIndex: 5,
    });
    expect(patched.json.status).toBe("review");
    expect(patched.json.state.currentStepIndex).toBe(5);

    const completed = await api("POST", "/api/capture-sessions/sess_api_1/complete");
    expect(completed.json.status).toBe("completed");
    expect(completed.json.completedAt).toBeTruthy();
  });

  it("cancel transition works", async () => {
    await api("POST", "/api/capture-sessions", { sessionId: "sess_api_2", sequenceId: "x" });
    const cancelled = await api("POST", "/api/capture-sessions/sess_api_2/cancel");
    expect(cancelled.json.status).toBe("cancelled");
  });

  it("validates required fields and 404s missing sessions", async () => {
    expect((await api("POST", "/api/capture-sessions", { sessionId: "no-seq" })).status).toBe(400);
    expect((await api("GET", "/api/capture-sessions/nope")).status).toBe(404);
    expect((await api("POST", "/api/capture-sessions/nope/start")).status).toBe(404);
    expect((await api("PATCH", "/api/capture-sessions/nope", {})).status).toBe(404);
  });
});

describe("captured images", () => {
  it("uploads an image with file + metadata and serves the file back", async () => {
    await api("POST", "/api/capture-sessions", { sessionId: "sess_img", sequenceId: "s" });

    const form = new FormData();
    const record = {
      imageId: "img_api_1",
      sessionId: "sess_img",
      stepId: "front_diffuse",
      accepted: true,
    };
    form.append("record", JSON.stringify(record));
    form.append("metadata", JSON.stringify({ lightingProfileId: "diffuse_full_front" }));
    form.append("file", new Blob([Buffer.from("fake-jpeg-bytes")], { type: "image/jpeg" }), "img_api_1.jpg");

    const res = await fetch(`${baseUrl}/api/capture-sessions/sess_img/images`, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { imageId: string; storageUrl?: string };
    expect(body.imageId).toBe("img_api_1");
    expect(body.storageUrl).toBe("/api/captured-images/img_api_1/file");

    const file = await fetch(`${baseUrl}${body.storageUrl}`);
    expect(file.status).toBe(200);
    expect(await file.text()).toBe("fake-jpeg-bytes");

    const list = await api("GET", "/api/capture-sessions/sess_img/images");
    expect(list.json).toHaveLength(1);

    const meta = await api("GET", "/api/captured-images/img_api_1");
    expect(meta.json.stepId).toBe("front_diffuse");
  });

  it("accepts metadata-only uploads (no file)", async () => {
    const form = new FormData();
    form.append("record", JSON.stringify({ imageId: "img_api_2", stepId: "x", accepted: false }));
    form.append("metadata", "{}");
    const res = await fetch(`${baseUrl}/api/capture-sessions/sess_img/images`, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { storageUrl?: string };
    expect(body.storageUrl).toBeUndefined();
  });

  it("accept/reject flips the stored flags", async () => {
    const rejected = await api("POST", "/api/captured-images/img_api_1/reject", {
      reason: "blurry on review",
    });
    expect(rejected.json).toMatchObject({ accepted: false, rejectedReason: "blurry on review" });

    const accepted = await api("POST", "/api/captured-images/img_api_1/accept");
    expect(accepted.json.accepted).toBe(true);
  });

  it("rejects malformed record JSON and missing imageId", async () => {
    const badJson = new FormData();
    badJson.append("record", "{not json");
    expect(
      (await fetch(`${baseUrl}/api/capture-sessions/sess_img/images`, { method: "POST", body: badJson }))
        .status
    ).toBe(400);

    const noId = new FormData();
    noId.append("record", "{}");
    expect(
      (await fetch(`${baseUrl}/api/capture-sessions/sess_img/images`, { method: "POST", body: noId }))
        .status
    ).toBe(400);
  });

  it("404s unknown images", async () => {
    expect((await api("GET", "/api/captured-images/ghost")).status).toBe(404);
    expect((await api("POST", "/api/captured-images/ghost/accept")).status).toBe(404);
    expect((await api("GET", "/api/captured-images/ghost/file")).status).toBe(404);
  });
});

describe("lighting profiles", () => {
  it("full CRUD", async () => {
    const profile = { id: "custom_raking", name: "Custom", zones: [], globalBrightness: 50 };
    expect((await api("POST", "/api/lighting-profiles", profile)).status).toBe(201);

    const list = await api("GET", "/api/lighting-profiles");
    expect(list.json.some((p: { id: string }) => p.id === "custom_raking")).toBe(true);

    await api("PATCH", "/api/lighting-profiles/custom_raking", { ...profile, name: "Custom v2" });
    const after = await api("GET", "/api/lighting-profiles");
    expect(after.json.find((p: { id: string }) => p.id === "custom_raking").name).toBe("Custom v2");

    expect((await api("DELETE", "/api/lighting-profiles/custom_raking")).status).toBe(200);
    expect((await api("DELETE", "/api/lighting-profiles/custom_raking")).status).toBe(404);
  });

  it("requires an id", async () => {
    expect((await api("POST", "/api/lighting-profiles", { name: "anon" })).status).toBe(400);
  });
});

describe("capture sequences", () => {
  it("create, list and patch", async () => {
    expect(
      (await api("POST", "/api/capture-sequences", { id: "seq_custom", name: "Seq", steps: [] })).status
    ).toBe(201);
    const list = await api("GET", "/api/capture-sequences");
    expect(list.json.some((s: { id: string }) => s.id === "seq_custom")).toBe(true);
    await api("PATCH", "/api/capture-sequences/seq_custom", { name: "Seq v2", steps: [] });
    const after = await api("GET", "/api/capture-sequences");
    expect(after.json.find((s: { id: string }) => s.id === "seq_custom").name).toBe("Seq v2");
  });
});

describe("persistence", () => {
  it("data survives a store reload (JSON file round-trip)", async () => {
    const reloaded = new JsonStore(dataDir);
    await reloaded.init();
    expect(reloaded.getSession("sess_api_1")?.status).toBe("completed");
    expect(reloaded.getImage("img_api_1")?.accepted).toBe(true);
  });
});
