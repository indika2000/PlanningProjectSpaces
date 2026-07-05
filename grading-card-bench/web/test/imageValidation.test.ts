import { describe, it, expect } from "vitest";
import { validateCapturedImage, getValidationProfile } from "../src/features/validation/imageValidationService";
import { detectCardBounds } from "../src/features/validation/validators/cardBoundsValidator";
import type { PixelImage } from "../src/features/validation/validation.types";

// ---- Synthetic image builders --------------------------------------------------

function solidImage(width: number, height: number, luma: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = luma;
    data[i * 4 + 1] = luma;
    data[i * 4 + 2] = luma;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Dark background with a bright, textured "card" rectangle. */
function cardImage(
  width = 1600,
  height = 1200,
  card: { x: number; y: number; w: number; h: number } = {
    x: 480, y: 250, w: 640, h: 700, // ~0.91 ratio? adjust: card 500x700 -> use 500
  }
): PixelImage {
  const img = solidImage(width, height, 20);
  for (let y = card.y; y < card.y + card.h; y++) {
    for (let x = card.x; x < card.x + card.w; x++) {
      const i = (y * width + x) * 4;
      // Texture: checkerboard-ish noise so sharpness/contrast are realistic.
      const texture = ((x >> 3) + (y >> 3)) % 2 === 0 ? 170 : 120;
      const speckle = (x * 31 + y * 17) % 13 === 0 ? 60 : 0;
      const v = texture + speckle;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  return img;
}

const CARD = { x: 550, y: 250, w: 500, h: 700 }; // aspect 0.714 = trading card

describe("detectCardBounds", () => {
  it("finds the card rectangle on a dark background", () => {
    const bounds = detectCardBounds(cardImage(1600, 1200, CARD));
    expect(bounds).toBeDefined();
    expect(bounds!.x).toBeGreaterThan(CARD.x - 60);
    expect(bounds!.x).toBeLessThan(CARD.x + 60);
    expect(bounds!.width).toBeGreaterThan(CARD.w * 0.85);
    expect(bounds!.width).toBeLessThan(CARD.w * 1.15);
    expect(bounds!.confidence).toBeGreaterThan(0.7);
  });

  it("returns undefined for a flat/empty frame", () => {
    expect(detectCardBounds(solidImage(640, 480, 20))).toBeUndefined();
  });
});

describe("validateCapturedImage", () => {
  const profile = getValidationProfile("standard_front");

  it("passes a good diffuse card image", () => {
    const result = validateCapturedImage(cardImage(1600, 1200, CARD), profile);
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.cardBounds).toBeDefined();
  });

  it("fails an all-black frame with an operator-friendly message", () => {
    const result = validateCapturedImage(solidImage(1600, 1200, 2), profile);
    expect(result.passed).toBe(false);
    expect(result.checks.brightness.passed).toBe(false);
    expect(result.suggestedAction).toBeTruthy();
  });

  it("fails an all-white (blown out) frame", () => {
    const result = validateCapturedImage(solidImage(1600, 1200, 254), profile);
    expect(result.passed).toBe(false);
    expect(result.checks.exposure.passed).toBe(false);
  });

  it("fails when resolution is below minimum", () => {
    const result = validateCapturedImage(cardImage(640, 480, { x: 220, y: 100, w: 200, h: 280 }), profile);
    expect(result.checks.resolution.passed).toBe(false);
  });

  it("fails when the card is clipped at the frame edge", () => {
    const clipped = cardImage(1600, 1200, { x: 0, y: 250, w: 500, h: 700 });
    const result = validateCapturedImage(clipped, profile);
    expect(result.checks.clipping.passed).toBe(false);
    expect(result.errors.join(" ")).toMatch(/left edge/i);
  });

  it("fails when no card is present but required", () => {
    // Bright uniform noise, no card-like rect: use small bright blob.
    const img = solidImage(1600, 1200, 20);
    const result = validateCapturedImage(img, profile);
    expect(result.checks.cardDetected.passed).toBe(false);
  });

  it("raking profile tolerates a dark frame as long as the card is detectable", () => {
    const raking = getValidationProfile("surface_raking");
    // Dim card (mean ~ 45) on near-black background.
    const img = solidImage(1600, 1200, 3);
    for (let y = CARD.y; y < CARD.y + CARD.h; y++) {
      for (let x = CARD.x; x < CARD.x + CARD.w; x++) {
        const i = (y * 1600 + x) * 4;
        const v = ((x >> 3) + (y >> 3)) % 2 === 0 ? 60 : 38;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      }
    }
    const result = validateCapturedImage(img, raking);
    expect(result.checks.cardDetected.passed).toBe(true);
    expect(result.checks.rakingExposure?.passed).toBe(true);
  });

  it("handles a zero-size image without throwing", () => {
    const result = validateCapturedImage(
      { width: 0, height: 0, data: new Uint8ClampedArray(0) },
      profile
    );
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toMatch(/no image data/i);
  });
});
