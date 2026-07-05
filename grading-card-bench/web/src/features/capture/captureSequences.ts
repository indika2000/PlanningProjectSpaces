/**
 * Built-in capture sequences. A sequence is pure data; the engine
 * (captureSequenceEngine.ts) executes it. Custom sequences can be stored via
 * the backend (/api/capture-sequences) and merged with these defaults.
 */

import type { CaptureSequenceDefinition, CaptureStep } from "./capture.types";

export const DEFAULT_CARD_CAPTURE_SEQUENCE: CaptureStep[] = [
  {
    id: "front_diffuse",
    name: "Front - Diffuse Light",
    side: "front",
    lightingProfileId: "diffuse_full_front",
    required: true,
    description:
      "Balanced front image for centering, geometry, color, and general condition.",
    expectedUse: [
      "centering",
      "border_detection",
      "corner_detection",
      "edge_detection",
      "color_reference",
    ],
    settleTimeMs: 300,
    validationProfileId: "standard_front",
    maxRetries: 2,
  },
  {
    id: "front_left_raking",
    name: "Front - Left Raking Light",
    side: "front",
    lightingProfileId: "raking_left",
    required: true,
    description: "Low-angle light from left to reveal surface defects.",
    expectedUse: ["surface_scratches", "dents", "impressions", "foil_texture"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
  {
    id: "front_right_raking",
    name: "Front - Right Raking Light",
    side: "front",
    lightingProfileId: "raking_right",
    required: true,
    description: "Low-angle light from right to reveal surface defects.",
    expectedUse: ["surface_scratches", "dents", "impressions", "foil_texture"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
  {
    id: "front_top_raking",
    name: "Front - Top Raking Light",
    side: "front",
    lightingProfileId: "raking_top",
    required: false,
    description:
      "Low-angle light from top to reveal vertical scratches and surface waves.",
    expectedUse: ["surface_scratches", "creases", "waves"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
  {
    id: "front_bottom_raking",
    name: "Front - Bottom Raking Light",
    side: "front",
    lightingProfileId: "raking_bottom",
    required: false,
    description:
      "Low-angle light from bottom to reveal vertical scratches and lower-edge defects.",
    expectedUse: ["surface_scratches", "creases", "waves"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
  {
    id: "front_glare",
    name: "Front - Controlled Glare",
    side: "front",
    lightingProfileId: "surface_glare",
    required: true,
    description:
      "Reflection-heavy image to reveal gloss problems, bends, creases, and surface texture.",
    expectedUse: ["gloss", "surface_waves", "creases", "foil_reflection"],
    settleTimeMs: 400,
    validationProfileId: "glare_profile",
    maxRetries: 2,
  },
  {
    id: "back_diffuse",
    name: "Back - Diffuse Light",
    side: "back",
    lightingProfileId: "diffuse_full_back",
    required: true,
    description:
      "Balanced back image for centering, border detection, corners, and edge condition.",
    expectedUse: ["centering", "border_detection", "corner_detection", "edge_detection"],
    settleTimeMs: 300,
    validationProfileId: "standard_back",
    maxRetries: 2,
  },
  {
    id: "back_left_raking",
    name: "Back - Left Raking Light",
    side: "back",
    lightingProfileId: "raking_left",
    required: true,
    description: "Back surface inspection using left-side low-angle lighting.",
    expectedUse: ["surface_scratches", "dents", "impressions"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
  {
    id: "back_right_raking",
    name: "Back - Right Raking Light",
    side: "back",
    lightingProfileId: "raking_right",
    required: true,
    description: "Back surface inspection using right-side low-angle lighting.",
    expectedUse: ["surface_scratches", "dents", "impressions"],
    settleTimeMs: 300,
    validationProfileId: "surface_raking",
    maxRetries: 2,
  },
];

export const CAPTURE_SEQUENCES: CaptureSequenceDefinition[] = [
  {
    id: "default_card_v1",
    name: "Standard Card Diagnostic Set",
    description:
      "Front + back diffuse, four-direction raking, and controlled glare. The default diagnostic set for raw cards.",
    steps: DEFAULT_CARD_CAPTURE_SEQUENCE,
    version: 1,
  },
];

export function getCaptureSequence(id: string): CaptureSequenceDefinition | undefined {
  return CAPTURE_SEQUENCES.find((s) => s.id === id);
}

/** The step index where the card side changes (used for the flip prompt). */
export function firstStepIndexOfSide(
  steps: CaptureStep[],
  side: CaptureStep["side"]
): number {
  return steps.findIndex((s) => s.side === side);
}
