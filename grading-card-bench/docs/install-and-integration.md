# Software Install & Web-App Integration Guide

Two audiences, two halves:

- **Part A** — installing and running the Grading Card Bench software from
  scratch on a bench PC (beginner-friendly).
- **Part B** — connecting the rig to **your own web app**: what to copy,
  what to talk to, and the exact contracts.

---

# Part A — Installing the stack

## A1. Install the prerequisites (once)

1. **Node.js 20 or newer** — [nodejs.org](https://nodejs.org) → LTS
   installer. Verify in a terminal: `node --version`.
2. **Google Chrome or Microsoft Edge** — the camera capture uses browser
   APIs these two support best.
3. **PlatformIO** (only needed to flash the ESP32):
   `pip install platformio` (needs Python 3), verify with `pio --version`.
4. **Windows only**: the ESP32's USB-serial chip may need a driver —
   CP210x ("Silicon Labs VCP driver") or CH340, depending on your board.
   Plug the board in; if no new COM port appears in Device Manager, install
   the matching driver.
5. **Linux only**: give yourself serial permission:
   `sudo usermod -a -G dialout $USER`, then log out/in.

## A2. Get the code

```bash
git clone <your-repo-url>
cd <repo>/grading-card-bench
```

## A3. Flash the ESP32 (hardware builds only)

Covered step-by-step in [hardware-guide.md §6](hardware-guide.md). Skip
entirely if you're evaluating in mock mode.

## A4. Start the three services

Open three terminals in `grading-card-bench/`:

**Terminal 1 — Rig Bridge** (owns the USB serial port):

```bash
cd rig-bridge
npm install          # first time only
npm run dev          # real rig — auto-detects the ESP32's port
# ...or with NO hardware attached:
npm run dev:mock     # simulated rig, full workflow works
```

Healthy output ends with
`Rig Bridge listening on http://localhost:8787 (ws path /rig)`.

**Terminal 2 — Backend** (stores sessions + images; optional but recommended):

```bash
cd backend
npm install
npm run dev          # http://localhost:8788, data in backend/data/
```

**Terminal 3 — Web app** (the bundled operator UI):

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

## A5. First session checklist

1. Open http://localhost:5173 in Chrome/Edge.
2. Connection panel → **Connect rig** (leave port on Auto-detect).
   Firmware version, board and zone count should populate.
3. **Lighting Test** tab → click *Left Raking Light* → the R4 bar lights.
   Click *All Lights Off*.
4. **Calibration** tab → *Zone verification* → walk all zones once.
5. **Capture Bench** tab → **Start camera** (allow the permission prompt),
   place a card, choose the sequence — *Rig Schematic Shot Matrix (A–F)*
   matches your box — then **Start capture sequence**.
6. Follow the prompts (it will ask you to flip the card halfway), review the
   image set, **Approve**.

If anything misbehaves: [troubleshooting.md](troubleshooting.md).

## A6. Running it every day

- The bridge and backend can run permanently (pm2, systemd, or a startup
  script). Both are safe to kill — the bridge turns lights off on exit.
- Environment knobs: `RIG_SERIAL_PORT` (pin the port), `RIG_BRIDGE_PORT`,
  `GCB_BACKEND_PORT`, `GCB_DATA_DIR`. Web app: `VITE_RIG_BRIDGE_WS`,
  `VITE_API_BASE_URL` in `web/.env.local`.

---

# Part B — Connecting YOUR web app

The bundled `web/` app is a working reference, but everything is designed to
be lifted into your own application. You have two integration levels.

## B1. Level 1 — copy the feature modules (recommended)

The web code is React + TypeScript with **zero external runtime
dependencies beyond React itself** (no state library, no UI kit). Copy these
folders into your app's source tree:

```
features/rig/          rig client, hooks, panels, types
features/camera/       camera service + preview
features/capture/      sequence engine, sequences, lighting profiles
features/validation/   validation service + validators
features/session/      backend API client + capture storage
```

Then:

1. Route/render `RigControlPage` (or compose the individual panels —
   `RigConnectionPanel`, `LightingTestPanel`, `CaptureSequencePanel`,
   `ImageReviewPanel`, `CalibrationPanel` — into your own layout).
2. Merge `web/src/styles.css` into your styling, or restyle: panels are
   plain semantic markup with small class hooks; no CSS framework
   assumptions.
3. Point the clients at your services (Vite-style env vars, or edit the two
   defaults):
   - `VITE_RIG_BRIDGE_WS` → `ws://localhost:8787/rig` (`rigClient.ts`)
   - `VITE_API_BASE_URL` → your backend (`sessionApi.ts`)
4. If you already have your own session backend, replace
   `features/session/sessionApi.ts` with calls to your API — it's the only
   file that knows the backend's URL shapes. The engine only needs the
   `CaptureStorage` interface: `saveImage(record, frame)` and
   `saveSessionState(state)`.

**The one contract that matters** — your "Take photo for grading" button
ultimately does this:

```ts
import { CaptureSequenceEngine } from ".../captureSequenceEngine";
import { getCaptureSequence } from ".../captureSequences";
import { rigClient } from ".../rigClient";
import { CameraService } from ".../cameraService";
import { ImageValidationService } from ".../imageValidationService";
import { BrowserCaptureStorage } from ".../captureStorage";

const engine = new CaptureSequenceEngine({
  rig: rigClient,                          // WebSocket → Rig Bridge → ESP32
  camera: new CameraService(),             // getUserMedia
  validator: new ImageValidationService(), // canvas pixel checks
  storage: new BrowserCaptureStorage(),    // blob + backend upload
});

engine.subscribe((state) => render(state)); // immutable snapshots, every transition

await engine.start({
  sessionId: crypto.randomUUID(),
  sequence: getCaptureSequence("shot_matrix_v1")!, // your schematic's A–F
});

// UI must handle two blocking states:
//   state.status === "awaiting_flip"     → show flip prompt → engine.confirmCardFlipped()
//   state.status === "awaiting_operator" → show reason → engine.resolveOperatorDecision(
//                                          "retry" | "skip" | "accept_anyway" | "abort")
```

## B2. Level 2 — talk to the bridge directly (any framework / no React)

If your app isn't React (or you want your own orchestration), speak to the
Rig Bridge over WebSocket yourself. It's plain JSON:

```js
const ws = new WebSocket("ws://localhost:8787/rig");

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);   // { type, requestId?, payload, at }
  // types you'll see: rig:status, rig:capabilities, rig:heartbeat,
  // rig:profile-applied, rig:zone-updated, rig:ports, rig:ack,
  // rig:error, rig:log, rig:connected, rig:disconnected
};

// connect the rig
ws.send(JSON.stringify({ type: "rig:connect", requestId: "r1" }));

// apply a lighting profile (this is "turn on left raking")
ws.send(JSON.stringify({
  type: "rig:set-profile",
  requestId: "r2",
  profile: {
    profileId: "raking_left",
    globalBrightness: 85,
    zones: [{ zoneId: "ZONE_LEFT_RAKING", enabled: true,
              rgb: { r: 255, g: 255, b: 255 }, brightness: 90 }],
    fadeMs: 80,
  },
}));

// always wire this to a big red button:
ws.send(JSON.stringify({ type: "rig:emergency-stop" }));
```

Rules to respect:

- **Correlate with `requestId`**: whatever you send comes back on the reply
  (`rig:ack` / typed event / `rig:error`). Treat no-reply-in-8s as failure.
- **Errors are structured**: `rig:error` payloads carry `code`
  (`UNKNOWN_ZONE`, `ZONE_NOT_INSTALLED`, `COMMAND_TIMEOUT`,
  `NOT_CONNECTED`, …) and a human `message` you can show operators.
- **Tell the bridge about capture sessions**:
  `{type: "rig:capture-session", active: true, sessionId}` before you start
  shooting, `active: false` after. This stops the bridge's
  "no clients → lights off" idle safety from firing mid-session.
- **Discover, don't assume**: send `rig:get-capabilities` and only use zones
  with `installed: true`.
- Full message reference: [protocol.md](protocol.md). There are also plain
  HTTP endpoints (`POST /rig/all-off` etc.) for scripts and health checks.

## B3. Sequencing your own captures (if you skip the engine)

If you orchestrate captures yourself, replicate this per shot — order
matters:

1. `rig:set-profile` → wait for `rig:profile-applied`.
2. Wait the settle time (300–400 ms) — LEDs are instant, but your camera's
   auto-exposure isn't.
3. Capture from your camera.
4. Validate the frame (or accept blind — not recommended; a whole shot set
   with the lens cap on is a real failure mode).
5. Store the image **with** the lighting profile id + zone states you used —
   downstream analysis is meaningless without knowing the illumination.
6. After the last shot: `rig:all-off`. On any error: `rig:all-off`.

## B4. What talks to what (recap)

```
your web app ──WebSocket──► rig-bridge (localhost:8787) ──USB──► ESP32 ──► LEDs
your web app ──getUserMedia──► camera
your web app ──HTTP──► backend (localhost:8788 or your own API)  [storage only]
```

The bridge and camera are per-bench and local; the backend is shared and
remote-capable. Keep that split and multiple grading stations come free.
