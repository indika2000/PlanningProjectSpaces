/**
 * RigCommandQueue: serializes commands to the rig.
 *
 * Why: the ESP32 processes one command at a time, and two lighting commands
 * racing each other would leave the rig in an untracked state. The queue
 * guarantees:
 *  - one command in flight at a time (FIFO)
 *  - lighting commands can coalesce: if a newer SET_PROFILE is queued before
 *    an older queued SET_PROFILE has started, the stale one is dropped
 *    (latest-wins) — sliders in the UI won't flood the wire
 *  - emergency stop jumps the queue and flushes pending lighting commands
 */

import type { RigCommand, RigResponse } from "../protocol/RigProtocol.js";
import { RigCommandError } from "../serial/RigSerialClient.js";

export type CommandSender = (command: RigCommand<unknown>) => Promise<RigResponse>;

interface QueueEntry {
  command: RigCommand<unknown>;
  /** Entries sharing a coalesceKey are latest-wins while still queued. */
  coalesceKey?: string;
  priority: boolean;
  resolve: (response: RigResponse) => void;
  reject: (err: Error) => void;
}

export class RigCommandQueue {
  private queue: QueueEntry[] = [];
  private inFlight = false;
  private sender: CommandSender | null = null;

  constructor(private readonly options: { maxQueueDepth: number }) {}

  /** Attach the active serial client's send function (null on disconnect). */
  setSender(sender: CommandSender | null): void {
    this.sender = sender;
    if (!sender) {
      this.rejectAll(new RigCommandError("NOT_CONNECTED", "Rig disconnected"));
    } else {
      void this.pump();
    }
  }

  get depth(): number {
    return this.queue.length + (this.inFlight ? 1 : 0);
  }

  enqueue(
    command: RigCommand<unknown>,
    opts: { coalesceKey?: string; priority?: boolean } = {}
  ): Promise<RigResponse> {
    if (!this.sender) {
      return Promise.reject(new RigCommandError("NOT_CONNECTED", "Rig is not connected"));
    }
    if (this.queue.length >= this.options.maxQueueDepth) {
      return Promise.reject(
        new RigCommandError(
          "WRITE_FAILED",
          `Command queue full (${this.options.maxQueueDepth}); rejecting ${command.type}`
        )
      );
    }

    if (opts.coalesceKey) {
      // Drop any still-queued entry with the same key; the new command supersedes it.
      this.queue = this.queue.filter((entry) => {
        if (entry.coalesceKey === opts.coalesceKey) {
          entry.reject(
            new RigCommandError(
              "WRITE_FAILED",
              `Superseded by newer ${command.type} command`,
              entry.command.id
            )
          );
          return false;
        }
        return true;
      });
    }

    return new Promise<RigResponse>((resolve, reject) => {
      const entry: QueueEntry = {
        command,
        coalesceKey: opts.coalesceKey,
        priority: opts.priority ?? false,
        resolve,
        reject,
      };
      if (entry.priority) this.queue.unshift(entry);
      else this.queue.push(entry);
      void this.pump();
    });
  }

  /**
   * Emergency path: flush all queued lighting work and push an all-off command
   * to the front. The in-flight command (if any) is allowed to finish — the
   * serial line can't be preempted mid-frame anyway.
   */
  enqueueEmergency(command: RigCommand<unknown>): Promise<RigResponse> {
    this.rejectAll(new RigCommandError("WRITE_FAILED", "Flushed by emergency stop"));
    return this.enqueue(command, { priority: true });
  }

  private rejectAll(err: Error): void {
    const entries = this.queue;
    this.queue = [];
    for (const entry of entries) entry.reject(err);
  }

  private async pump(): Promise<void> {
    if (this.inFlight || !this.sender) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.inFlight = true;
    try {
      const response = await this.sender(entry.command);
      entry.resolve(response);
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.inFlight = false;
      void this.pump();
    }
  }
}
