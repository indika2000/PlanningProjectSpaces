# Setup

## Prerequisites

- Node.js ≥ 20, npm
- Chrome or Edge (camera via `getUserMedia`; Web Serial optional later)
- PlatformIO (`pip install platformio`) for firmware
- An ESP32 or ESP32-S3 dev board + WS2812B strips (or run everything in mock mode)

## 1. Firmware

```bash
cd firmware
pio run                     # build (default env: esp32s3)
pio run -e esp32dev -t upload   # classic ESP32
pio device monitor -b 115200    # watch READY event + JSON traffic
```

Before flashing, edit to match your build:

- `src/config/RigConfig.h` — `LED_PIN`, `LED_COUNT`, brightness/power limits
  (`MAX_HARDWARE_BRIGHTNESS`, `MAX_POWER_MILLIAMPS` — size these to your PSU!)
- `src/led/ZoneMap.h` — start pixel / pixel count / installed flag per zone

Sanity check over a serial monitor (type one line):

```
{"id":"t1","type":"PING","timestamp":"","payload":{}}
```

You should get `{"id":"t1","type":"result","status":"ok",...}`.

## 2. Rig Bridge Service

```bash
cd rig-bridge
npm install
npm run dev        # real hardware (auto-detects the ESP32 port)
npm run dev:mock   # simulated rig — full workflow with no hardware
```

Config via env vars (see `src/config.ts`): `RIG_BRIDGE_PORT` (8787),
`RIG_SERIAL_PORT` (pin a port path), `RIG_SERIAL_BAUD`, `RIG_AUTO_CONNECT`,
`RIG_COMMAND_TIMEOUT_MS`, `RIG_MOCK`.

Linux note: add yourself to the serial group (`sudo usermod -a -G dialout $USER`)
and re-login if the port is permission-denied.

Verify: `curl localhost:8787/health` and `curl localhost:8787/rig/ports`.

## 3. Backend (optional but recommended)

```bash
cd backend
npm install
npm run dev        # listens on :8788, stores JSON + JPEGs under backend/data/
```

The web app works without it (images stay local to the browser session and a
warning is logged), but session/image persistence needs it.

## 4. Web app

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Env overrides (create `web/.env.local`):

```
VITE_RIG_BRIDGE_WS=ws://localhost:8787/rig
VITE_API_BASE_URL=http://localhost:8788
```

## First run walkthrough

1. Open the web app → the Connection panel shows whether the bridge is up.
2. **Connect rig** (auto-detect, or pick a port after **Refresh ports**).
3. Firmware/board/zone info populates from `GET_CAPABILITIES`.
4. Lighting Test tab → click zones/profiles, verify physical zones light up.
5. Calibration tab → run zone verification + uniformity/exposure checks.
6. Capture Bench tab → **Start camera**, place a card, **Start capture sequence**.
7. Follow the operator prompts (flip card midway). Review images, approve.

## Cameras

v1 uses the browser camera. The orchestrator depends only on the
`CameraController` interface (`ensureReady/applySettings/capture` in
`web/src/features/capture/captureSequenceEngine.ts`), so replacing it with a
DSLR (gPhoto2 behind a small HTTP service), industrial USB camera, or Pi
camera means writing one adapter class — no orchestrator changes.
