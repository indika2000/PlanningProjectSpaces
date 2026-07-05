/**
 * Connection panel: rig status, port selection, connect/disconnect, ping,
 * and the always-visible Emergency Lights Off button.
 */

import { useState } from "react";
import { useRigConnection } from "./useRigConnection";

export function RigConnectionPanel() {
  const { rig, ports, busy, actionError, refreshPorts, connect, disconnect, ping, refreshStatus, emergencyStop } =
    useRigConnection();
  const [selectedPort, setSelectedPort] = useState<string>("");

  const installedZones = rig.capabilities?.zones.filter((z) => z.installed).length ?? 0;
  const totalZones = rig.capabilities?.zones.length ?? 0;

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Rig Connection</h2>
        <span
          className={`status-pill ${rig.connected ? "ok" : rig.connecting ? "warn" : "err"}`}
        >
          {rig.connected ? "Connected" : rig.connecting ? "Connecting..." : "Disconnected"}
        </span>
      </header>

      {!rig.bridgeReachable && (
        <p className="callout warn">
          Rig Bridge Service is not reachable. Start it with <code>npm run dev</code> (or{" "}
          <code>npm run dev:mock</code> for a simulated rig) in <code>rig-bridge/</code>.
        </p>
      )}

      <dl className="kv-grid">
        <dt>Port</dt>
        <dd>{rig.portPath ?? "—"}</dd>
        <dt>Firmware</dt>
        <dd>{rig.firmwareVersion ?? "—"}</dd>
        <dt>Board</dt>
        <dd>{rig.board ?? "—"}</dd>
        <dt>LED type</dt>
        <dd>{rig.capabilities?.ledType ?? "—"}</dd>
        <dt>Zones</dt>
        <dd>{rig.capabilities ? `${installedZones} installed / ${totalZones} known` : "—"}</dd>
        <dt>Active profile</dt>
        <dd>{rig.activeProfileId ?? "—"}</dd>
        <dt>Last heartbeat</dt>
        <dd className={rig.heartbeatStale ? "text-warn" : undefined}>
          {rig.lastHeartbeatAt
            ? `${new Date(rig.lastHeartbeatAt).toLocaleTimeString()}${rig.heartbeatStale ? " (stale)" : ""}`
            : "—"}
        </dd>
      </dl>

      {(rig.error || actionError) && (
        <p className="callout err">{rig.error ?? actionError}</p>
      )}

      <div className="row">
        <select
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={busy || rig.connected}
        >
          <option value="">Auto-detect port</option>
          {ports.map((p) => (
            <option key={p.path} value={p.path}>
              {p.path}
              {p.likelyRig ? " (rig?)" : ""} {p.manufacturer ? `— ${p.manufacturer}` : ""}
            </option>
          ))}
        </select>
        <button onClick={() => void refreshPorts()} disabled={busy}>
          Refresh ports
        </button>
      </div>

      <div className="row">
        {rig.connected ? (
          <button onClick={() => void disconnect()} disabled={busy}>
            Disconnect
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => void connect(selectedPort || undefined)}
            disabled={busy || !rig.bridgeReachable}
          >
            Connect rig
          </button>
        )}
        <button onClick={() => void ping()} disabled={busy || !rig.connected}>
          Ping
        </button>
        <button onClick={() => void refreshStatus()} disabled={busy || !rig.connected}>
          Get status
        </button>
        <button className="danger" onClick={() => void emergencyStop()} disabled={!rig.connected}>
          ⛔ Emergency lights off
        </button>
      </div>
    </section>
  );
}
