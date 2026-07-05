/**
 * CaptureStorage implementation for the engine.
 *
 * Strategy:
 *  - Keep a blob URL locally for instant preview.
 *  - Upload the JPEG + full metadata to the backend (best effort — a storage
 *    outage must not kill a capture run; failures are recorded on the image
 *    record and the operator can re-upload from the review panel).
 *  - Mirror session state to localStorage so a browser refresh mid-session
 *    can restore progress.
 */

import type {
  CaptureImageMetadata,
  CaptureSessionState,
  CapturedImageRecord,
} from "../capture/capture.types";
import type { CapturedFrame, CaptureStorage } from "../capture/captureSequenceEngine";
import { getLightingProfile } from "../capture/lightingProfiles";
import { sessionApi } from "./sessionApi";

const LOCAL_KEY_PREFIX = "gcb.session.";

export class BrowserCaptureStorage implements CaptureStorage {
  /** Set to false to run fully offline (e.g. bench demo without backend). */
  constructor(private readonly uploadToBackend = true) {}

  async saveImage(
    record: CapturedImageRecord,
    frame: CapturedFrame
  ): Promise<CapturedImageRecord> {
    const enriched: CapturedImageRecord = { ...record };
    if (frame.blob) {
      enriched.blobUrl = URL.createObjectURL(frame.blob);
    }
    if (this.uploadToBackend) {
      try {
        const metadata = buildImageMetadata(enriched);
        const { storageUrl } = await sessionApi.uploadImage(enriched, metadata, frame.blob);
        enriched.storageUrl = storageUrl;
      } catch (err) {
        // Never lose a capture because storage hiccuped; keep it local and
        // let the operator retry the upload later.
        console.warn("Backend image upload failed; keeping image locally", err);
      }
    }
    return enriched;
  }

  async saveSessionState(state: CaptureSessionState): Promise<void> {
    try {
      // Blob URLs are session-local; strip them from the persisted copy.
      const persistable = {
        ...state,
        images: state.images.map(({ blobUrl: _blobUrl, ...img }) => img),
      };
      localStorage.setItem(
        `${LOCAL_KEY_PREFIX}${state.sessionId}`,
        JSON.stringify(persistable)
      );
    } catch {
      // localStorage full/unavailable — non-fatal.
    }
    if (this.uploadToBackend) {
      await sessionApi
        .updateSession(state.sessionId, state)
        .catch((err) => console.warn("Session state sync failed", err));
    }
  }

  static loadLocalSession(sessionId: string): CaptureSessionState | null {
    try {
      const raw = localStorage.getItem(`${LOCAL_KEY_PREFIX}${sessionId}`);
      return raw ? (JSON.parse(raw) as CaptureSessionState) : null;
    } catch {
      return null;
    }
  }

  static listLocalSessionIds(): string[] {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCAL_KEY_PREFIX)) ids.push(key.slice(LOCAL_KEY_PREFIX.length));
    }
    return ids;
  }
}

export function buildImageMetadata(record: CapturedImageRecord): CaptureImageMetadata {
  const profile = getLightingProfile(record.lightingProfileId);
  return {
    imageId: record.imageId,
    sessionId: record.sessionId,
    sequenceId: record.sequenceId,
    stepId: record.stepId,
    stepName: record.stepName,
    side: record.side,
    lightingProfileId: record.lightingProfileId,
    lightingProfileName: profile?.name ?? record.lightingProfileId,
    rig: {
      firmwareVersion: record.rigMetadata?.firmwareVersion,
      board: record.rigMetadata?.controllerBoard,
      activeZones: record.rigMetadata?.zones ?? [],
      globalBrightness: record.rigMetadata?.globalBrightness ?? 0,
      settleTimeMs: record.rigMetadata?.settleTimeMs ?? 0,
    },
    camera: record.cameraMetadata ?? { resolutionWidth: 0, resolutionHeight: 0 },
    validation: record.validationResult ?? {
      passed: record.accepted,
      score: 0,
      validationProfileId: "none",
      checks: {} as CaptureImageMetadata["validation"]["checks"],
      warnings: [],
      errors: [],
    },
    createdAt: record.capturedAt,
  };
}
