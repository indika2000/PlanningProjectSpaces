/**
 * API client for the grading backend (capture sessions + captured images +
 * lighting profiles). The backend never talks to the ESP32 — it only stores
 * session data, so multiple bench stations can share one backend.
 */

import type {
  CaptureImageMetadata,
  CaptureSessionState,
  CapturedImageRecord,
} from "../capture/capture.types";

const BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
  "http://localhost:8788";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export const sessionApi = {
  createSession(args: {
    sessionId: string;
    customerId?: string;
    cardId?: string;
    cardType?: string;
    sequenceId: string;
  }) {
    return api<{ sessionId: string }>(`/api/capture-sessions`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  },

  getSession(sessionId: string) {
    return api<CaptureSessionState>(`/api/capture-sessions/${sessionId}`);
  },

  updateSession(sessionId: string, patch: Partial<CaptureSessionState>) {
    return api(`/api/capture-sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  startSession(sessionId: string) {
    return api(`/api/capture-sessions/${sessionId}/start`, { method: "POST" });
  },

  completeSession(sessionId: string) {
    return api(`/api/capture-sessions/${sessionId}/complete`, { method: "POST" });
  },

  cancelSession(sessionId: string) {
    return api(`/api/capture-sessions/${sessionId}/cancel`, { method: "POST" });
  },

  /** Upload one captured image (JPEG) + its metadata document. */
  async uploadImage(
    record: CapturedImageRecord,
    metadata: CaptureImageMetadata,
    blob?: Blob
  ): Promise<{ imageId: string; storageUrl?: string }> {
    const form = new FormData();
    form.append("record", JSON.stringify(record));
    form.append("metadata", JSON.stringify(metadata));
    if (blob) form.append("file", blob, `${record.imageId}.jpg`);
    const res = await fetch(
      `${BASE_URL}/api/capture-sessions/${record.sessionId}/images`,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
    return (await res.json()) as { imageId: string; storageUrl?: string };
  },

  listImages(sessionId: string) {
    return api<CapturedImageRecord[]>(`/api/capture-sessions/${sessionId}/images`);
  },

  acceptImage(imageId: string) {
    return api(`/api/captured-images/${imageId}/accept`, { method: "POST" });
  },

  rejectImage(imageId: string, reason: string) {
    return api(`/api/captured-images/${imageId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};
