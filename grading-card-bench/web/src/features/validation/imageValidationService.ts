/**
 * ImageValidationService — decides whether a captured photo is good enough to
 * keep, per validation profile (diffuse vs raking vs glare vs calibration).
 *
 * Design notes:
 *  - Implements the engine's ImageValidator interface, so it can be replaced
 *    by an OpenCV.js worker or a server-side service without touching the
 *    orchestrator.
 *  - All numeric thresholds live in VALIDATION_PROFILES and are expected to
 *    be tuned per rig during calibration (docs/calibration.md).
 */

import type {
  ImageValidationResult,
  PixelImage,
  ValidationCheck,
  ValidationProfile,
} from "./validation.types";
import { lumaStats } from "./validators/pixelMath";
import {
  computeImageStats,
  validateBrightness,
  validateContrast,
  validateExposure,
  validateResolution,
  validateSharpness,
} from "./validators/basicChecks";
import { detectCardBoundsGray } from "./validators/cardBoundsValidator";
import {
  validateCardBoundsArea,
  validateCardDetected,
  validateClipping,
  validateSkew,
} from "./validators/cardChecks";
import {
  validateGlareLevel,
  validateLightingUniformity,
  validateRakingExposure,
} from "./validators/lightingChecks";

const CARD_ASPECT = 2.5 / 3.5; // standard trading card, portrait

const BASE_CARD = {
  required: true,
  minAreaFraction: 0.12,
  maxAreaFraction: 0.85,
  aspectRatio: CARD_ASPECT,
  aspectRatioTolerance: 0.18,
  maxSkewDegrees: 5,
  minEdgeMarginFraction: 0.02,
};

export const VALIDATION_PROFILES: ValidationProfile[] = [
  {
    id: "standard_front",
    name: "Standard Diffuse (Front)",
    minWidth: 1280,
    minHeight: 720,
    brightnessMin: 60,
    brightnessMax: 210,
    contrastMin: 18,
    sharpnessMin: 60,
    maxUnderexposedFraction: 0.5,
    maxOverexposedFraction: 0.05,
    card: BASE_CARD,
    maxUniformityImbalance: 0.35,
  },
  {
    id: "standard_back",
    name: "Standard Diffuse (Back)",
    minWidth: 1280,
    minHeight: 720,
    brightnessMin: 60,
    brightnessMax: 210,
    contrastMin: 18,
    sharpnessMin: 60,
    maxUnderexposedFraction: 0.5,
    maxOverexposedFraction: 0.05,
    card: BASE_CARD,
    maxUniformityImbalance: 0.35,
  },
  {
    id: "surface_raking",
    name: "Surface Raking",
    minWidth: 1280,
    minHeight: 720,
    brightnessMin: 15, // raking shots are legitimately dark
    brightnessMax: 200,
    contrastMin: 12,
    sharpnessMin: 40,
    maxUnderexposedFraction: 0.85,
    maxOverexposedFraction: 0.1,
    card: { ...BASE_CARD, maxSkewDegrees: 8 },
    rakingMinCardBrightness: 25,
  },
  {
    id: "glare_profile",
    name: "Controlled Glare",
    minWidth: 1280,
    minHeight: 720,
    brightnessMin: 40,
    brightnessMax: 235,
    contrastMin: 15,
    sharpnessMin: 40,
    maxUnderexposedFraction: 0.6,
    maxOverexposedFraction: 0.45, // blown highlights are the point
    card: { ...BASE_CARD, maxSkewDegrees: 8 },
    glare: { minFraction: 0.01, maxFraction: 0.55 },
  },
  {
    id: "calibration",
    name: "Calibration Target",
    minWidth: 1280,
    minHeight: 720,
    brightnessMin: 100,
    brightnessMax: 230,
    contrastMin: 0,
    sharpnessMin: 0,
    maxUnderexposedFraction: 0.05,
    maxOverexposedFraction: 0.25,
    card: { ...BASE_CARD, required: false },
    maxUniformityImbalance: 0.2,
  },
];

export function getValidationProfile(id: string): ValidationProfile {
  const profile = VALIDATION_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Unknown validation profile: ${id}`);
  return profile;
}

export class ImageValidationService {
  async validate(
    pixels: PixelImage,
    validationProfileId: string
  ): Promise<ImageValidationResult> {
    const profile = getValidationProfile(validationProfileId);
    return validateCapturedImage(pixels, profile);
  }
}

export function validateCapturedImage(
  image: PixelImage,
  profile: ValidationProfile
): ImageValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Degenerate input guard: never throw on a bad frame.
  if (!image || image.width === 0 || image.height === 0 || image.data.length === 0) {
    return emptyFailure(profile, "No image data was captured. Check the camera connection.");
  }

  const { gray, stats } = computeImageStats(image);
  const scaleBack = image.width / gray.width;

  // Card detection runs in downsampled gray space; regions below use gray
  // coordinates, while the reported cardBounds are in full-image pixels.
  const grayBounds = detectCardBoundsGray(gray, 1);
  const cardBounds = grayBounds
    ? {
        ...grayBounds,
        x: grayBounds.x * scaleBack,
        y: grayBounds.y * scaleBack,
        width: grayBounds.width * scaleBack,
        height: grayBounds.height * scaleBack,
      }
    : undefined;
  const fullBounds = cardBounds
    ? { x: cardBounds.x, y: cardBounds.y, width: cardBounds.width, height: cardBounds.height }
    : undefined;

  // Brightness/contrast are judged over the card region when one is found:
  // the rig background is intentionally dark, so whole-frame means would fail
  // perfectly good shots. Exposure clipping stays whole-frame.
  const qualityStats = grayBounds ? lumaStats(gray, grayBounds) : stats;

  const checks: ImageValidationResult["checks"] = {
    resolution: validateResolution(image, profile),
    brightness: validateBrightness(qualityStats, profile),
    contrast: validateContrast(qualityStats, profile),
    sharpness: validateSharpness(gray, profile, grayBounds ?? undefined),
    exposure: validateExposure(stats, profile),
    cardDetected: validateCardDetected(cardBounds, profile),
    cardBounds: validateCardBoundsArea(
      cardBounds,
      { width: image.width, height: image.height, data: image.data },
      profile
    ),
    skew: validateSkew(cardBounds, profile),
    clipping: fullBounds
      ? validateClipping(cardBounds, image, profile)
      : { passed: !profile.card.required, value: "n/a" },
  };

  if (profile.maxUniformityImbalance !== undefined && grayBounds) {
    checks.lightingUniformity = validateLightingUniformity(gray, grayBounds, profile);
  }
  if (profile.glare && grayBounds) {
    checks.glare = validateGlareLevel(gray, grayBounds, profile);
  }
  if (profile.rakingMinCardBrightness !== undefined && grayBounds) {
    checks.rakingExposure = validateRakingExposure(gray, grayBounds, profile);
  }

  // Aggregate.
  const allChecks = Object.entries(checks).filter(
    (entry): entry is [string, ValidationCheck] => entry[1] !== undefined
  );
  const failed = allChecks.filter(([, c]) => !c.passed);
  for (const [, check] of failed) {
    if (check.message) errors.push(check.message);
  }
  for (const [, check] of allChecks) {
    if (check.passed && check.message) warnings.push(check.message);
  }

  const passed = failed.length === 0;
  const score = Math.round(
    (allChecks.filter(([, c]) => c.passed).length / allChecks.length) * 100
  );

  return {
    passed,
    score,
    validationProfileId: profile.id,
    checks,
    cardBounds,
    warnings,
    errors,
    suggestedAction: failed[0]?.[1].message,
  };
}

function emptyFailure(profile: ValidationProfile, message: string): ImageValidationResult {
  const fail: ValidationCheck = { passed: false, message };
  const na: ValidationCheck = { passed: false, value: "n/a" };
  return {
    passed: false,
    score: 0,
    validationProfileId: profile.id,
    checks: {
      resolution: fail,
      brightness: na,
      contrast: na,
      sharpness: na,
      exposure: na,
      cardDetected: na,
      cardBounds: na,
      skew: na,
      clipping: na,
    },
    warnings: [],
    errors: [message],
    suggestedAction: message,
  };
}
