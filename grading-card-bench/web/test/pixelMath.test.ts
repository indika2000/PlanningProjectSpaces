import { describe, it, expect } from "vitest";
import {
  lumaAt,
  toGray,
  lumaStats,
  laplacianVariance,
  regionMean,
} from "../src/features/validation/validators/pixelMath";
import type { PixelImage } from "../src/features/validation/validation.types";

function rgbaImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("lumaAt", () => {
  it("uses Rec.601 weights", () => {
    const img = rgbaImage(1, 1, () => [255, 0, 0]);
    expect(lumaAt(img, 0)).toBeCloseTo(0.299 * 255, 3);
    const green = rgbaImage(1, 1, () => [0, 255, 0]);
    expect(lumaAt(green, 0)).toBeCloseTo(0.587 * 255, 3);
    const white = rgbaImage(1, 1, () => [255, 255, 255]);
    expect(lumaAt(white, 0)).toBeCloseTo(255, 3);
  });
});

describe("toGray", () => {
  it("keeps small images at full resolution", () => {
    const gray = toGray(rgbaImage(100, 60, () => [128, 128, 128]));
    expect(gray.width).toBe(100);
    expect(gray.height).toBe(60);
    expect(gray.data[0]).toBeCloseTo(128, 0);
  });

  it("downsamples large images below the max dimension", () => {
    const gray = toGray(rgbaImage(2048, 1024, () => [50, 50, 50]), 512);
    expect(Math.max(gray.width, gray.height)).toBeLessThanOrEqual(512);
    // Aspect ratio roughly preserved.
    expect(gray.width / gray.height).toBeCloseTo(2, 1);
  });
});

describe("lumaStats", () => {
  it("computes mean/stddev/extremes on a known pattern", () => {
    // Half image at 100, half at 200 -> mean 150, stdDev 50.
    const img = rgbaImage(10, 10, (x) => (x < 5 ? [100, 100, 100] : [200, 200, 200]));
    const stats = lumaStats(toGray(img));
    expect(stats.mean).toBeCloseTo(150, 0);
    expect(stats.stdDev).toBeCloseTo(50, 0);
    expect(stats.min).toBeCloseTo(100, 0);
    expect(stats.max).toBeCloseTo(200, 0);
  });

  it("counts under/over exposed fractions", () => {
    const img = rgbaImage(10, 10, (x) => (x < 2 ? [0, 0, 0] : x >= 8 ? [255, 255, 255] : [128, 128, 128]));
    const stats = lumaStats(toGray(img));
    expect(stats.underexposedFraction).toBeCloseTo(0.2, 2);
    expect(stats.overexposedFraction).toBeCloseTo(0.2, 2);
  });

  it("restricts to a region when given one", () => {
    const img = rgbaImage(10, 10, (x) => (x < 5 ? [10, 10, 10] : [250, 250, 250]));
    const gray = toGray(img);
    const left = lumaStats(gray, { x: 0, y: 0, width: 5, height: 10 });
    const right = lumaStats(gray, { x: 5, y: 0, width: 5, height: 10 });
    expect(left.mean).toBeCloseTo(10, 0);
    expect(right.mean).toBeCloseTo(250, 0);
  });

  it("handles empty regions safely", () => {
    const gray = toGray(rgbaImage(4, 4, () => [100, 100, 100]));
    const stats = lumaStats(gray, { x: 100, y: 100, width: 5, height: 5 });
    expect(stats.mean).toBe(0);
    expect(stats.underexposedFraction).toBe(1);
  });
});

describe("laplacianVariance (focus measure)", () => {
  it("scores a high-frequency pattern far above a flat field", () => {
    const flat = toGray(rgbaImage(64, 64, () => [128, 128, 128]));
    const checker = toGray(
      rgbaImage(64, 64, (x, y) => ((x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0]))
    );
    const flatScore = laplacianVariance(flat);
    const checkerScore = laplacianVariance(checker);
    expect(flatScore).toBeCloseTo(0, 1);
    expect(checkerScore).toBeGreaterThan(flatScore + 1000);
  });

  it("a soft gradient scores lower than a hard edge pattern", () => {
    const gradient = toGray(rgbaImage(64, 64, (x) => [x * 4, x * 4, x * 4]));
    const stripes = toGray(
      rgbaImage(64, 64, (x) => (x % 4 === 0 ? [255, 255, 255] : [0, 0, 0]))
    );
    expect(laplacianVariance(stripes)).toBeGreaterThan(laplacianVariance(gradient) * 10);
  });
});

describe("regionMean", () => {
  it("reads fractional regions", () => {
    const img = rgbaImage(100, 100, (x, y) => (x < 50 && y < 50 ? [200, 200, 200] : [20, 20, 20]));
    const gray = toGray(img);
    expect(regionMean(gray, 0, 0, 0.5, 0.5)).toBeCloseTo(200, 0);
    expect(regionMean(gray, 0.5, 0.5, 0.5, 0.5)).toBeCloseTo(20, 0);
  });
});
