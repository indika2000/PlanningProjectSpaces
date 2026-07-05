/**
 * RigControlPage — the Capture Bench. Tabs: Capture, Lighting, Calibration,
 * Diagnostics log. The connection panel is always visible (safety controls
 * must never be hidden behind a tab).
 */

import { useState } from "react";
import { RigConnectionPanel } from "./RigConnectionPanel";
import { LightingTestPanel } from "./LightingTestPanel";
import { CaptureSequencePanel } from "./CaptureSequencePanel";
import { ImageReviewPanel } from "./ImageReviewPanel";
import { CalibrationPanel } from "./CalibrationPanel";
import { useCaptureSequence } from "../capture/useCaptureSequence";
import { useRigConnection } from "./useRigConnection";

type Tab = "capture" | "lighting" | "calibration" | "log";

export function RigControlPage() {
  const [tab, setTab] = useState<Tab>("capture");
  const capture = useCaptureSequence();
  const { rig } = useRigConnection();

  return (
    <div className="rig-control-page">
      <RigConnectionPanel />

      <nav className="tabs">
        {(
          [
            ["capture", "Capture Bench"],
            ["lighting", "Lighting Test"],
            ["calibration", "Calibration"],
            ["log", "Diagnostics"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "capture" && (
        <div className="two-col">
          <CaptureSequencePanel capture={capture} />
          <ImageReviewPanel capture={capture} />
        </div>
      )}
      {tab === "lighting" && <LightingTestPanel />}
      {tab === "calibration" && <CalibrationPanel camera={capture.camera} />}
      {tab === "log" && (
        <section className="panel">
          <header className="panel-header">
            <h2>Diagnostics Log</h2>
          </header>
          <pre className="report log-view">
            {rig.logs
              .map((l) => `${l.at.slice(11, 19)} [${l.level.toUpperCase()}] ${l.message}`)
              .join("\n") || "No log entries yet."}
          </pre>
        </section>
      )}
    </div>
  );
}
