/**
 * Card detection: finds the card-like bright rectangle against the (dark)
 * rig background using adaptive luma thresholding + largest-blob bounding box
 * via row/column projections.
 *
 * This is a deliberately simple, dependency-free first pass that works well
 * in a controlled light box (dark background, card roughly centered). For
 * contour-accurate corners and true perspective skew, swap in OpenCV.js
 * (minAreaRect on the largest contour) behind the same function signature.
 */

import type { CardBounds, PixelImage } from "../validation.types";
import { toGray, type GrayImage } from "./pixelMath";

export function detectCardBounds(image: PixelImage): CardBounds | undefined {
  const gray = toGray(image, 256);
  return detectCardBoundsGray(gray, image.width / gray.width);
}

export function detectCardBoundsGray(
  gray: GrayImage,
  scaleBack = 1
): CardBounds | undefined {
  // Adaptive threshold between background and card: Otsu-lite via mean of
  // extremes. In a light box the card is far brighter than the matte
  // background under every profile except full darkness.
  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.data.length; i++) {
    const v = gray.data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 20) return undefined; // flat image: nothing to find
  const threshold = min + (max - min) * 0.45;

  // Row/column projections of above-threshold pixel counts.
  const rowCounts = new Int32Array(gray.height);
  const colCounts = new Int32Array(gray.width);
  let total = 0;
  for (let y = 0; y < gray.height; y++) {
    for (let x = 0; x < gray.width; x++) {
      if (gray.data[y * gray.width + x]! > threshold) {
        rowCounts[y]!++;
        colCounts[x]!++;
        total++;
      }
    }
  }
  if (total < gray.width * gray.height * 0.01) return undefined;

  // Bounds = contiguous span where the projection exceeds 10% of its peak.
  const span = (counts: Int32Array): [number, number] | undefined => {
    let peak = 0;
    for (const c of counts) peak = Math.max(peak, c);
    const cutoff = peak * 0.1;
    let start = -1;
    let end = -1;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i]! > cutoff) {
        if (start < 0) start = i;
        end = i;
      }
    }
    return start >= 0 ? [start, end] : undefined;
  };

  const ySpan = span(rowCounts);
  const xSpan = span(colCounts);
  if (!ySpan || !xSpan) return undefined;

  const [x0, x1] = xSpan;
  const [y0, y1] = ySpan;
  const width = (x1 - x0 + 1) * scaleBack;
  const height = (y1 - y0 + 1) * scaleBack;

  // Confidence: how "filled" the bounding box is with bright pixels. A card
  // is a solid rectangle -> fill ratio near 1. Noise/streaks score low.
  const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1);
  const fillRatio = Math.min(1, total / boxArea);

  // Skew estimate: compare bright-pixel count in the four bounding-box
  // corners. A perfectly axis-aligned card fills its corners; a rotated card
  // leaves opposite corner pairs empty. This yields a rough degrees estimate.
  const skewDegrees = estimateSkew(gray, threshold, x0, y0, x1, y1);

  return {
    x: x0 * scaleBack,
    y: y0 * scaleBack,
    width,
    height,
    confidence: fillRatio,
    skewDegrees,
  };
}

function estimateSkew(
  gray: GrayImage,
  threshold: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const cw = Math.max(2, Math.floor((x1 - x0) * 0.18));
  const ch = Math.max(2, Math.floor((y1 - y0) * 0.18));
  const fill = (cx0: number, cy0: number): number => {
    let hit = 0;
    let n = 0;
    for (let y = cy0; y < cy0 + ch; y++) {
      for (let x = cx0; x < cx0 + cw; x++) {
        if (x < 0 || y < 0 || x >= gray.width || y >= gray.height) continue;
        n++;
        if (gray.data[y * gray.width + x]! > threshold) hit++;
      }
    }
    return n === 0 ? 0 : hit / n;
  };
  const tl = fill(x0, y0);
  const tr = fill(x1 - cw, y0);
  const bl = fill(x0, y1 - ch);
  const br = fill(x1 - cw, y1 - ch);
  // Rotation empties one diagonal pair. Convert missing fill to an angle
  // approximation: emptyFraction ~ tan(angle) * aspect ~ angle in radians for
  // small angles.
  const diagonalA = (tl + br) / 2;
  const diagonalB = (tr + bl) / 2;
  const imbalance = Math.abs(diagonalA - diagonalB);
  return Math.atan(imbalance) * (180 / Math.PI);
}
