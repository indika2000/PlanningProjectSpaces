/**
 * Image review panel: thumbnails of every captured image with validation
 * details, card-bounds overlay, and accept/reject controls.
 */

import { useState } from "react";
import type { UseCaptureSequence } from "../capture/useCaptureSequence";
import type { CapturedImageRecord } from "../capture/capture.types";
import type { ValidationCheck } from "../validation/validation.types";

export function ImageReviewPanel({ capture }: { capture: UseCaptureSequence }) {
  const { session } = capture;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!session || session.images.length === 0) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Image Review</h2>
        </header>
        <p className="muted">Captured images will appear here.</p>
      </section>
    );
  }

  const selected =
    session.images.find((i) => i.imageId === selectedId) ??
    session.images[session.images.length - 1]!;

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Image Review</h2>
        <span className="muted">
          {session.images.filter((i) => i.accepted).length}/{session.images.length} accepted
        </span>
      </header>

      <div className="thumb-strip">
        {session.images.map((img) => (
          <button
            key={img.imageId}
            className={`thumb ${img.imageId === selected.imageId ? "selected" : ""} ${
              img.accepted ? "accepted" : "rejected"
            }`}
            onClick={() => setSelectedId(img.imageId)}
            title={`${img.stepName} — ${img.accepted ? "accepted" : "rejected"}`}
          >
            {img.blobUrl ? <img src={img.blobUrl} alt={img.stepName} /> : <span>{img.stepName}</span>}
          </button>
        ))}
      </div>

      <ImageDetail image={selected} capture={capture} />
    </section>
  );
}

function ImageDetail({
  image,
  capture,
}: {
  image: CapturedImageRecord;
  capture: UseCaptureSequence;
}) {
  const v = image.validationResult;
  return (
    <div className="image-detail">
      <div className="image-detail-preview">
        {image.blobUrl ? (
          <div className="bounds-wrapper">
            <img src={image.blobUrl} alt={image.stepName} />
            {v?.cardBounds && image.cameraMetadata && (
              <div
                className="bounds-overlay"
                style={{
                  left: `${(v.cardBounds.x / image.cameraMetadata.resolutionWidth) * 100}%`,
                  top: `${(v.cardBounds.y / image.cameraMetadata.resolutionHeight) * 100}%`,
                  width: `${(v.cardBounds.width / image.cameraMetadata.resolutionWidth) * 100}%`,
                  height: `${(v.cardBounds.height / image.cameraMetadata.resolutionHeight) * 100}%`,
                }}
              />
            )}
          </div>
        ) : (
          <div className="camera-placeholder">No preview</div>
        )}
      </div>

      <div className="image-detail-meta">
        <h3>{image.stepName}</h3>
        <dl className="kv-grid">
          <dt>Side</dt>
          <dd>{image.side}</dd>
          <dt>Lighting</dt>
          <dd>{image.lightingProfileId}</dd>
          <dt>Captured</dt>
          <dd>{new Date(image.capturedAt).toLocaleTimeString()}</dd>
          <dt>Origin</dt>
          <dd>{image.origin}</dd>
          <dt>Stored</dt>
          <dd>{image.storageUrl ? "backend" : "local only"}</dd>
          {v && (
            <>
              <dt>Validation</dt>
              <dd className={v.passed ? "text-ok" : "text-err"}>
                {v.passed ? "passed" : "failed"} (score {v.score})
              </dd>
            </>
          )}
        </dl>

        {v && (
          <ul className="check-list">
            {Object.entries(v.checks).map(([name, check]) =>
              check ? <CheckRow key={name} name={name} check={check} /> : null
            )}
          </ul>
        )}

        {v && v.errors.length > 0 && (
          <div className="callout err">
            {v.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        <div className="row">
          {image.accepted ? (
            <button onClick={() => capture.rejectImage(image.imageId, "Rejected by operator")}>
              Reject
            </button>
          ) : (
            <button className="primary" onClick={() => capture.acceptImage(image.imageId)}>
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckRow({ name, check }: { name: string; check: ValidationCheck }) {
  return (
    <li className={check.passed ? "check-ok" : "check-fail"}>
      <span>{check.passed ? "✓" : "✗"}</span> <strong>{labelize(name)}</strong>
      {check.value !== undefined && <span className="muted"> — {String(check.value)}</span>}
      {!check.passed && check.message && <div className="check-message">{check.message}</div>}
    </li>
  );
}

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
