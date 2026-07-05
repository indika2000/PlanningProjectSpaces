/**
 * Minimal transport abstraction over a serial connection.
 *
 * RigSerialClient talks to this interface, so the same client works against:
 *  - a real ESP32 via `serialport` (NodeSerialTransport)
 *  - a simulated rig (MockRigTransport) for development and unit tests
 */

export interface SerialTransport {
  readonly path: string;
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
  write(data: string): Promise<void>;
  onData(listener: (chunk: Buffer) => void): void;
  onClose(listener: (err?: Error) => void): void;
  onError(listener: (err: Error) => void): void;
}
