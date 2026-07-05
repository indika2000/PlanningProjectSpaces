/**
 * RigHealthService: watches heartbeats and connection health.
 *
 * The firmware emits HEARTBEAT events once started. If they stop arriving,
 * either the cable was pulled, the firmware crashed, or the port wedged. We
 * mark the rig stale (the UI shows a warning) and, if it stays stale, verify
 * with a ping and force a disconnect so state doesn't lie to the operator.
 */

import type { Logger } from "pino";
import type { RigStateService } from "./RigStateService.js";

export class RigHealthService {
  private timer: NodeJS.Timeout | null = null;
  private lastHeartbeatMs = 0;

  constructor(
    private readonly rig: RigStateService,
    private readonly options: { staleAfterMs: number; checkIntervalMs?: number },
    private readonly log: Logger
  ) {
    rig.on("heartbeat", () => {
      this.lastHeartbeatMs = Date.now();
    });
    rig.on("status", (status) => {
      if (status.connected) this.lastHeartbeatMs = Date.now();
    });
  }

  start(): void {
    if (this.timer) return;
    const interval = this.options.checkIntervalMs ?? 1000;
    this.timer = setInterval(() => void this.check(), interval);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async check(): Promise<void> {
    if (!this.rig.connected) return;
    const sinceLast = Date.now() - this.lastHeartbeatMs;
    if (sinceLast < this.options.staleAfterMs) {
      this.rig.markHeartbeatStale(false);
      return;
    }
    this.rig.markHeartbeatStale(true);

    // Stale for 2x the threshold: actively verify before declaring it dead.
    if (sinceLast > this.options.staleAfterMs * 2) {
      this.log.warn("Heartbeat stale for too long; probing rig with ping");
      try {
        await this.rig.ping();
        this.lastHeartbeatMs = Date.now(); // it's alive, heartbeat task may have stopped
      } catch {
        this.log.error("Rig unresponsive to ping — forcing disconnect");
        await this.rig.disconnect().catch(() => undefined);
      }
    }
  }
}
