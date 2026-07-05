/**
 * Shared pixel math for validators. Everything operates on PixelImage (RGBA)
 * so it works with canvas ImageData in the browser and plain arrays in tests.
 *
 * These are intentionally dependency-free first-pass implementations. The
 * service interface (imageValidationService.ts) is where an OpenCV.js or
 * server-side implementation can be swapped in later.
 */

import type { PixelImage, Rect } from "../validation.types";

/** Rec.601 luma for one pixel index (index into the RGBA array / 4). */
export function lumaAt(image: PixelImage, pixelIndex: number): number {
  const i = pixelIndex * 4;
  return (
    0.299 * image.data[i]! + 0.587 * image.data[i + 1]! + 0.114 * image.data[i + 2]!
  );
}

/** Downsampled grayscale copy (single-channel Float32Array + dimensions). */
export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

export function toGray(image: PixelImage, maxDim = 512): GrayImage {
  const scale = Math.max(1, Math.ceil(Math.max(image.width, image.height) / maxDim));
  const width = Math.floor(image.width / scale);
  const height = Math.floor(image.height / scale);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x * scale;
      const srcY = y * scale;
      data[y * width + x] = lumaAt(image, srcY * image.width + srcX);
    }
  }
  return { width, height, data };
}

export interface LumaStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  /** Fraction of pixels with luma <= 8 (near black). */
  underexposedFraction: number;
  /** Fraction of pixels with luma >= 250 (blown out). */
  overexposedFraction: number;
}

export function lumaStats(gray: GrayImage, region?: Rect): LumaStats {
  const x0 = region ? Math.max(0, Math.floor(region.x)) : 0;
  const y0 = region ? Math.max(0, Math.floor(region.y)) : 0;
  const x1 = region ? Math.min(gray.width, Math.ceil(region.x + region.width)) : gray.width;
  const y1 = region ? Math.min(gray.height, Math.ceil(region.y + region.height)) : gray.height;

  let sum = 0;
  let sumSq = 0;
  let min = 255;
  let max = 0;
  let under = 0;
  let over = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = gray.data[y * gray.width + x]!;
      sum += v;
      sumSq += v * v;
      if (v < min) min = v;
      if (v > max) max = v;
      if (v <= 8) under++;
      if (v >= 250) over++;
      count++;
    }
  }
  if (count === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, underexposedFraction: 1, overexposedFraction: 0 };
  }
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return {
    mean,
    stdDev: Math.sqrt(variance),
    min,
    max,
    underexposedFraction: under / count,
    overexposedFraction: over / count,
  };
}

/**
 * Variance of the 3x3 Laplacian — the classic cheap focus measure. Higher is
 * sharper. Computed on the downsampled gray image, so thresholds must be
 * calibrated against the same pipeline (see docs/calibration.md).
 */
export function laplacianVariance(gray: GrayImage, region?: Rect): number {
  const x0 = region ? Math.max(1, Math.floor(region.x)) : 1;
  const y0 = region ? Math.max(1, Math.floor(region.y)) : 1;
  const x1 = region ? Math.min(gray.width - 1, Math.ceil(region.x + region.width)) : gray.width - 1;
  const y1 = region ? Math.min(gray.height - 1, Math.ceil(region.y + region.height)) : gray.height - 1;

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  const w = gray.width;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * w + x;
      const lap =
        4 * gray.data[idx]! -
        gray.data[idx - 1]! -
        gray.data[idx + 1]! -
        gray.data[idx - w]! -
        gray.data[idx + w]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/** Mean luma of a sub-rectangle expressed in fractional coordinates (0-1). */
export function regionMean(gray: GrayImage, fx: number, fy: number, fw: number, fh: number): number {
  return lumaStats(gray, {
    x: fx * gray.width,
    y: fy * gray.height,
    width: fw * gray.width,
    height: fh * gray.height,
  }).mean;
}
