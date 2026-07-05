/**
 * Calibration panel: zone verification walk-through, exposure/white-balance
 * reference capture, lighting uniformity check, and calibration profile save.
 */

import { useState } from "react";
import { rigClient } from "./rigClient";
import { useRigConnection } from "./useRigConnection";
import type { CameraService } from "../camera/cameraService";
import { validateCapturedImage, getValidationProfile } from "../validation/imageValidationService";
import { toGray, regionMean } from "../validation/validators/pixelMath";

export interface RigCalibrationProfile {
  calibrationId: string;
  rigId?: string;
  cameraDeviceId?: string;
  createdAt: string;
  expectedCardAreaPercentage?: number;
  brightnessTarget?: number;
  whiteBalanceReference?: { r: number; g: number; b: number };
  zoneVerification: Record<string, boolean>;
  notes?: string;
}

const CALIBRATION_KEY = "gcb.calibration";

export function CalibrationPanel({ camera }: { camera: CameraService }) {
  const { rig } = useRigConnection();
  const [zoneResults, setZoneResults] = useState<Record<string, boolean>>({});
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [report, setReport] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const installedZones = (rig.capabilities?.zones ?? []).filter((z) => z.installed);

  const lightZone = async (zoneId: string) => {
    setError(undefined);
    try {
      await rigClient.allOff();
      await rigClient.setZone(
        { zoneId, enabled: true, rgb: { r: 255, g: 255, b: 255 }, brightness: 70 },
        100
      );
      setActiveZone(zoneId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmZone = (zoneId: string, ok: boolean) => {
    setZoneResults((r) => ({ ...r, [zoneId]: ok }));
    setActiveZone(null);
    void rigClient.allOff().catch(() => undefined);
  };

  const runExposureCheck = async () => {
    setError(undefined);
    setReport([]);
    try {
      await camera.ensureReady();
      await rigClient.applyLightingProfile("calibration_white");
      await new Promise((r) => setTimeout(r, 500));
      const frame = await camera.capture();
      const result = validateCapturedImage(frame.pixels, getValidationProfile("calibration"));
      const brightness = result.checks.brightness.value;
      const lines = [
        `Mean brightness: ${String(brightness)} (target 100-230)`,
        `Exposure: ${result.checks.exposure.passed ? "OK" : result.checks.exposure.message}`,
      ];
      if (result.checks.lightingUniformity) {
        lines.push(
          `Uniformity: ${result.checks.lightingUniformity.passed ? "OK" : result.checks.lightingUniformity.message} (${String(result.checks.lightingUniformity.value)})`
        );
      }
      setReport(lines);
      await rigClient.allOff();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runUniformityCheck = async () => {
    setError(undefined);
    setReport([]);
    try {
      await camera.ensureReady();
      await rigClient.applyLightingProfile("diffuse_full_front");
      await new Promise((r) => setTimeout(r, 500));
      const frame = await camera.capture();
      const gray = toGray(frame.pixels);
      const left = regionMean(gray, 0.05, 0.3, 0.25, 0.4);
      const right = regionMean(gray, 0.7, 0.3, 0.25, 0.4);
      const top = regionMean(gray, 0.3, 0.05, 0.4, 0.25);
      const bottom = regionMean(gray, 0.3, 0.7, 0.4, 0.25);
      setReport([
        `Left ${left.toFixed(0)} / Right ${right.toFixed(0)} — imbalance ${Math.abs(left - right).toFixed(0)}`,
        `Top ${top.toFixed(0)} / Bottom ${bottom.toFixed(0)} — imbalance ${Math.abs(top - bottom).toFixed(0)}`,
        Math.abs(left - right) > 30 || Math.abs(top - bottom) > 30
          ? "⚠ Lighting is noticeably uneven — check diffusers and zone brightness."
          : "✓ Uniformity looks acceptable.",
      ]);
      await rigClient.allOff();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveCalibration = () => {
    const profile: RigCalibrationProfile = {
      calibrationId: `cal_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      zoneVerification: zoneResults,
      notes: report.join("\n"),
    };
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(profile));
    setReport((r) => [...r, `Saved calibration profile ${profile.calibrationId}.`]);
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Calibration</h2>
      </header>

      {error && <p className="callout err">{error}</p>}

      <h3>Zone verification</h3>
      <p className="muted">
        Light each zone and confirm the correct physical area illuminates.
      </p>
      <ul className="zone-verify-list">
        {installedZones.map((zone) => (
          <li key={zone.zoneId}>
            <span>
              {zone.name}{" "}
              {zoneResults[zone.zoneId] === true && <span className="text-ok">✓ verified</span>}
              {zoneResults[zone.zoneId] === false && <span className="text-err">✗ wrong zone</span>}
            </span>
            {activeZone === zone.zoneId ? (
              <span className="row">
                <button className="primary" onClick={() => confirmZone(zone.zoneId, true)}>
                  Correct zone lit
                </button>
                <button className="danger" onClick={() => confirmZone(zone.zoneId, false)}>
                  Wrong / no light
                </button>
              </span>
            ) : (
              <button disabled={!rig.connected} onClick={() => void lightZone(zone.zoneId)}>
                Light it
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3>Checks</h3>
      <div className="row">
        <button disabled={!rig.connected} onClick={() => void runExposureCheck()}>
          Exposure / white reference
        </button>
        <button disabled={!rig.connected} onClick={() => void runUniformityCheck()}>
          Lighting uniformity
        </button>
        <button onClick={saveCalibration}>💾 Save calibration profile</button>
      </div>

      {report.length > 0 && (
        <pre className="report">{report.join("\n")}</pre>
      )}
    </section>
  );
}
