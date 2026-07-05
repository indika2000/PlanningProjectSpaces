# Grading Card Bench — Architecture

Official architecture reference for the Grading Card Bench system. Audience:
engineers extending the system. For operator/setup material see
[setup.md](setup.md), [hardware-guide.md](hardware-guide.md) and
[install-and-integration.md](install-and-integration.md).

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (operator workstation)                             │
│                                                             │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Rig Control UI│  │ Capture Bench  │  │ Review /       │  │
│  │ (panels)      │  │ UI             │  │ Calibration UI │  │
│  └──────┬────────┘  └──────┬─────────┘  └──────┬─────────┘  │
│         │        React hooks (useRigConnection,│            │
│         │                 useCaptureSequence)  │            │
│  ┌──────┴───────────────────┴─────────────────┴─────────┐   │
│  │           CaptureSequenceEngine (orchestrator)       │   │
│  │   depends only on 4 interfaces:                      │   │
│  │   RigController · CameraController ·                 │   │
│  │   ImageValidator · CaptureStorage                    │   │
│  └──────┬───────────┬───────────────┬─────────────┬─────┘   │
│         │           │               │             │         │
│   BridgeRigClient  CameraService  ImageValidation BrowserCapture
│   (WebSocket)      (getUserMedia) Service (canvas Storage (blob +
│         │           pixels)       pixel math)     backend upload)
└─────────┼──────────────────────────────────────────┼────────┘
          │ ws://localhost:8787/rig                  │ HTTP :8788
┌─────────┴──────────────────────────┐    ┌──────────┴──────────┐
│  Rig Bridge Service (Node.js)      │    │  Backend API        │
│  WS server · command queue ·       │    │  sessions · images  │
│  state/health services ·           │    │  profiles ·         │
│  serial client · failsafes         │    │  sequences          │
└─────────┬──────────────────────────┘    │  (JSON + files)     │
          │ USB serial, newline JSON      └─────────────────────┘
┌─────────┴──────────────────────────┐
│  ESP32 Firmware                    │
│  protocol parser · zone map ·      │
│  LED controller · watchdog         │
└─────────┬──────────────────────────┘
          │ one WS2812B data chain
   D1 / R1 / R2 / R3 / R4 / O1-O2 / calibration LEDs
```

Two hard separations define the design:

1. **The backend never touches hardware.** Physical control is entirely
   local (browser + bridge + firmware). The backend only stores session
   data, so any number of bench stations in different locations can share
   one backend.
2. **The orchestrator never touches transports.** The
   `CaptureSequenceEngine` sees four injected interfaces. Swapping the
   camera (DSLR/gPhoto2), the rig transport (Web Serial instead of the
   bridge), or the validator (OpenCV worker/server) requires no engine
   changes — and the whole engine is unit-tested with fakes.

## 2. Components and responsibilities

### 2.1 Web app (`web/`)

| Module | Responsibility |
| --- | --- |
| `features/rig/rigClient.ts` | `RigClient` interface + `BridgeRigClient` (WebSocket, request/response by `requestId`, auto-reconnect, capability-aware profile filtering). `WebSerialRigClient` is the scaffolded direct-serial alternative. |
| `features/rig/*Panel.tsx` | Presentation only. All state flows from hooks; no capture logic lives in components. |
| `features/capture/captureSequenceEngine.ts` | The orchestrator state machine (§4). Owns the session's runtime state; emits immutable snapshots to subscribers. |
| `features/capture/captureSequences.ts`, `lightingProfiles.ts` | Pure data catalogs. Sequences reference lighting + validation profiles by id. |
| `features/camera/cameraService.ts` | `getUserMedia` capture → RGBA pixels (validation) + JPEG blob (storage) + track metadata. Best-effort constraint application for exposure/focus/WB. |
| `features/validation/*` | Threshold-profile-driven checks over a `PixelImage` (§5). Dependency-free; runs in browser or Node. |
| `features/session/captureStorage.ts` | Blob URLs for instant preview, best-effort backend upload, localStorage session mirror (refresh recovery). Storage failures never abort a capture. |
| `features/session/sessionApi.ts` | Typed REST client for the backend. |

### 2.2 Rig Bridge Service (`rig-bridge/`)

| Module | Responsibility |
| --- | --- |
| `protocol/RigProtocol.ts` | Command builders, id generation, newline-JSON framing, `LineBuffer` reassembly, tolerant parsing (boot noise → "garbage", never throws). |
| `protocol/schemas.ts` | zod validation at both trust boundaries: firmware messages and WS client messages. |
| `serial/SerialTransport.ts` | Minimal transport interface. Implementations: `NodeSerialTransport` (lazy-loaded `serialport`) and `MockRigTransport` (full in-process firmware simulation used by dev mode and tests). |
| `serial/RigSerialClient.ts` | Request/response matching by message id, per-command timeouts, ack pass-through, unsolicited event routing, fail-all-pending on close. |
| `services/RigCommandQueue.ts` | One command in flight (FIFO); latest-wins coalescing per lighting target; emergency commands flush the queue and jump the line; backpressure at max depth. |
| `services/RigStateService.ts` | Single owner of connection lifecycle, capabilities, active profile, capture-session flag. All WS/HTTP surfaces delegate here. Validates zones against capabilities *before* the wire. |
| `services/RigHealthService.ts` | Heartbeat staleness detection; active ping probe; forced disconnect of dead links. |
| `ws/RigWebSocketServer.ts` | WS API + broadcasts; last-client-disconnect grace timer (§6). |
| `routes/diagnostics.routes.ts` | curl-able HTTP mirror of core operations + `/health`. |

### 2.3 Firmware (`firmware/`)

| Module | Responsibility |
| --- | --- |
| `main.cpp` | Boot-dark guarantee; loop = protocol service → fade/test-pattern service → heartbeat → failsafe watchdog. |
| `protocol/RigProtocol.{h,cpp}` | Line assembly (overflow-safe), JSON parse, dispatch, typed error responses, event emission. Any valid command resets the watchdog. |
| `led/ZoneMap.h` | The only file describing physical wiring: `{zoneId, name, startPixel, pixelCount, installed}` per zone, mapped to the rig schematic (D1, R1–R4, O1–O2). |
| `led/LedController.{h,cpp}` | Pixel rendering with `zone% × global% × hardware ceiling` scaling, FastLED power limiting, linear fades, self-terminating test pattern. |
| `state/RigState.h` | Zone states, active profile id, heartbeat + watchdog bookkeeping. |

### 2.4 Backend (`backend/`)

`createApp(store)` → express routes → `JsonStore` (JSON file + image files,
serialized writes). Entities: sessions, images (record + metadata + file),
lighting profiles, capture sequences. Replace `JsonStore` with
Postgres/S3-backed storage without touching routes.

## 3. Protocol layering

```
Web app          Bridge                       Firmware
─────────        ──────────────────────       ─────────────────
WS JSON    ⇄     zod validate → RigCommand ⇄  newline JSON over serial
requestId        id ↔ promise matching        id echoed in reply
                 queue (1 in flight)          one command at a time
                 3s timeout / retry           watchdog reset per command
```

The wire contract is documented in [protocol.md](protocol.md) and enforced
three times: zod schemas in the bridge, defensive parsing in firmware, and
the `MockRigTransport`, which implements the same contract and backs the
integration tests — drift between mock and firmware is treated as a bug.

## 4. Capture orchestration state machine

Session status:

```
capturing ──────────────► review ──► completed
   │  ▲                      ▲
   │  └─ resume              └ operator approves image set
   ├─► paused
   ├─► awaiting_flip     (side change; lights forced off; operator confirms)
   ├─► awaiting_operator (retries exhausted or hardware error)
   ├─► cancelled         (operator cancel; lights off)
   └─► failed            (unrecoverable / operator abort; lights off)
```

Per-step status:

```
pending → lighting → settling → capturing → validating ┬→ accepted
                                                        ├→ (auto-retry ≤ maxRetries)
                                                        └→ awaiting_operator
                                                             ├ retry (budget reset)
                                                             ├ skip
                                                             ├ accept_anyway
                                                             └ abort → session failed
```

Invariants the engine enforces (and tests pin down):

- Every exit path — completion, cancel, failure, abort — ends with
  `rig.allOff()` and clears the bridge's capture-session flag.
- Every captured frame is persisted **before** the pass/fail decision is
  acted on; failed captures are stored and marked rejected, never dropped.
- Every image record carries the full lighting context (profile, zones,
  global brightness, settle time) plus camera metadata and the validation
  result.
- State snapshots are immutable and mirrored to localStorage + backend after
  every step, so a browser refresh can recover the session.

## 5. Validation architecture

Validation answers one question — *is this frame good enough to keep?* — and
deliberately excludes grading analysis.

- Input is a `PixelImage` (RGBA array + dimensions): browser `ImageData`
  satisfies it, tests build synthetic ones, and a server adapter can wrap
  OpenCV mats.
- A `ValidationProfile` (per shot type: `standard_front/back`,
  `surface_raking`, `glare_profile`, `calibration`) holds every numeric
  threshold. Raking shots legitimately pass dark frames; glare shots
  legitimately pass blown highlights — the profile encodes that.
- Pipeline: downsample to gray → global stats → card bounds (projection
  method) → per-check evaluation → aggregate score + operator-friendly
  `suggestedAction` from the first failing check.
- Brightness/contrast are measured **over the detected card region** (the
  box background is intentionally black); exposure clipping is whole-frame.
- The card detector is a dependency-free projection method suited to a
  controlled light box; the module boundary
  (`detectCardBounds(image) → CardBounds`) is where OpenCV.js `minAreaRect`
  slots in for corner-accurate skew later.

## 6. Safety model

Defense in depth — each layer assumes the layers above it may die:

| Layer | Mechanism |
| --- | --- |
| Firmware | Boots dark. Hardware brightness ceiling + FastLED power limit. Watchdog: lights on + no commands for 30 s → all off + `WATCHDOG_TIMEOUT`. Test pattern hard-capped at 15 s. All payload ranges validated. |
| Bridge | All-off on: process shutdown (SIGINT/SIGTERM/uncaught), rig disconnect request, emergency stop (queue flush + priority), last WS client gone for a grace period *and* no active capture session. Heartbeat monitor force-disconnects dead links so UI state can't lie. |
| Web app | Emergency Lights Off always visible. Engine turns lights off on every terminal path and during card flips. Capture-session flag prevents the bridge's idle blackout mid-run. |

## 7. Extension points

| Want to… | Touch |
| --- | --- |
| Add/move LED zones | `firmware/src/led/ZoneMap.h` only; capabilities discovery propagates it |
| Add a lighting profile | `lightingProfiles.ts` (or POST to the backend) |
| Add a capture sequence | `captureSequences.ts` (or POST) — data only |
| Swap camera hardware | Implement `CameraController` (3 methods) |
| Direct browser↔ESP32 (no bridge) | Finish `WebSerialRigClient` against the same protocol |
| Better card detection | Reimplement `detectCardBounds` (OpenCV.js) behind the same signature |
| Real database / object storage | Reimplement `JsonStore`'s interface |
| Multiple rigs per bridge | Generalize `RigStateService` to a map keyed by port — the queue/client are already per-connection |

## 8. Deployment topologies

- **Single bench (current)**: everything on one machine; browser talks to
  `localhost` bridge and backend.
- **Multi-station**: one shared backend (LAN/cloud); each station runs its
  own bridge + browser. No station-to-station coupling exists.
- **Kiosk hardening (future)**: bridge + web served by the bench machine as
  a service; browser in kiosk mode; backend remote with auth added at the
  `sessionApi`/express layer (currently unauthenticated local-trust).

## 9. Testing strategy

177 automated tests (see [testing.md](testing.md) for the breakdown):

- **Bridge (72)** — protocol unit tests; queue semantics; serial client vs
  the mock firmware (timeouts, garbage, errors, heartbeats); zod schema
  contracts; config; `RigStateService` lifecycle incl. simulated USB pull;
  and a full WS + HTTP integration suite over a real socket.
- **Web (92)** — engine behavior with injected fakes (all operator paths,
  flip, cancel, pause, failures); validator unit + integration tests over
  synthetic images; catalog integrity (every step references existing
  profiles); pixel math; metadata mapping.
- **Backend (13)** — REST lifecycle, multipart upload + file serve,
  accept/reject, CRUD, JSON persistence round-trip.

The mock rig is the linchpin: it lets CI exercise the exact serial protocol
with zero hardware, and it doubles as the dev-mode simulator.
