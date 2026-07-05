/**
 * useCaptureSequence — owns the CaptureSequenceEngine instance and exposes
 * session state + controls to the Capture Bench UI.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { CaptureSequenceEngine } from "./captureSequenceEngine";
import type { CaptureSessionState, OperatorDecision } from "./capture.types";
import { getCaptureSequence } from "./captureSequences";
import { rigClient } from "../rig/rigClient";
import { CameraService } from "../camera/cameraService";
import { ImageValidationService } from "../validation/imageValidationService";
import { BrowserCaptureStorage } from "../session/captureStorage";
import { sessionApi } from "../session/sessionApi";

export interface UseCaptureSequence {
  session: CaptureSessionState | null;
  camera: CameraService;
  startSession: (args: { customerId?: string; cardId?: string; sequenceId?: string }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  decide: (decision: OperatorDecision) => void;
  confirmFlip: () => void;
  rerunStep: (stepId: string) => Promise<void>;
  captureManual: (lightingProfileId: string) => Promise<void>;
  acceptImage: (imageId: string) => void;
  rejectImage: (imageId: string, reason: string) => void;
  completeSession: () => void;
  error?: string;
}

export function useCaptureSequence(): UseCaptureSequence {
  const [session, setSession] = useState<CaptureSessionState | null>(null);
  const [error, setError] = useState<string>();

  const camera = useMemo(() => new CameraService(), []);
  const engineRef = useRef<CaptureSequenceEngine | null>(null);

  const engine = useMemo(() => {
    const e = new CaptureSequenceEngine({
      rig: rigClient,
      camera,
      validator: new ImageValidationService(),
      storage: new BrowserCaptureStorage(true),
    });
    e.subscribe(setSession);
    engineRef.current = e;
    return e;
  }, [camera]);

  const startSession = useCallback(
    async (args: { customerId?: string; cardId?: string; sequenceId?: string }) => {
      setError(undefined);
      const sequence = getCaptureSequence(args.sequenceId ?? "default_card_v1");
      if (!sequence) {
        setError("Unknown capture sequence");
        return;
      }
      const sessionId = `sess_${Date.now().toString(36)}`;
      // Register with the backend first (best effort offline).
      await sessionApi
        .createSession({ sessionId, sequenceId: sequence.id, ...args })
        .then(() => sessionApi.startSession(sessionId))
        .catch((err) => console.warn("Backend session create failed (continuing offline)", err));
      try {
        await engine.start({ sessionId, sequence, ...args });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [engine]
  );

  return {
    session,
    camera,
    error,
    startSession,
    pause: useCallback(() => engine.pause(), [engine]),
    resume: useCallback(() => engine.resume(), [engine]),
    cancel: useCallback(() => engine.cancel(), [engine]),
    decide: useCallback((d: OperatorDecision) => engine.resolveOperatorDecision(d), [engine]),
    confirmFlip: useCallback(() => engine.confirmCardFlipped(), [engine]),
    rerunStep: useCallback(
      async (stepId: string) => {
        setError(undefined);
        try {
          await engine.rerunStep(stepId);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      },
      [engine]
    ),
    captureManual: useCallback(
      async (lightingProfileId: string) => {
        setError(undefined);
        try {
          await engine.captureManual(lightingProfileId);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      },
      [engine]
    ),
    acceptImage: useCallback(
      (imageId: string) => {
        engine.acceptImage(imageId);
        void sessionApi.acceptImage(imageId).catch(() => undefined);
      },
      [engine]
    ),
    rejectImage: useCallback(
      (imageId: string, reason: string) => {
        engine.rejectImage(imageId, reason);
        void sessionApi.rejectImage(imageId, reason).catch(() => undefined);
      },
      [engine]
    ),
    completeSession: useCallback(() => {
      engine.markSessionCompleted();
      const s = engine.getState();
      if (s) void sessionApi.completeSession(s.sessionId).catch(() => undefined);
    }, [engine]),
  };
}
