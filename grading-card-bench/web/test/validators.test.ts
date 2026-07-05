/**
 * Unit tests for individual validators (the integration behavior is covered
 * in imageValidation.test.ts; these pin down each check's contract).
 */

import { describe, it, expect } from "vitest";
import type {
  CardBounds,
  PixelImage,
  ValidationProfile,
} from "../src/features/validation/validation.types";
import { getValidationProfile } from "../src/features/validation/imageValidationService";
import {
  validateResolution,
  validateBrightness,
  validateContrast,
  validateExposure,
} from "../src/features/validation/validators/basicChecks";
import {
  validateCardDetected,
  validateCardBoundsArea,
  validateClipping,
  validateSkew,
} from "../src/features/validation/validators/cardChecks";
import {
  validateLightingUniformity,
  validateGlareLevel,
  validateRakingExposure,
} from "../src/features/validation/validators/lightingChecks";
import { toGray, type LumaStats } from "../src/features/validation/validators/pixelMath";

const profile: ValidationProfile = getValidationProfile("standard_front");

function stats(overrides: Partial<LumaStats>): LumaStats {
  return {
    mean: 120,
    stdDev: 40,
    min: 0,
    max: 255,
    underexposedFraction: 0,
    overexposedFraction: 0,
    ...overrides,
  };
}

function fakeImage(width: number, height: number): PixelImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function bounds(overrides: Partial<CardBounds> = {}): CardBounds {
  // 500x700 card centered in a 1600x1200 frame (trading-card ratio 0.714).
  return { x: 550, y: 250, width: 500, height: 700, confidence: 0.9, skewDegrees: 1, ...overrides };
}

const frame = fakeImage(1600, 1200);

describe("validateResolution", () => {
  it("passes at and above the minimum", () => {
    expect(validateResolution(fakeImage(1280, 720), profile).passed).toBe(true);
    expect(validateResolution(fakeImage(1920, 1080), profile).passed).toBe(true);
  });
  it("fails below the minimum with dimensions in the message", () => {
    const check = validateResolution(fakeImage(640, 480), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toContain("640x480");
  });
});

describe("validateBrightness", () => {
  it("passes inside the band", () => {
    expect(validateBrightness(stats({ mean: 120 }), profile).passed).toBe(true);
  });
  it("fails dark with a rig-oriented hint", () => {
    const check = validateBrightness(stats({ mean: 10 }), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/too dark/i);
  });
  it("fails bright", () => {
    const check = validateBrightness(stats({ mean: 250 }), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/too bright/i);
  });
});

describe("validateContrast", () => {
  it("fails a flat image", () => {
    const check = validateContrast(stats({ stdDev: 2 }), profile);
    expect(check.passed).toBe(false);
  });
  it("passes normal contrast", () => {
    expect(validateContrast(stats({ stdDev: 45 }), profile).passed).toBe(true);
  });
});

describe("validateExposure", () => {
  it("fails heavy underexposure with percentage in message", () => {
    const check = validateExposure(stats({ underexposedFraction: 0.9 }), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/90%/);
  });
  it("fails heavy overexposure", () => {
    const check = validateExposure(stats({ overexposedFraction: 0.3 }), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/blown out/i);
  });
  it("respects per-profile tolerances (glare allows much more)", () => {
    const glare = getValidationProfile("glare_profile");
    expect(validateExposure(stats({ overexposedFraction: 0.3 }), glare).passed).toBe(true);
  });
});

describe("validateCardDetected", () => {
  it("passes with confident bounds", () => {
    expect(validateCardDetected(bounds(), profile).passed).toBe(true);
  });
  it("fails when nothing was detected", () => {
    const check = validateCardDetected(undefined, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/no card detected/i);
  });
  it("fails on low confidence", () => {
    expect(validateCardDetected(bounds({ confidence: 0.2 }), profile).passed).toBe(false);
  });
  it("passes when the profile does not require a card (calibration)", () => {
    const calibration = getValidationProfile("calibration");
    expect(validateCardDetected(undefined, calibration).passed).toBe(true);
  });
});

describe("validateCardBoundsArea", () => {
  it("accepts a normal card", () => {
    expect(validateCardBoundsArea(bounds(), frame, profile).passed).toBe(true);
  });
  it("accepts landscape orientation too", () => {
    expect(
      validateCardBoundsArea(bounds({ width: 700, height: 500 }), frame, profile).passed
    ).toBe(true);
  });
  it("rejects a too-small detection", () => {
    const check = validateCardBoundsArea(bounds({ width: 100, height: 140 }), frame, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/too small/i);
  });
  it("rejects a frame-filling detection", () => {
    const check = validateCardBoundsArea(
      bounds({ x: 10, y: 10, width: 1580, height: 1180 }),
      frame,
      profile
    );
    expect(check.passed).toBe(false);
  });
  it("rejects non-card aspect ratios", () => {
    const check = validateCardBoundsArea(bounds({ width: 700, height: 700 }), frame, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/aspect ratio/i);
  });
});

describe("validateClipping", () => {
  it("passes a centered card", () => {
    expect(validateClipping(bounds(), frame, profile).passed).toBe(true);
  });
  it("names every clipped side", () => {
    const check = validateClipping(bounds({ x: 0, y: 0 }), frame, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/left and top/i);
  });
  it("flags the right edge", () => {
    const check = validateClipping(bounds({ x: 1150 }), frame, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/right/i);
  });
});

describe("validateSkew", () => {
  it("passes small skew", () => {
    expect(validateSkew(bounds({ skewDegrees: 2 }), profile).passed).toBe(true);
  });
  it("fails past the profile threshold with degrees in the message", () => {
    const check = validateSkew(bounds({ skewDegrees: 12 }), profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/12\.0 degrees/);
  });
  it("passes when skew is unknown", () => {
    expect(validateSkew(bounds({ skewDegrees: undefined }), profile).passed).toBe(true);
  });
});

// ---- Lighting-specific checks on synthetic gray images -------------------------

function grayImageWithCard(cardLuma: (x: number, y: number) => number) {
  const width = 320;
  const height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  const card = { x: 110, y: 50, w: 100, h: 140 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inCard = x >= card.x && x < card.x + card.w && y >= card.y && y < card.y + card.h;
      const v = inCard ? cardLuma(x - card.x, y - card.y) : 15;
      const i = (y * width + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  const gray = toGray({ width, height, data });
  const cardBounds: CardBounds = { x: card.x, y: card.y, width: card.w, height: card.h, confidence: 0.9 };
  return { gray, cardBounds };
}

describe("validateLightingUniformity", () => {
  it("passes even lighting", () => {
    const { gray, cardBounds } = grayImageWithCard(() => 150);
    expect(validateLightingUniformity(gray, cardBounds, profile).passed).toBe(true);
  });
  it("fails a strong left/right falloff and names the dim quadrant", () => {
    const { gray, cardBounds } = grayImageWithCard((x) => (x < 50 ? 200 : 40));
    const check = validateLightingUniformity(gray, cardBounds, profile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/right/i);
  });
});

describe("validateGlareLevel", () => {
  const glareProfile = getValidationProfile("glare_profile");
  it("requires SOME reflection on a glare shot", () => {
    const { gray, cardBounds } = grayImageWithCard(() => 120); // no blown pixels
    const check = validateGlareLevel(gray, cardBounds, glareProfile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/found almost none/i);
  });
  it("accepts a controlled glare band", () => {
    const { gray, cardBounds } = grayImageWithCard((_x, y) => (y < 20 ? 255 : 120));
    expect(validateGlareLevel(gray, cardBounds, glareProfile).passed).toBe(true);
  });
  it("rejects a washed-out card", () => {
    const { gray, cardBounds } = grayImageWithCard(() => 255);
    const check = validateGlareLevel(gray, cardBounds, glareProfile);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/washing out/i);
  });
});

describe("validateRakingExposure", () => {
  const raking = getValidationProfile("surface_raking");
  it("passes a dim-but-usable raking shot", () => {
    const { gray, cardBounds } = grayImageWithCard(() => 50);
    expect(validateRakingExposure(gray, cardBounds, raking).passed).toBe(true);
  });
  it("fails a black raking shot", () => {
    const { gray, cardBounds } = grayImageWithCard(() => 5);
    const check = validateRakingExposure(gray, cardBounds, raking);
    expect(check.passed).toBe(false);
    expect(check.message).toMatch(/too dark/i);
  });
});
