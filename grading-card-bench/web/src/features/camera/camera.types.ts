import type { CameraMetadata } from "../capture/capture.types";
import type { PixelImage } from "../validation/validation.types";

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface CameraFrame {
  pixels: PixelImage;
  blob?: Blob;
  cameraMetadata: CameraMetadata;
}

export interface CameraServiceOptions {
  deviceId?: string;
  idealWidth?: number;
  idealHeight?: number;
}

export class CameraError extends Error {
  constructor(message: string, public readonly operatorHint: string) {
    super(message);
    this.name = "CameraError";
  }
}
