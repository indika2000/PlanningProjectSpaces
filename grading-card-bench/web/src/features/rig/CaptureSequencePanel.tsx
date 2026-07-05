/**
 * Capture Sequence panel — the "take photos for grading" workflow.
 * Shows step progress, live operator narration, flip prompt, validation
 * failures with operator decisions, and manual capture.
 */

import { useState } from "react";
import type { UseCaptureSequence } from "../capture/useCaptureSequence";
import type { CaptureStepRuntimeState } from "../capture/capture.types";
import { LIGHTING_PROFILES } from "../capture/lightingProfiles";
import { CameraPreview } from "../camera/CameraPreview";
import { useRigConnection } from "./useRigConnection";

const STEP_ICONS: Record<CaptureStepRuntimeState["status"], string> = {
  pending: "○",
  lighting: "💡",
  settling: "⏳",
  capturing: "📸",
  validating: "🔍",
  accepted: "✅",
  failed: "❌",
  skipped: "⤼",
  awaiting_operator: "⚠️",
};

export function CaptureSequencePanel({ capture }: { capture: UseCaptureSequence }) {
  const { rig } = useRigConnection();
  const { session } = capture;
  const [cardId, setCardId] = useState("");
  const [manualProfile, setManualProfile] = useState("diffuse_full_front");

  const running =
    session &&
    ["capturing", "paused", "awaiting_flip", "awaiting_operator"].includes(session.status);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Capture Sequence</h2>
        {session && <span className={`status-pill ${statusTone(session.status)}`}>{session.status}</span>}
      </header>

      <CameraPreview camera={capture.camera} />

      {capture.error && <p className="callout err">{capture.error}</p>}

      {!running && (
        <div className="row">
          <input
            placeholder="Card ID (optional)"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          />
          <button
            className="primary"
            disabled={!rig.connected}
            title={rig.connected ? "" : "Connect the rig first"}
            onClick={() => void capture.startSession({ cardId: cardId || undefined })}
          >
            ▶ Start capture sequence
          </button>
        </div>
      )}

      {session && (
        <>
          <p className="operator-message">{session.operatorMessage}</p>

          {session.status === "awaiting_flip" && (
            <div className="callout flip">
              <strong>Flip the card</strong>
              <p>{session.operatorMessage}</p>
              <button className="primary" onClick={capture.confirmFlip}>
                Card flipped — continue
              </button>
            </div>
          )}

          {session.status === "awaiting_operator" && (
            <div className="callout warn">
              <p>{session.operatorMessage}</p>
              <div className="row">
                <button className="primary" onClick={() => capture.decide("retry")}>
                  Retry shot
                </button>
                <button onClick={() => capture.decide("skip")}>Skip shot</button>
                <button onClick={() => capture.decide("accept_anyway")}>Accept anyway</button>
                <button className="danger" onClick={() => capture.decide("abort")}>
                  Abort sequence
                </button>
              </div>
            </div>
          )}

          <ol className="step-list">
            {session.steps.map((s, i) => (
              <li
                key={s.step.id}
                className={[
                  i === session.currentStepIndex && running ? "current" : "",
                  s.status,
                ].join(" ")}
              >
                <span className="step-icon">{STEP_ICONS[s.status]}</span>
                <span className="step-name">
                  {s.step.name}
                  {!s.step.required && <span className="muted"> (optional)</span>}
                </span>
                <span className="muted step-status">
                  {s.status}
                  {s.attempts > 1 ? ` · attempt ${s.attempts}` : ""}
                </span>
                {!running && s.status !== "pending" && (
                  <button className="small" onClick={() => void capture.rerunStep(s.step.id)}>
                    Re-run
                  </button>
                )}
              </li>
            ))}
          </ol>

          <div className="row">
            {session.status === "capturing" && <button onClick={capture.pause}>⏸ Pause</button>}
            {session.status === "paused" && (
              <button className="primary" onClick={capture.resume}>
                ▶ Resume
              </button>
            )}
            {running && (
              <button className="danger" onClick={capture.cancel}>
                ✖ Cancel sequence
              </button>
            )}
            {session.status === "review" && (
              <button className="primary" onClick={capture.completeSession}>
                ✔ Approve image set & complete session
              </button>
            )}
          </div>

          {!running && (
            <div className="row manual-capture">
              <select value={manualProfile} onChange={(e) => setManualProfile(e.target.value)}>
                {LIGHTING_PROFILES.filter((p) => p.id !== "all_off").map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!rig.connected || !session}
                onClick={() => void capture.captureManual(manualProfile)}
              >
                📸 Manual extra shot
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function statusTone(status: string): string {
  if (["completed", "review"].includes(status)) return "ok";
  if (["failed", "cancelled"].includes(status)) return "err";
  return "warn";
}
