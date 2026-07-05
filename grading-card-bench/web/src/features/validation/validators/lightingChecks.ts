/**
 * Lighting-specific checks: diffuse uniformity, glare level, raking exposure.
 */

import type {
  CardBounds,
  ValidationCheck,
  ValidationProfile,
  PixelImage,
} from "../validation.types";
import { toGray, lumaStats, type GrayImage } from "./pixelMath";

/**
 * Diffuse shots: brightness over the card should be even. We compare the
 * mean luma of the card's four quadrants and report the worst imbalance.
 */
export function validateLightingUniformity(
  gray: GrayImage,
  bounds: CardBounds,
  profile: ValidationProfile
): ValidationCheck {
  const maxImbalance = profile.maxUniformityImbalance ?? 0.35;
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;
  const quadrant = (dx: number, dy: number) =>
    lumaStats(gray, {
      x: bounds.x + dx * halfW,
      y: bounds.y + dy * halfH,
      width: halfW,
      height: halfH,
    }).mean;

  const means = [quadrant(0, 0), quadrant(1, 0), quadrant(0, 1), quadrant(1, 1)];
  const maxMean = Math.max(...means);
  const minMean = Math.min(...means);
  const imbalance = maxMean === 0 ? 1 : (maxMean - minMean) / maxMean;

  const labels = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const dimmest = labels[means.indexOf(minMean)];
  const passed = imbalance <= maxImbalance;
  return {
    passed,
    score: Math.round((1 - imbalance) * 100),
    value: `${(imbalance * 100).toFixed(0)}% imbalance`,
    message: passed
      ? undefined
      : `Lighting is uneven — the ${dimmest} of the card is noticeably dimmer. Check the LED zones and diffusers.`,
  };
}

/**
 * Glare shots: controlled reflection is EXPECTED, but the card must not be
 * washed out. We measure the fraction of blown-out pixels within the card.
 */
export function validateGlareLevel(
  gray: GrayImage,
  bounds: CardBounds,
  profile: ValidationProfile
): ValidationCheck {
  const limits = profile.glare ?? { minFraction: 0.02, maxFraction: 0.6 };
  const stats = lumaStats(gray, bounds);
  const glareFraction = stats.overexposedFraction;
  let message: string | undefined;
  if (glareFraction < limits.minFraction) {
    message =
      "Expected a visible reflection band but found almost none. Check the glare zone LEDs.";
  } else if (glareFraction > limits.maxFraction) {
    message =
      "Glare is washing out the card. Reduce glare-zone brightness or check card position.";
  }
  return {
    passed: message === undefined,
    value: `${(glareFraction * 100).toFixed(1)}% blown out`,
    message,
  };
}

/**
 * Raking shots: heavy shadows are fine, but the card surface must still carry
 * usable signal — enforce a minimum mean brightness over the card region.
 */
export function validateRakingExposure(
  gray: GrayImage,
  bounds: CardBounds,
  profile: ValidationProfile
): ValidationCheck {
  const minBrightness = profile.rakingMinCardBrightness ?? 25;
  const stats = lumaStats(gray, bounds);
  const passed = stats.mean >= minBrightness;
  return {
    passed,
    value: Math.round(stats.mean),
    message: passed
      ? undefined
      : "The raking shot is too dark to show surface detail. Check the raking zone LEDs and increase brightness.",
  };
}

/** Convenience for callers that have PixelImage but no gray copy yet. */
export function grayOf(image: PixelImage): GrayImage {
  return toGray(image);
}
