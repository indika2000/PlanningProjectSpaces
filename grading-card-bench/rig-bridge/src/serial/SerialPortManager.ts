/**
 * Serial port discovery + transport construction.
 *
 * `serialport` is an optional dependency (it needs native bindings). It is
 * loaded lazily so the bridge still runs in --mock mode, and so unit tests
 * never touch hardware.
 */

import type { SerialPortInfo } from "../types/rig.types.js";
import type { SerialTransport } from "./SerialTransport.js";
import { MockRigTransport } from "./MockRigTransport.js";

/** USB vendor ids for the UART chips commonly found on ESP32 dev boards. */
const LIKELY_RIG_VENDOR_IDS = new Set([
  "10c4", // Silicon Labs CP210x
  "1a86", // WCH CH340/CH9102
  "0403", // FTDI
  "303a", // Espressif native USB (ESP32-S2/S3)
]);

type SerialPortModule = typeof import("serialport");

export class SerialPortManager {
  constructor(
    private readonly options: { baudRate: number; mock: boolean }
  ) {}

  private async loadSerialPort(): Promise<SerialPortModule> {
    try {
      return await import("serialport");
    } catch (err) {
      throw new Error(
        "The 'serialport' package is not installed or failed to load native bindings. " +
          "Run `npm install serialport` or start the bridge with --mock. " +
          `Underlying error: ${String(err)}`
      );
    }
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    if (this.options.mock) {
      return [
        {
          path: "mock://esp32",
          manufacturer: "Mock Rig",
          likelyRig: true,
        },
      ];
    }
    const { SerialPort } = await this.loadSerialPort();
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      vendorId: p.vendorId,
      productId: p.productId,
      likelyRig: p.vendorId
        ? LIKELY_RIG_VENDOR_IDS.has(p.vendorId.toLowerCase())
        : false,
    }));
  }

  /** Pick the best candidate port when the operator did not choose one. */
  async autoDetectPort(): Promise<SerialPortInfo | undefined> {
    const ports = await this.listPorts();
    return ports.find((p) => p.likelyRig) ?? ports[0];
  }

  async createTransport(portPath: string): Promise<SerialTransport> {
    if (this.options.mock || portPath.startsWith("mock://")) {
      return new MockRigTransport(portPath);
    }
    const { SerialPort } = await this.loadSerialPort();
    return new NodeSerialTransport(SerialPort, portPath, this.options.baudRate);
  }
}

/** Real serial transport backed by the `serialport` package. */
class NodeSerialTransport implements SerialTransport {
  private port: InstanceType<SerialPortModule["SerialPort"]> | null = null;
  private dataListeners: Array<(chunk: Buffer) => void> = [];
  private closeListeners: Array<(err?: Error) => void> = [];
  private errorListeners: Array<(err: Error) => void> = [];

  constructor(
    private readonly SerialPortCtor: SerialPortModule["SerialPort"],
    public readonly path: string,
    private readonly baudRate: number
  ) {}

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = new this.SerialPortCtor({
        path: this.path,
        baudRate: this.baudRate,
        autoOpen: false,
      });
      port.on("data", (chunk: Buffer) => {
        for (const l of this.dataListeners) l(chunk);
      });
      port.on("close", () => {
        for (const l of this.closeListeners) l();
      });
      port.on("error", (err: Error) => {
        for (const l of this.errorListeners) l(err);
      });
      port.open((err) => {
        if (err) return reject(err);
        this.port = port;
        resolve();
      });
    });
  }

  close(): Promise<void> {
    const port = this.port;
    this.port = null;
    if (!port || !port.isOpen) return Promise.resolve();
    return new Promise((resolve) => port.close(() => resolve()));
  }

  isOpen(): boolean {
    return this.port?.isOpen ?? false;
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        return reject(new Error(`Serial port ${this.path} is not open`));
      }
      this.port.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  onData(listener: (chunk: Buffer) => void): void {
    this.dataListeners.push(listener);
  }
  onClose(listener: (err?: Error) => void): void {
    this.closeListeners.push(listener);
  }
  onError(listener: (err: Error) => void): void {
    this.errorListeners.push(listener);
  }
}
