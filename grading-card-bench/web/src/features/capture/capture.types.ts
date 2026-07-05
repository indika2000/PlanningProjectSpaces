/**
 * Capture domain types: sequences, sessions, captured images.
 */

import type { LightingZoneCommand, RigImageMetadata } from "../rig/rig.types";
import type { ImageValidationResult } from "../validation/validation.types";

export type CardSide = "front" | "back" | "edge" | "calibration";

export interface CaptureCameraSettings {
  exposureMode?: "auto" | "manual";
  exposureValue?: number;
  iso?: number;
  shutterSpeed?: string;
  whiteBalance?: "auto" | "locked" | "manual";
  focusMode?: "auto" | "manual" | "locked";
}

export interface CaptureStep {
  id: string;
  name: string;
  side: CardSide;
  lightingProfileId: string;
  required: boolean;
  description: string;
  /** What downstream analysis this shot feeds (centering, scratches, ...). */
  expectedUse: string[];
  cameraSettings?: CaptureCameraSettings;
  /** Time to let LEDs + auto-exposure stabilize after the profile applies. */
  settleTimeMs: number;
  validationProfileId: string;
  maxRetries: number;
}

export interface CaptureSequenceDefinition {
  id: string;
  name: string;
  description: string;
  steps: CaptureStep[];
  version: number;
}

export type CaptureStepStatus =
  | "pending"
  | "lighting"
  | "settling"
  | "capturing"
  | "validating"
  | "accepted"
  | "failed"
  | "skipped"
  | "awaiting_operator";

export interface CaptureStepRuntimeState {
  step: CaptureStep;
  status: CaptureStepStatus;
  attempts: number;
  imageId?: string;
  validationResult?: ImageValidationResult;
  error?: string;
}

export type CaptureSessionStatus =
  | "idle"
  | "calibrating"
  | "capturing"
  | "paused"
  | "awaiting_flip"
  | "awaiting_operator"
  | "review"
  | "completed"
  | "failed"
  | "cancelled";

export interface CameraMetadata {
  deviceId?: string;
  label?: string;
  resolutionWidth: number;
  resolutionHeight: number;
  exposureMode?: string;
  iso?: number;
  shutterSpeed?: string;
  whiteBalance?: string;
  focusMode?: string;
}

export interface CapturedImageRecord {
  imageId: string;
  sessionId: string;
  sequenceId: string;
  stepId: string;
  stepName: string;
  side: CardSide;
  lightingProfileId: string;
  /** Object URL for in-browser preview (revoked when the session closes). */
  blobUrl?: string;
  /** Backend storage URL once uploaded. */
  storageUrl?: string;
  capturedAt: string;
  cameraMetadata?: CameraMetadata;
  rigMetadata?: RigImageMetadata;
  validationResult?: ImageValidationResult;
  accepted: boolean;
  rejectedReason?: string;
  /** Manual shots and re-runs are marked so analysis can tell them apart. */
  origin: "sequence" | "retry" | "rerun" | "manual";
}

export interface CaptureSessionState {
  sessionId: string;
  customerId?: string;
  cardId?: string;
  cardType?: "tcg" | "sports" | "comic_card" | "other";
  sequenceId: string;
  status: CaptureSessionStatus;
  currentStepIndex: number;
  steps: CaptureStepRuntimeState[];
  images: CapturedImageRecord[];
  /** Operator-facing narration: "Applying Left Raking Light..." */
  operatorMessage: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/** Decision requested from the operator when retries are exhausted. */
export type OperatorDecision = "retry" | "skip" | "accept_anyway" | "abort";

/** Full metadata document persisted with every image (backend copy). */
export interface CaptureImageMetadata {
  imageId: string;
  sessionId: string;
  customerId?: string;
  cardId?: string;
  sequenceId: string;
  stepId: string;
  stepName: string;
  side: CardSide;
  lightingProfileId: string;
  lightingProfileName: string;
  rig: {
    controllerId?: string;
    firmwareVersion?: string;
    board?: string;
    activeZones: LightingZoneCommand[];
    globalBrightness: number;
    settleTimeMs: number;
  };
  camera: CameraMetadata;
  validation: ImageValidationResult;
  createdAt: string;
}
