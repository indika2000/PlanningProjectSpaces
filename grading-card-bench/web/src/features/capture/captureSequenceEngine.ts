/**
 * CaptureSequenceEngine — the capture orchestrator.
 *
 * Executes a CaptureSequenceDefinition step by step:
 *
 *   check rig -> check camera -> apply lighting -> confirm -> settle
 *   -> lock camera settings -> capture -> validate
 *   -> accept | retry | ask operator -> next step
 *   -> flip prompt between sides -> ... -> all lights off
 *
 * The engine is deliberately UI-free and hardware-free: rig, camera,
 * validator, storage and clock are injected (see EngineDependencies), so the
 * same engine runs against the real bench, the mock rig, or unit-test fakes.
 *
 * Contract with the UI:
 *  - subscribe(listener) receives a fresh immutable CaptureSessionState after
 *    every transition (render it directly).
 *  - when state.status === "awaiting_operator", call resolveOperatorDecision().
 *  - when state.status === "awaiting_flip", call confirmCardFlipped().
 */

import type {
  CaptureSequenceDefinition,
  CaptureSessionState,
  CaptureStep,
  CaptureStepRuntimeState,
  CapturedImageRecord,
  CameraMetadata,
  OperatorDecision,
  CardSide,
} from "./capture.types";
import type { ImageValidationResult, PixelImage } from "../validation/validation.types";
import type { LightingProfile, RigImageMetadata } from "../rig/rig.types";

// ---- Injected dependencies -----------------------------------------------------

export interface AppliedLighting {
  profile: LightingProfile;
  /** Zones actually sent (after capability filtering). */
  appliedZones: LightingProfile["zones"];
  droppedZoneIds: string[];
  firmwareVersion?: string;
  board?: string;
}

export interface RigController {
  isConnected(): boolean;
  ensureConnected(): Promise<void>;
  applyLightingProfile(profileId: string): Promise<AppliedLighting>;
  allOff(): Promise<void>;
  /** Tell the bridge a capture session is active (protects lights-off-on-idle). */
  setCaptureSessionActive(active: boolean, sessionId?: string): Promise<void>;
}

export interface CapturedFrame {
  pixels: PixelImage;
  blob?: Blob;
  cameraMetadata: CameraMetadata;
}

export interface CameraController {
  ensureReady(): Promise<void>;
  applySettings?(settings: NonNullable<CaptureStep["cameraSettings"]>): Promise<void>;
  capture(): Promise<CapturedFrame>;
}

export interface ImageValidator {
  validate(
    pixels: PixelImage,
    validationProfileId: string
  ): Promise<ImageValidationResult>;
}

export interface CaptureStorage {
  /** Persist frame + metadata; returns the record enriched with URLs. */
  saveImage(
    record: CapturedImageRecord,
    frame: CapturedFrame
  ): Promise<CapturedImageRecord>;
  saveSessionState(state: CaptureSessionState): Promise<void>;
}

export interface EngineDependencies {
  rig: RigController;
  camera: CameraController;
  validator: ImageValidator;
  storage: CaptureStorage;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  idFactory?: () => string;
}

export interface StartSessionArgs {
  sessionId: string;
  sequence: CaptureSequenceDefinition;
  customerId?: string;
  cardId?: string;
  cardType?: CaptureSessionState["cardType"];
}

type Listener = (state: CaptureSessionState) => void;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let idCounter = 0;
const defaultIdFactory = () =>
  `img_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

class CancelledError extends Error {
  constructor() {
    super("Sequence cancelled");
    this.name = "CancelledError";
  }
}

export class CaptureSequenceEngine {
  private state: CaptureSessionState | null = null;
  private listeners = new Set<Listener>();
  private cancelled = false;
  private paused = false;
  private resumeWaiters: Array<() => void> = [];
  private operatorWaiter: ((decision: OperatorDecision) => void) | null = null;
  private flipWaiter: (() => void) | null = null;
  private running = false;

  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: EngineDependencies) {
    this.sleep = deps.sleep ?? defaultSleep;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.idFactory ?? defaultIdFactory;
  }

  // ---- Observation ---------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.state) listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): CaptureSessionState | null {
    return this.state;
  }

  // ---- Controls ------------------------------------------------------------

  async start(args: StartSessionArgs): Promise<CaptureSessionState> {
    if (this.running) throw new Error("A capture sequence is already running");
    this.cancelled = false;
    this.paused = false;
    this.running = true;

    this.state = {
      sessionId: args.sessionId,
      customerId: args.customerId,
      cardId: args.cardId,
      cardType: args.cardType,
      sequenceId: args.sequence.id,
      status: "capturing",
      currentStepIndex: 0,
      steps: args.sequence.steps.map((step) => ({
        step,
        status: "pending",
        attempts: 0,
      })),
      images: [],
      operatorMessage: "Starting capture sequence...",
      startedAt: this.now().toISOString(),
    };
    this.emitState();

    try {
      await this.runSequence();
    } finally {
      this.running = false;
    }
    return this.state!;
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.patchSession({ status: "paused", operatorMessage: "Sequence paused." });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.patchSession({ status: "capturing", operatorMessage: "Resuming..." });
    for (const w of this.resumeWaiters) w();
    this.resumeWaiters = [];
  }

  cancel(): void {
    this.cancelled = true;
    // Unblock whatever the loop is waiting on.
    this.resume();
    this.operatorWaiter?.("abort");
    this.operatorWaiter = null;
    this.flipWaiter?.();
    this.flipWaiter = null;
  }

  /** Operator answer to an awaiting_operator prompt. */
  resolveOperatorDecision(decision: OperatorDecision): void {
    const waiter = this.operatorWaiter;
    this.operatorWaiter = null;
    waiter?.(decision);
  }

  /** Operator confirms the card has been flipped. */
  confirmCardFlipped(): void {
    const waiter = this.flipWaiter;
    this.flipWaiter = null;
    waiter?.();
  }

  /** Skip the current step (allowed for optional steps, or by operator decision). */
  skipCurrentStep(): void {
    this.resolveOperatorDecision("skip");
  }

  /**
   * Re-run one already-completed step (new image, old one stays but is
   * superseded). Only valid while no sequence is running.
   */
  async rerunStep(stepId: string): Promise<void> {
    if (this.running) throw new Error("Cannot re-run a step while a sequence is running");
    const state = this.requireState();
    const runtime = state.steps.find((s) => s.step.id === stepId);
    if (!runtime) throw new Error(`Unknown step ${stepId}`);

    this.running = true;
    this.cancelled = false;
    try {
      this.patchSession({ status: "capturing" });
      await this.deps.rig.ensureConnected();
      await this.deps.camera.ensureReady();
      await this.executeStep(runtime, "rerun");
      await this.deps.rig.allOff();
      this.patchSession({ status: "review", operatorMessage: "Re-run complete." });
    } finally {
      this.running = false;
    }
  }

  /**
   * Manual extra shot under whatever lighting profile the operator chose.
   * Not validated against a step profile; stored with origin "manual".
   */
  async captureManual(lightingProfileId: string): Promise<CapturedImageRecord> {
    if (this.running) throw new Error("Cannot capture manually while a sequence is running");
    const state = this.requireState();
    this.running = true;
    try {
      await this.deps.rig.ensureConnected();
      await this.deps.camera.ensureReady();
      const lighting = await this.deps.rig.applyLightingProfile(lightingProfileId);
      await this.sleep(300);
      const frame = await this.deps.camera.capture();
      const record = await this.deps.storage.saveImage(
        this.buildRecord(state, {
          stepId: "manual",
          stepName: `Manual (${lighting.profile.name})`,
          side: "front",
          lightingProfileId,
          origin: "manual",
          frame,
          lighting,
          settleTimeMs: 300,
          accepted: true,
        }),
        frame
      );
      this.patchSession({ images: [...state.images, record] });
      await this.deps.storage.saveSessionState(this.requireState());
      return record;
    } finally {
      this.running = false;
    }
  }

  // ---- The sequence loop ----------------------------------------------------

  private async runSequence(): Promise<void> {
    const state = this.requireState();
    try {
      this.setMessage("Checking rig connection...");
      await this.deps.rig.ensureConnected();
      await this.deps.rig.setCaptureSessionActive(true, state.sessionId);

      this.setMessage("Checking camera...");
      await this.deps.camera.ensureReady();

      let previousSide: CardSide | null = null;

      for (let i = 0; i < state.steps.length; i++) {
        if (this.cancelled) throw new CancelledError();
        await this.waitIfPaused();

        this.patchSession({ currentStepIndex: i });
        const runtime = this.requireState().steps[i]!;

        // Flip prompt when the physical side changes.
        const side = runtime.step.side;
        if (
          previousSide !== null &&
          side !== previousSide &&
          (side === "back" || side === "front")
        ) {
          await this.promptFlip(side);
        }
        previousSide = side;

        await this.executeStep(runtime, "sequence");
        await this.deps.storage.saveSessionState(this.requireState());
      }

      this.setMessage("Sequence complete. Turning lights off...");
      await this.deps.rig.allOff();
      this.patchSession({
        status: "review",
        operatorMessage:
          "All shots captured. Review the image set and approve to complete the session.",
        completedAt: this.now().toISOString(),
      });
    } catch (err) {
      await this.deps.rig.allOff().catch(() => undefined);
      if (err instanceof CancelledError || this.cancelled) {
        this.patchSession({
          status: "cancelled",
          operatorMessage: "Sequence cancelled. Lights are off.",
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        this.patchSession({
          status: "failed",
          error: message,
          operatorMessage: `Sequence failed: ${message}`,
        });
      }
    } finally {
      await this.deps.rig
        .setCaptureSessionActive(false)
        .catch(() => undefined);
      await this.deps.storage
        .saveSessionState(this.requireState())
        .catch(() => undefined);
    }
  }

  /**
   * One step with its retry loop. Throws only on cancel or unrecoverable
   * operator abort — hardware/validation failures are handled inside.
   */
  private async executeStep(
    runtime: CaptureStepRuntimeState,
    origin: CapturedImageRecord["origin"] | "sequence"
  ): Promise<void> {
    const step = runtime.step;

    // Retry loop: attempts = 1 initial + maxRetries automatic retries, then
    // the operator decides.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.cancelled) throw new CancelledError();
      await this.waitIfPaused();

      this.updateStep(step.id, { attempts: runtime.attempts + 1 });
      runtime = this.currentRuntime(step.id);

      try {
        // 1. Lighting
        this.updateStep(step.id, { status: "lighting", error: undefined });
        this.setMessage(`Applying ${step.name} lighting...`);
        const lighting = await this.deps.rig.applyLightingProfile(step.lightingProfileId);

        // 2. Settle
        this.updateStep(step.id, { status: "settling" });
        this.setMessage("Waiting for lighting to stabilize...");
        await this.sleep(step.settleTimeMs);

        // 3. Camera settings (best effort — not all cameras support locking)
        if (step.cameraSettings && this.deps.camera.applySettings) {
          await this.deps.camera.applySettings(step.cameraSettings);
        }

        // 4. Capture
        if (this.cancelled) throw new CancelledError();
        this.updateStep(step.id, { status: "capturing" });
        this.setMessage("Capturing image...");
        const frame = await this.deps.camera.capture();

        // 5. Validate
        this.updateStep(step.id, { status: "validating" });
        this.setMessage("Validating image quality...");
        const validation = await this.deps.validator.validate(
          frame.pixels,
          step.validationProfileId
        );

        // 6. Persist (failed captures are stored too, marked rejected)
        const record = await this.deps.storage.saveImage(
          this.buildRecord(this.requireState(), {
            stepId: step.id,
            stepName: step.name,
            side: step.side,
            lightingProfileId: step.lightingProfileId,
            origin: origin === "sequence" && runtime.attempts > 0 ? "retry" : (origin as CapturedImageRecord["origin"]),
            frame,
            lighting,
            settleTimeMs: step.settleTimeMs,
            accepted: validation.passed,
            validation,
          }),
          frame
        );
        this.patchSession({ images: [...this.requireState().images, record] });

        if (validation.passed) {
          this.updateStep(step.id, {
            status: "accepted",
            imageId: record.imageId,
            validationResult: validation,
          });
          this.setMessage(`${step.name}: image accepted. Moving on...`);
          return;
        }

        // Validation failed.
        this.updateStep(step.id, { validationResult: validation, imageId: record.imageId });
        runtime = this.currentRuntime(step.id);

        if (runtime.attempts <= step.maxRetries) {
          this.setMessage(
            `${step.name}: ${validation.suggestedAction ?? "validation failed"} ` +
              `Retrying (${runtime.attempts}/${step.maxRetries})...`
          );
          continue;
        }

        // Retries exhausted -> operator decision.
        const decision = await this.askOperator(step, validation);
        if (decision === "retry") {
          this.updateStep(step.id, { attempts: 0 });
          continue;
        }
        if (decision === "skip") {
          this.updateStep(step.id, { status: "skipped" });
          this.setMessage(`${step.name} skipped by operator.`);
          return;
        }
        if (decision === "accept_anyway") {
          this.updateStep(step.id, { status: "accepted", imageId: record.imageId });
          this.acceptImage(record.imageId);
          this.setMessage(`${step.name} accepted by operator override.`);
          return;
        }
        throw new Error(`Step ${step.id} aborted by operator after failed validation`);
      } catch (err) {
        if (err instanceof CancelledError || this.cancelled) throw new CancelledError();
        // Hardware-level failure (rig timeout, camera error, storage error).
        const message = err instanceof Error ? err.message : String(err);
        this.updateStep(step.id, { status: "failed", error: message });
        const decision = await this.askOperator(step, undefined, message);
        if (decision === "retry") {
          // Re-verify the stack before retrying.
          await this.deps.rig.ensureConnected();
          await this.deps.camera.ensureReady();
          this.updateStep(step.id, { attempts: 0 });
          continue;
        }
        if (decision === "skip") {
          this.updateStep(step.id, { status: "skipped" });
          return;
        }
        throw new Error(`Step ${step.id} failed: ${message}`);
      }
    }
  }

  // ---- Operator interaction ---------------------------------------------------

  private askOperator(
    step: CaptureStep,
    validation?: ImageValidationResult,
    hardwareError?: string
  ): Promise<OperatorDecision> {
    const reason = hardwareError
      ? `Hardware problem: ${hardwareError}`
      : validation?.suggestedAction ??
        validation?.errors.join("; ") ??
        "Validation failed.";
    this.updateStep(step.id, { status: "awaiting_operator" });
    this.patchSession({
      status: "awaiting_operator",
      operatorMessage: `${step.name}: ${reason}`,
    });
    return new Promise<OperatorDecision>((resolve) => {
      this.operatorWaiter = (decision) => {
        this.patchSession({ status: "capturing" });
        resolve(decision);
      };
    });
  }

  private promptFlip(toSide: CardSide): Promise<void> {
    return (async () => {
      // Lights off while hands are in the rig.
      await this.deps.rig.allOff();
      this.patchSession({
        status: "awaiting_flip",
        operatorMessage:
          toSide === "back"
            ? "Front side complete. Flip the card to the BACK, reseat it in the holder, then confirm."
            : "Flip the card to the FRONT, reseat it in the holder, then confirm.",
      });
      await new Promise<void>((resolve) => {
        this.flipWaiter = resolve;
      });
      if (this.cancelled) throw new CancelledError();
      this.patchSession({ status: "capturing", operatorMessage: "Continuing capture..." });
    })();
  }

  // ---- Image accept/reject (review phase) ----------------------------------------

  acceptImage(imageId: string): void {
    this.mutateImage(imageId, { accepted: true, rejectedReason: undefined });
  }

  rejectImage(imageId: string, reason: string): void {
    this.mutateImage(imageId, { accepted: false, rejectedReason: reason });
  }

  markSessionCompleted(): void {
    this.patchSession({
      status: "completed",
      completedAt: this.now().toISOString(),
      operatorMessage: "Session completed. Image set saved.",
    });
    void this.deps.storage.saveSessionState(this.requireState());
  }

  // ---- Internals -----------------------------------------------------------------

  private buildRecord(
    state: CaptureSessionState,
    args: {
      stepId: string;
      stepName: string;
      side: CardSide;
      lightingProfileId: string;
      origin: CapturedImageRecord["origin"];
      frame: CapturedFrame;
      lighting: AppliedLighting;
      settleTimeMs: number;
      accepted: boolean;
      validation?: ImageValidationResult;
    }
  ): CapturedImageRecord {
    const rigMetadata: RigImageMetadata = {
      firmwareVersion: args.lighting.firmwareVersion,
      controllerBoard: args.lighting.board,
      activeProfileId: args.lighting.profile.id,
      zones: args.lighting.appliedZones,
      globalBrightness: args.lighting.profile.globalBrightness,
      settleTimeMs: args.settleTimeMs,
    };
    return {
      imageId: this.newId(),
      sessionId: state.sessionId,
      sequenceId: state.sequenceId,
      stepId: args.stepId,
      stepName: args.stepName,
      side: args.side,
      lightingProfileId: args.lightingProfileId,
      capturedAt: this.now().toISOString(),
      cameraMetadata: args.frame.cameraMetadata,
      rigMetadata,
      validationResult: args.validation,
      accepted: args.accepted,
      origin: args.origin,
    };
  }

  private waitIfPaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => this.resumeWaiters.push(resolve));
  }

  private requireState(): CaptureSessionState {
    if (!this.state) throw new Error("No active capture session");
    return this.state;
  }

  private currentRuntime(stepId: string): CaptureStepRuntimeState {
    const runtime = this.requireState().steps.find((s) => s.step.id === stepId);
    if (!runtime) throw new Error(`Unknown step ${stepId}`);
    return runtime;
  }

  private updateStep(stepId: string, patch: Partial<CaptureStepRuntimeState>): void {
    const state = this.requireState();
    this.state = {
      ...state,
      steps: state.steps.map((s) => (s.step.id === stepId ? { ...s, ...patch } : s)),
    };
    this.emitState();
  }

  private mutateImage(imageId: string, patch: Partial<CapturedImageRecord>): void {
    const state = this.requireState();
    this.state = {
      ...state,
      images: state.images.map((img) =>
        img.imageId === imageId ? { ...img, ...patch } : img
      ),
    };
    this.emitState();
  }

  private patchSession(patch: Partial<CaptureSessionState>): void {
    this.state = { ...this.requireState(), ...patch };
    this.emitState();
  }

  private setMessage(operatorMessage: string): void {
    this.patchSession({ operatorMessage });
  }

  private emitState(): void {
    const state = this.state;
    if (!state) return;
    for (const listener of this.listeners) listener(state);
  }
}
