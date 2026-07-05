/**
 * Lighting test panel: per-zone toggles/sliders/colors plus one-click
 * lighting profile buttons and the test pattern cycle.
 */

import { useState } from "react";
import { rigClient } from "./rigClient";
import { LIGHTING_PROFILES } from "../capture/lightingProfiles";
import { useRigConnection } from "./useRigConnection";
import type { RgbColor } from "./rig.types";

function rgbToHex({ r, g, b }: RgbColor): string {
  const h = (v: number) => v.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function hexToRgb(hex: string): RgbColor {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

interface ZoneDraft {
  enabled: boolean;
  brightness: number;
  hex: string;
}

export function LightingTestPanel() {
  const { rig } = useRigConnection();
  const [drafts, setDrafts] = useState<Record<string, ZoneDraft>>({});
  const [error, setError] = useState<string>();

  const zones = rig.capabilities?.zones ?? [];

  const draftFor = (zoneId: string): ZoneDraft => {
    const live = rig.zones[zoneId];
    return (
      drafts[zoneId] ?? {
        enabled: live?.enabled ?? false,
        brightness: live?.brightness ?? 70,
        hex: live ? rgbToHex(live.rgb) : "#ffffff",
      }
    );
  };

  const updateDraft = (zoneId: string, patch: Partial<ZoneDraft>) => {
    setDrafts((d) => ({ ...d, [zoneId]: { ...draftFor(zoneId), ...patch } }));
  };

  const applyZone = async (zoneId: string, enabledOverride?: boolean) => {
    setError(undefined);
    const draft = draftFor(zoneId);
    const enabled = enabledOverride ?? draft.enabled;
    try {
      await rigClient.setZone(
        { zoneId, enabled, rgb: hexToRgb(draft.hex), brightness: draft.brightness },
        80
      );
      updateDraft(zoneId, { enabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const applyProfile = async (profileId: string) => {
    setError(undefined);
    try {
      if (profileId === "all_off") await rigClient.allOff();
      else await rigClient.applyLightingProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Lighting Test</h2>
        <span className="muted">Active: {rig.activeProfileId ?? "—"}</span>
      </header>

      {error && <p className="callout err">{error}</p>}

      <div className="profile-buttons">
        {LIGHTING_PROFILES.map((p) => (
          <button
            key={p.id}
            title={p.description}
            className={rig.activeProfileId === p.id ? "primary" : undefined}
            disabled={!rig.connected}
            onClick={() => void applyProfile(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button
          disabled={!rig.connected}
          onClick={() => void rigClient.runTestPattern(8000).catch((e) => setError(String(e)))}
        >
          Test pattern cycle
        </button>
      </div>

      <table className="zone-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>On</th>
            <th>Brightness</th>
            <th>Color</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => {
            const draft = draftFor(zone.zoneId);
            const live = rig.zones[zone.zoneId];
            return (
              <tr key={zone.zoneId} className={zone.installed ? undefined : "zone-missing"}>
                <td>
                  {zone.name}
                  {!zone.installed && <span className="muted"> (not installed)</span>}
                  {live?.enabled && <span className="dot-on" title="currently on" />}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    disabled={!zone.installed || !rig.connected}
                    onChange={(e) => {
                      updateDraft(zone.zoneId, { enabled: e.target.checked });
                      void applyZone(zone.zoneId, e.target.checked);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.brightness}
                    disabled={!zone.installed || !rig.connected}
                    onChange={(e) => updateDraft(zone.zoneId, { brightness: Number(e.target.value) })}
                    onMouseUp={() => draft.enabled && void applyZone(zone.zoneId)}
                    onTouchEnd={() => draft.enabled && void applyZone(zone.zoneId)}
                  />
                  <span className="muted"> {draft.brightness}</span>
                </td>
                <td>
                  <input
                    type="color"
                    value={draft.hex}
                    disabled={!zone.installed || !rig.connected}
                    onChange={(e) => updateDraft(zone.zoneId, { hex: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    disabled={!zone.installed || !rig.connected}
                    onClick={() => void applyZone(zone.zoneId, true)}
                  >
                    Test
                  </button>
                </td>
              </tr>
            );
          })}
          {zones.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Connect the rig to discover zones.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
