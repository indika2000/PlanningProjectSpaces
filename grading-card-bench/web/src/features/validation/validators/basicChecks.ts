/**
 * Basic image quality checks: resolution, brightness, contrast, sharpness,
 * exposure clipping. Each returns a ValidationCheck with a human-readable
 * message the operator sees directly.
 */

import type { ValidationCheck, ValidationProfile, PixelImage, Rect } from "../validation.types";
import { toGray, lumaStats, laplacianVariance, type GrayImage, type LumaStats } from "./pixelMath";

export function validateResolution(
  image: PixelImage,
  profile: ValidationProfile
): ValidationCheck {
  const passed = image.width >= profile.minWidth && image.height >= profile.minHeight;
  return {
    passed,
    value: `${image.width}x${image.height}`,
    message: passed
      ? undefined
      : `Image is ${image.width}x${image.height}; minimum is ${profile.minWidth}x${profile.minHeight}. Check camera resolution settings.`,
  };
}

export function validateBrightness(
  stats: LumaStats,
  profile: ValidationProfile
): ValidationCheck {
  const { mean } = stats;
  const passed = mean >= profile.brightnessMin && mean <= profile.brightnessMax;
  let message: string | undefined;
  if (mean < profile.brightnessMin) {
    message = "The image is too dark. Check that the lighting profile applied and the rig is powered.";
  } else if (mean > profile.brightnessMax) {
    message = "The image is too bright. Reduce brightness or check for stray light.";
  }
  return {
    passed,
    score: Math.round(mean),
    value: Math.round(mean),
    message,
  };
}

export function validateContrast(
  stats: LumaStats,
  profile: ValidationProfile
): ValidationCheck {
  const passed = stats.stdDev >= profile.contrastMin;
  return {
    passed,
    score: Math.round(stats.stdDev),
    value: Math.round(stats.stdDev),
    message: passed
      ? undefined
      : "Image contrast is very low — the frame may be empty, fogged, or the lights may be off.",
  };
}

export function validateSharpness(
  gray: GrayImage,
  profile: ValidationProfile,
  cardRegion?: Rect
): ValidationCheck {
  const variance = laplacianVariance(gray, cardRegion);
  const passed = variance >= profile.sharpnessMin;
  return {
    passed,
    score: Math.round(variance),
    value: Math.round(variance),
    message: passed
      ? undefined
      : "The image appears blurry. Check camera focus or reduce vibration, then retry.",
  };
}

export function validateExposure(
  stats: LumaStats,
  profile: ValidationProfile
): ValidationCheck {
  const underOk = stats.underexposedFraction <= profile.maxUnderexposedFraction;
  const overOk = stats.overexposedFraction <= profile.maxOverexposedFraction;
  let message: string | undefined;
  if (!underOk) {
    message = `${Math.round(stats.underexposedFraction * 100)}% of the frame is crushed black — heavily underexposed.`;
  } else if (!overOk) {
    message = `${Math.round(stats.overexposedFraction * 100)}% of the frame is blown out — heavily overexposed.`;
  }
  return {
    passed: underOk && overOk,
    value: `under ${(stats.underexposedFraction * 100).toFixed(1)}% / over ${(stats.overexposedFraction * 100).toFixed(1)}%`,
    message,
  };
}

/** Convenience wrapper producing gray + stats once for all basic checks. */
export function computeImageStats(image: PixelImage): { gray: GrayImage; stats: LumaStats } {
  const gray = toGray(image);
  return { gray, stats: lumaStats(gray) };
}
