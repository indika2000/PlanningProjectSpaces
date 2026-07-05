/**
 * Live camera preview. Mounts the CameraService's <video> element and offers
 * device selection + start/stop.
 */

import { useEffect, useRef, useState } from "react";
import { CameraService } from "./cameraService";
import type { CameraDeviceInfo } from "./camera.types";

export function CameraPreview({ camera }: { camera: CameraService }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();

  const mountVideo = () => {
    const host = hostRef.current;
    const video = camera.videoElement;
    if (host && video && video.parentElement !== host) {
      host.innerHTML = "";
      video.className = "camera-video";
      host.appendChild(video);
    }
  };

  const start = async () => {
    setError(undefined);
    try {
      await camera.start(deviceId || undefined);
      setRunning(true);
      mountVideo();
      setDevices(await CameraService.listDevices());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    return () => camera.stop();
  }, [camera]);

  useEffect(mountVideo);

  return (
    <div className="camera-preview">
      <div className="row">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">Default camera</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        {running ? (
          <button
            onClick={() => {
              camera.stop();
              setRunning(false);
            }}
          >
            Stop camera
          </button>
        ) : (
          <button className="primary" onClick={() => void start()}>
            Start camera
          </button>
        )}
      </div>
      {error && <p className="callout err">{error}</p>}
      <div ref={hostRef} className="camera-host">
        {!running && <div className="camera-placeholder">Camera off</div>}
      </div>
    </div>
  );
}
