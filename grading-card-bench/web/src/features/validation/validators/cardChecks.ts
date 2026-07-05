/**
 * Card-geometry checks built on top of detectCardBounds: presence, area,
 * aspect ratio, position/clipping, skew.
 */

import type {
  CardBounds,
  PixelImage,
  ValidationCheck,
  ValidationProfile,
} from "../validation.types";

export function validateCardDetected(
  bounds: CardBounds | undefined,
  profile: ValidationProfile
): ValidationCheck {
  if (!profile.card.required) {
    return { passed: true, value: bounds ? "detected" : "not required" };
  }
  const passed = bounds !== undefined && bounds.confidence >= 0.5;
  return {
    passed,
    score: bounds ? Math.round(bounds.confidence * 100) : 0,
    value: bounds ? "detected" : "not detected",
    message: passed
      ? undefined
      : "No card detected in the frame. Check that a card is in the holder and the lights are on.",
  };
}

export function validateCardBoundsArea(
  bounds: CardBounds | undefined,
  image: PixelImage,
  profile: ValidationProfile
): ValidationCheck {
  if (!bounds) return { passed: !profile.card.required, value: "n/a" };
  const areaFraction = (bounds.width * bounds.height) / (image.width * image.height);
  const { minAreaFraction, maxAreaFraction, aspectRatio, aspectRatioTolerance } = profile.card;

  const areaOk = areaFraction >= minAreaFraction && areaFraction <= maxAreaFraction;
  const ratio = bounds.width / bounds.height;
  // Accept both portrait and landscape orientation of the card.
  const ratioOk =
    Math.abs(ratio - aspectRatio) <= aspectRatioTolerance ||
    Math.abs(ratio - 1 / aspectRatio) <= aspectRatioTolerance;

  let message: string | undefined;
  if (!areaOk) {
    message =
      areaFraction < minAreaFraction
        ? "The card looks too small in frame. Move the camera closer or check zoom."
        : "The card fills too much of the frame. Move the camera back so the full card and margin are visible.";
  } else if (!ratioOk) {
    message = `Detected shape has aspect ratio ${ratio.toFixed(2)}, which does not look like a trading card.`;
  }
  return {
    passed: areaOk && ratioOk,
    value: `area ${(areaFraction * 100).toFixed(1)}%, ratio ${ratio.toFixed(2)}`,
    message,
  };
}

export function validateClipping(
  bounds: CardBounds | undefined,
  image: PixelImage,
  profile: ValidationProfile
): ValidationCheck {
  if (!bounds) return { passed: !profile.card.required, value: "n/a" };
  const margin = profile.card.minEdgeMarginFraction;
  const marginX = image.width * margin;
  const marginY = image.height * margin;

  const clippedSides: string[] = [];
  if (bounds.x < marginX) clippedSides.push("left");
  if (bounds.y < marginY) clippedSides.push("top");
  if (bounds.x + bounds.width > image.width - marginX) clippedSides.push("right");
  if (bounds.y + bounds.height > image.height - marginY) clippedSides.push("bottom");

  const passed = clippedSides.length === 0;
  return {
    passed,
    value: passed ? "clear of edges" : clippedSides.join(", "),
    message: passed
      ? undefined
      : `The card was detected too close to the ${clippedSides.join(" and ")} edge. Please reposition the card and retry.`,
  };
}

export function validateSkew(
  bounds: CardBounds | undefined,
  profile: ValidationProfile
): ValidationCheck {
  if (!bounds || bounds.skewDegrees === undefined) {
    return { passed: true, value: "n/a" };
  }
  const passed = bounds.skewDegrees <= profile.card.maxSkewDegrees;
  return {
    passed,
    value: `${bounds.skewDegrees.toFixed(1)} deg`,
    message: passed
      ? undefined
      : `The card appears rotated about ${bounds.skewDegrees.toFixed(1)} degrees. Straighten it in the holder and retry.`,
  };
}
