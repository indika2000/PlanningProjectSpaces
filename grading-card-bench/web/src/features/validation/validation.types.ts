/**
 * Photo validation types. This layer decides "is the image good enough to
 * keep", NOT the final grading analysis.
 */

export interface ValidationCheck {
  passed: boolean;
  score?: number;
  value?: number | string | boolean;
  message?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardBounds extends Rect {
  /** 0-1 confidence that this really is the card. */
  confidence: number;
  /** Estimated rotation from the frame axes, degrees. */
  skewDegrees?: number;
}

export interface ImageValidationResult {
  passed: boolean;
  /** 0-100 aggregate quality score. */
  score: number;
  validationProfileId: string;
  checks: {
    resolution: ValidationCheck;
    brightness: ValidationCheck;
    contrast: ValidationCheck;
    sharpness: ValidationCheck;
    exposure: ValidationCheck;
    cardDetected: ValidationCheck;
    cardBounds: ValidationCheck;
    skew: ValidationCheck;
    clipping: ValidationCheck;
    lightingUniformity?: ValidationCheck;
    glare?: ValidationCheck;
    rakingExposure?: ValidationCheck;
  };
  cardBounds?: CardBounds;
  warnings: string[];
  errors: string[];
  /** Operator-friendly next step, e.g. "Reposition the card and retry." */
  suggestedAction?: string;
}

/**
 * Tunable thresholds for one kind of shot. Diffuse, raking and glare shots
 * have very different notions of "good".
 */
export interface ValidationProfile {
  id: string;
  name: string;
  minWidth: number;
  minHeight: number;
  /** Mean luma bounds (0-255). */
  brightnessMin: number;
  brightnessMax: number;
  /** Luma standard deviation minimum. */
  contrastMin: number;
  /** Variance-of-Laplacian minimum (higher = sharper). */
  sharpnessMin: number;
  /** Max fraction of pixels allowed at histogram extremes. */
  maxUnderexposedFraction: number;
  maxOverexposedFraction: number;
  card: {
    required: boolean;
    minAreaFraction: number;
    maxAreaFraction: number;
    /** Standard card ratio is 2.5x3.5 = 0.714; tolerance is +/- this. */
    aspectRatio: number;
    aspectRatioTolerance: number;
    maxSkewDegrees: number;
    /** Min distance from frame edge as a fraction of frame size. */
    minEdgeMarginFraction: number;
  };
  /** Only for diffuse profiles: max relative brightness imbalance (0-1). */
  maxUniformityImbalance?: number;
  /** Only for glare profiles: allowed fraction of blown-out pixels on card. */
  glare?: { minFraction: number; maxFraction: number };
  /** Only for raking profiles: minimum mean luma over the card region. */
  rakingMinCardBrightness?: number;
}

/**
 * Minimal pixel-image interface so validators run against browser ImageData
 * or plain objects in Node tests (and later against server-side OpenCV mats
 * behind an adapter).
 */
export interface PixelImage {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel — same layout as canvas ImageData. */
  data: Uint8ClampedArray;
}
