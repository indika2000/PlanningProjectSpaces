/**
 * RigSerialClient: request/response + event layer over a SerialTransport.
 *
 * Responsibilities:
 *  - frame outbound commands (newline JSON) and match replies by message id
 *  - enforce per-command timeouts
 *  - surface unsolicited firmware events (READY, HEARTBEAT, ERROR, ...)
 *  - tolerate boot noise / garbage lines without crashing
 */

import { EventEmitter } from "node:events";
import type { SerialTransport } from "./SerialTransport.js";
import {
  LineBuffer,
  parseRigLine,
  encodeCommand,
  isEventMessage,
  eventTypeOf,
  type RigCommand,
  type RigResponse,
  type RigEventType,
  type RigErrorCode,
} from "../protocol/RigProtocol.js";

export class RigCommandError extends Error {
  constructor(
    public readonly code: RigErrorCode,
    message: string,
    public readonly commandId?: string
  ) {
    super(message);
    this.name = "RigCommandError";
  }
}

interface PendingCommand {
  command: RigCommand<unknown>;
  resolve: (response: RigResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface RigSerialClientEvents {
  event: (type: RigEventType, message: RigResponse) => void;
  garbage: (raw: string, reason: string) => void;
  close: (err?: Error) => void;
  error: (err: Error) => void;
}

export class RigSerialClient extends EventEmitter {
  private readonly lineBuffer = new LineBuffer();
  private readonly pending = new Map<string, PendingCommand>();
  private closed = false;

  constructor(
    private readonly transport: SerialTransport,
    private readonly options: { commandTimeoutMs: number }
  ) {
    super();
    transport.onData((chunk) => this.handleChunk(chunk));
    transport.onClose((err) => this.handleClose(err));
    transport.onError((err) => this.emit("error", err));
  }

  get portPath(): string {
    return this.transport.path;
  }

  isOpen(): boolean {
    return !this.closed && this.transport.isOpen();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failAllPending(new RigCommandError("NOT_CONNECTED", "Serial connection closed"));
    await this.transport.close();
  }

  /**
   * Send one command and await its reply. Resolves with the firmware response
   * (result or ack). Rejects with RigCommandError on firmware error responses,
   * timeouts, or write failures.
   */
  send(command: RigCommand<unknown>, timeoutMs?: number): Promise<RigResponse> {
    if (!this.isOpen()) {
      return Promise.reject(
        new RigCommandError("NOT_CONNECTED", "Rig serial port is not open", command.id)
      );
    }
    const timeout = timeoutMs ?? this.options.commandTimeoutMs;
    return new Promise<RigResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        reject(
          new RigCommandError(
            "COMMAND_TIMEOUT",
            `Command ${command.type} (${command.id}) timed out after ${timeout}ms`,
            command.id
          )
        );
      }, timeout);

      this.pending.set(command.id, { command, resolve, reject, timer });

      this.transport.write(encodeCommand(command)).catch((err) => {
        const entry = this.pending.get(command.id);
        if (!entry) return;
        this.pending.delete(command.id);
        clearTimeout(entry.timer);
        reject(
          new RigCommandError("WRITE_FAILED", `Serial write failed: ${String(err)}`, command.id)
        );
      });
    });
  }

  private handleChunk(chunk: Buffer): void {
    for (const line of this.lineBuffer.push(chunk)) {
      const parsed = parseRigLine(line);
      if (parsed.kind === "garbage") {
        this.emit("garbage", parsed.raw, parsed.reason);
        continue;
      }
      this.dispatch(parsed.message);
    }
  }

  private dispatch(message: RigResponse): void {
    if (isEventMessage(message)) {
      const type = eventTypeOf(message);
      if (type) this.emit("event", type, message);
      return;
    }
    const entry = this.pending.get(message.id);
    if (!entry) {
      // Late reply after timeout, or firmware error with id "unknown".
      this.emit("garbage", JSON.stringify(message), "reply for unknown/expired command id");
      return;
    }
    // "ack" means received-and-working; keep waiting for the final result.
    if (message.type === "ack" && message.status === "ok") return;

    this.pending.delete(message.id);
    clearTimeout(entry.timer);

    if (message.status === "error" || message.type === "error") {
      const code = (message.payload.code as RigErrorCode) ?? "INTERNAL_ERROR";
      const detail = (message.payload.message as string) ?? "Rig reported an error";
      entry.reject(new RigCommandError(code, detail, message.id));
    } else {
      entry.resolve(message);
    }
  }

  private handleClose(err?: Error): void {
    this.closed = true;
    this.lineBuffer.reset();
    this.failAllPending(
      new RigCommandError("NOT_CONNECTED", `Serial port closed${err ? `: ${err.message}` : ""}`)
    );
    this.emit("close", err);
  }

  private failAllPending(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }
}
