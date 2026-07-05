/**
 * CameraService — browser getUserMedia implementation of the engine's
 * CameraController interface.
 *
 * The orchestrator only depends on { ensureReady, applySettings, capture },
 * so this module can be replaced by a DSLR/gPhoto2 bridge client, industrial
 * camera SDK adapter, or Raspberry Pi camera service later (see
 * docs/setup.md#cameras).
 */

import type { CaptureStep } from "../capture/capture.types";
import { CameraError, type CameraDeviceInfo, type CameraFrame, type CameraServiceOptions } from "./camera.types";

export class CameraService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private options: CameraServiceOptions;

  constructor(options: CameraServiceOptions = {}) {
    this.options = { idealWidth: 1920, idealHeight: 1080, ...options };
  }

  static async listDevices(): Promise<CameraDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
  }

  /** The live video element (attach it to the preview panel). */
  get videoElement(): HTMLVideoElement | null {
    return this.video;
  }

  isReady(): boolean {
    return this.stream !== null && this.video !== null && this.video.readyState >= 2;
  }

  async ensureReady(): Promise<void> {
    if (this.isReady()) return;
    await this.start();
    if (!this.isReady()) {
      throw new CameraError(
        "Camera stream did not become ready",
        "Check that the camera is connected and not in use by another application."
      );
    }
  }

  async start(deviceId?: string): Promise<void> {
    this.stop();
    if (deviceId) this.options.deviceId = deviceId;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: this.options.deviceId ? { exact: this.options.deviceId } : undefined,
          width: { ideal: this.options.idealWidth },
          height: { ideal: this.options.idealHeight },
        },
        audio: false,
      });
    } catch (err) {
      throw new CameraError(
        `getUserMedia failed: ${String(err)}`,
        "Grant camera permission in the browser and check the camera is plugged in."
      );
    }
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.stream;
    await video.play();
    // Wait for real frames.
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });
    }
    this.video = video;
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;
    this.video = null;
  }

  /**
   * Best-effort application of per-step camera settings. Browser support for
   * exposure/focus/white-balance constraints is device-dependent; unsupported
   * constraints are skipped silently (the validation layer catches bad
   * exposures anyway).
   */
  async applySettings(settings: NonNullable<CaptureStep["cameraSettings"]>): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
    const advanced: Record<string, unknown> = {};

    if (settings.exposureMode && "exposureMode" in capabilities) {
      advanced.exposureMode = settings.exposureMode === "manual" ? "manual" : "continuous";
    }
    if (settings.exposureValue !== undefined && "exposureCompensation" in capabilities) {
      advanced.exposureCompensation = settings.exposureValue;
    }
    if (settings.focusMode && "focusMode" in capabilities) {
      advanced.focusMode = settings.focusMode === "auto" ? "continuous" : "manual";
    }
    if (settings.whiteBalance && "whiteBalanceMode" in capabilities) {
      advanced.whiteBalanceMode = settings.whiteBalance === "auto" ? "continuous" : "manual";
    }
    if (Object.keys(advanced).length === 0) return;
    try {
      await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints);
    } catch {
      // Unsupported on this device — validation will catch exposure problems.
    }
  }

  /** Grab a still frame: RGBA pixels for validation + JPEG blob for storage. */
  async capture(): Promise<CameraFrame> {
    const video = this.video;
    if (!video || !this.isReady()) {
      throw new CameraError(
        "Camera is not ready",
        "Connect the camera and wait for the preview before capturing."
      );
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new CameraError("Canvas 2D unavailable", "Try a different browser.");
    ctx.drawImage(video, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const blob = await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? undefined), "image/jpeg", 0.95)
    );

    const track = this.stream?.getVideoTracks()[0];
    const trackSettings = track?.getSettings() ?? {};
    return {
      pixels: { width, height, data: imageData.data },
      blob,
      cameraMetadata: {
        deviceId: trackSettings.deviceId,
        label: track?.label,
        resolutionWidth: width,
        resolutionHeight: height,
        exposureMode: (trackSettings as Record<string, unknown>).exposureMode as string | undefined,
        whiteBalance: (trackSettings as Record<string, unknown>).whiteBalanceMode as string | undefined,
        focusMode: (trackSettings as Record<string, unknown>).focusMode as string | undefined,
      },
    };
  }
}
