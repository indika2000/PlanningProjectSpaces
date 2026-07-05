import { describe, it, expect } from "vitest";
import {
  LIGHTING_PROFILES,
  getLightingProfile,
  adaptProfileToCapabilities,
} from "../src/features/capture/lightingProfiles";

describe("lighting profile catalog integrity", () => {
  it("has unique ids", () => {
    const ids = LIGHTING_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every value in protocol range", () => {
    for (const profile of LIGHTING_PROFILES) {
      expect(profile.globalBrightness, profile.id).toBeGreaterThanOrEqual(0);
      expect(profile.globalBrightness, profile.id).toBeLessThanOrEqual(100);
      for (const zone of profile.zones) {
        expect(zone.brightness, `${profile.id}/${zone.zoneId}`).toBeGreaterThanOrEqual(0);
        expect(zone.brightness, `${profile.id}/${zone.zoneId}`).toBeLessThanOrEqual(100);
        for (const channel of [zone.rgb.r, zone.rgb.g, zone.rgb.b]) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it("only references well-known zone ids", () => {
    const knownPrefixes = ["ZONE_"];
    for (const profile of LIGHTING_PROFILES) {
      for (const zone of profile.zones) {
        expect(
          knownPrefixes.some((prefix) => zone.zoneId.startsWith(prefix)),
          `${profile.id} references ${zone.zoneId}`
        ).toBe(true);
      }
    }
  });

  it("all_off has no zones and zero brightness", () => {
    const allOff = getLightingProfile("all_off")!;
    expect(allOff.zones).toHaveLength(0);
    expect(allOff.globalBrightness).toBe(0);
  });

  it("includes the schematic's shot profiles (D1 diffuse, R1-R4 raking, specular)", () => {
    for (const id of [
      "diffuse_full_front",
      "diffuse_full_back",
      "raking_top",
      "raking_right",
      "raking_bottom",
      "raking_left",
      "surface_glare",
      "calibration_white",
    ]) {
      expect(getLightingProfile(id), id).toBeDefined();
    }
  });

  it("raking profiles light exactly one raking zone", () => {
    for (const dir of ["left", "right", "top", "bottom"]) {
      const profile = getLightingProfile(`raking_${dir}`)!;
      expect(profile.zones).toHaveLength(1);
      expect(profile.zones[0]!.zoneId).toContain(dir.toUpperCase());
    }
  });
});

describe("adaptProfileToCapabilities", () => {
  const profile = getLightingProfile("diffuse_full_front")!;

  it("returns the profile unchanged when all zones are installed", () => {
    const installed = new Set(profile.zones.map((z) => z.zoneId));
    const result = adaptProfileToCapabilities(profile, installed);
    expect(result.droppedZoneIds).toEqual([]);
    expect(result.profile).toBe(profile);
  });

  it("drops uninstalled zones and reports them", () => {
    const installed = new Set([profile.zones[0]!.zoneId]);
    const result = adaptProfileToCapabilities(profile, installed);
    expect(result.profile.zones).toHaveLength(1);
    expect(result.droppedZoneIds).toHaveLength(profile.zones.length - 1);
    // Original catalog object must not be mutated.
    expect(profile.zones.length).toBeGreaterThan(1);
  });

  it("can drop everything (rig with none of the profile's zones)", () => {
    const result = adaptProfileToCapabilities(profile, new Set(["ZONE_SOMETHING_ELSE"]));
    expect(result.profile.zones).toHaveLength(0);
    expect(result.droppedZoneIds).toHaveLength(profile.zones.length);
  });
});
