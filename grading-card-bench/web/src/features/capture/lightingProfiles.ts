/**
 * Built-in lighting profiles. These ship as defaults; the admin panel can
 * clone/edit them and persist custom versions via the backend
 * (GET/POST /api/lighting-profiles). Profiles are pure data — export/import
 * as JSON is trivial.
 */

import type { LightingProfile } from "../rig/rig.types";

const WARM_WHITE = { r: 255, g: 245, b: 235 };
const PURE_WHITE = { r: 255, g: 255, b: 255 };

export const LIGHTING_PROFILES: LightingProfile[] = [
  {
    id: "all_off",
    name: "All Lights Off",
    description: "Turns off every LED zone.",
    globalBrightness: 0,
    purpose: ["safety", "idle"],
    zones: [],
  },
  {
    id: "diffuse_full_front",
    name: "Full Diffuse Front",
    description: "Balanced diffuse lighting for front card capture.",
    globalBrightness: 80,
    colorTemperatureHint: 5200,
    purpose: ["centering", "general_capture", "color_reference"],
    zones: [
      { zoneId: "ZONE_TOP_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 70 },
      { zoneId: "ZONE_BOTTOM_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 60 },
      { zoneId: "ZONE_LEFT_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 65 },
      { zoneId: "ZONE_RIGHT_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 65 },
      { zoneId: "ZONE_FRONT_FILL", enabled: true, rgb: WARM_WHITE, brightness: 50 },
    ],
  },
  {
    id: "diffuse_full_back",
    name: "Full Diffuse Back",
    description: "Balanced diffuse lighting for back card capture.",
    globalBrightness: 80,
    colorTemperatureHint: 5200,
    purpose: ["centering", "general_capture"],
    zones: [
      { zoneId: "ZONE_TOP_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 70 },
      { zoneId: "ZONE_BOTTOM_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 60 },
      { zoneId: "ZONE_LEFT_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 65 },
      { zoneId: "ZONE_RIGHT_DIFFUSE", enabled: true, rgb: WARM_WHITE, brightness: 65 },
      { zoneId: "ZONE_FRONT_FILL", enabled: true, rgb: WARM_WHITE, brightness: 50 },
    ],
  },
  {
    id: "raking_left",
    name: "Left Raking Light",
    description: "Low-angle light from left to reveal surface defects.",
    globalBrightness: 85,
    purpose: ["surface_detection", "scratches", "dents", "impressions"],
    zones: [{ zoneId: "ZONE_LEFT_RAKING", enabled: true, rgb: PURE_WHITE, brightness: 90 }],
  },
  {
    id: "raking_right",
    name: "Right Raking Light",
    description: "Low-angle light from right to reveal surface defects.",
    globalBrightness: 85,
    purpose: ["surface_detection", "scratches", "dents", "impressions"],
    zones: [{ zoneId: "ZONE_RIGHT_RAKING", enabled: true, rgb: PURE_WHITE, brightness: 90 }],
  },
  {
    id: "raking_top",
    name: "Top Raking Light",
    description: "Low-angle light from top for horizontal defects and waves.",
    globalBrightness: 85,
    purpose: ["surface_detection", "creases", "waves"],
    zones: [{ zoneId: "ZONE_TOP_RAKING", enabled: true, rgb: PURE_WHITE, brightness: 90 }],
  },
  {
    id: "raking_bottom",
    name: "Bottom Raking Light",
    description: "Low-angle light from bottom for lower-edge defects.",
    globalBrightness: 85,
    purpose: ["surface_detection", "creases", "waves"],
    zones: [{ zoneId: "ZONE_BOTTOM_RAKING", enabled: true, rgb: PURE_WHITE, brightness: 90 }],
  },
  {
    id: "surface_glare",
    name: "Controlled Surface Glare",
    description: "Creates controlled reflection across the card surface.",
    globalBrightness: 90,
    purpose: ["gloss_detection", "creases", "surface_waves", "foil_inspection"],
    zones: [
      { zoneId: "ZONE_SURFACE_GLARE", enabled: true, rgb: PURE_WHITE, brightness: 95 },
      { zoneId: "ZONE_TOP_RAKING", enabled: true, rgb: PURE_WHITE, brightness: 45 },
    ],
  },
  {
    id: "edge_lighting",
    name: "Edge Lighting",
    description: "Perimeter lighting for edge wear, whitening and layer separation.",
    globalBrightness: 85,
    purpose: ["edge_wear", "whitening", "layer_separation", "cut_quality"],
    zones: [
      { zoneId: "ZONE_EDGE_LEFT", enabled: true, rgb: PURE_WHITE, brightness: 85 },
      { zoneId: "ZONE_EDGE_RIGHT", enabled: true, rgb: PURE_WHITE, brightness: 85 },
      { zoneId: "ZONE_EDGE_TOP", enabled: true, rgb: PURE_WHITE, brightness: 85 },
      { zoneId: "ZONE_EDGE_BOTTOM", enabled: true, rgb: PURE_WHITE, brightness: 85 },
    ],
  },
  {
    id: "calibration_white",
    name: "Calibration White",
    description: "Even white field for white balance and exposure calibration.",
    globalBrightness: 70,
    purpose: ["white_balance", "exposure_calibration", "lens_calibration"],
    zones: [
      { zoneId: "ZONE_CALIBRATION_WHITE", enabled: true, rgb: PURE_WHITE, brightness: 80 },
      { zoneId: "ZONE_TOP_DIFFUSE", enabled: true, rgb: PURE_WHITE, brightness: 40 },
      { zoneId: "ZONE_BOTTOM_DIFFUSE", enabled: true, rgb: PURE_WHITE, brightness: 40 },
    ],
  },
];

export function getLightingProfile(id: string): LightingProfile | undefined {
  return LIGHTING_PROFILES.find((p) => p.id === id);
}

/**
 * Drop zones the connected rig doesn't have installed so a partially built
 * rig can still run every sequence (with reduced coverage).
 */
export function adaptProfileToCapabilities(
  profile: LightingProfile,
  installedZoneIds: Set<string>
): { profile: LightingProfile; droppedZoneIds: string[] } {
  const dropped = profile.zones.filter((z) => !installedZoneIds.has(z.zoneId));
  if (dropped.length === 0) return { profile, droppedZoneIds: [] };
  return {
    profile: { ...profile, zones: profile.zones.filter((z) => installedZoneIds.has(z.zoneId)) },
    droppedZoneIds: dropped.map((z) => z.zoneId),
  };
}
