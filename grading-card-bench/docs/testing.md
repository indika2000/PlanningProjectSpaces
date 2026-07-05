# Testing

## Automated — 177 tests

```bash
cd rig-bridge && npm test    # 72 tests
cd web && npm test           # 92 tests
cd backend && npm test       # 13 tests
```

Rig Bridge (`rig-bridge/test/`):
- `protocol.test.ts` — command formatting, line reassembly across chunks,
  CRLF/garbage tolerance, overflow guard, event detection.
- `commandQueue.test.ts` — FIFO ordering, one-in-flight, lighting coalescing
  (latest wins), emergency-stop queue flush + priority, backpressure,
  disconnect rejection.
- `serialClient.test.ts` — runs against the in-process mock ESP32
  (`MockRigTransport`, which speaks the full protocol including boot noise
  and split chunks): ping, capabilities schema, profile apply + status,
  UNKNOWN_ZONE / ZONE_NOT_INSTALLED errors, command timeout + recovery,
  garbage survival, heartbeat events, pending-command failure on close.
- `schemas.test.ts` — zod contracts at both trust boundaries: every WS client
  message type, range enforcement (brightness 0-100, rgb 0-255, fade caps),
  capabilities shape, lax-firmware-message defaults.
- `config.test.ts` — defaults, env overrides, garbage env values, mock flag.
- `rigStateService.test.ts` — connect lifecycle against the mock rig
  (capabilities discovery, all-off starting state), idempotent connect,
  disconnect turns lights off first, local zone validation before the wire,
  emergency stop, capture-session tracking, heartbeat stamping, health
  service stale/fresh transitions, simulated USB pull (serial closed under
  the service).
- `wsServer.integration.test.ts` — full stack over a real socket: status
  push on connect, connect→profile→status→emergency-stop round trip,
  firmware error codes surfaced to clients, malformed/invalid client
  messages rejected without crashing, port listing, heartbeat broadcast,
  capture-session flag, plus HTTP /health, /rig/status, /rig/ports,
  /rig/test-pattern, /rig/all-off.

Web (`web/test/`):
- `captureSequenceEngine.test.ts` — full sequence completion with lights-off,
  retry-then-pass, operator skip after exhausted retries, flip prompt (with
  lights off during flip), rig failure mid-sequence + operator retry, cancel,
  pause/resume, camera-failure session failure, session/image metadata
  correctness (lighting profile attached to every image).
- `captureSequenceEngine.more.test.ts` — operator accept_anyway/abort/retry
  budget reset, re-run of completed steps, mid-run re-run refusal, manual
  captures, review accept/reject, completion, double-start refusal,
  subscribe/unsubscribe.
- `imageValidation.test.ts` — card detection on synthetic frames, black/white
  frame rejection, low resolution, clipped card with operator-friendly
  message, missing card, raking-profile darkness tolerance, zero-size frame
  safety.
- `validators.test.ts` — every individual check's contract: resolution,
  brightness/contrast/exposure messages and per-profile tolerances, card
  detected/area/aspect/clipping (side naming)/skew, uniformity quadrant
  naming, glare min/max band, raking exposure floor.
- `pixelMath.test.ts` — Rec.601 luma, downsampling, stats on known patterns,
  under/over-exposure fractions, region restriction, empty-region safety,
  Laplacian focus measure ordering (flat < gradient < edges).
- `lightingProfiles.test.ts` — catalog integrity (unique ids, protocol
  ranges, known zones, schematic profiles present, raking = exactly one
  zone), capability adaptation (drop/report/no-mutation).
- `captureSequences.test.ts` — catalog integrity (unique ids, every step's
  lighting + validation profile exists, settle/retry sanity, single flip),
  default sequence required set, schematic shot matrix A-F order and
  optional Shot F.
- `captureStorage.test.ts` — image metadata document mapping + fallbacks.

Backend (`backend/test/`):
- `api.test.ts` — real HTTP server + temp-dir store: session lifecycle
  (create/read/patch/start/complete/cancel + 404s/400s), multipart image
  upload with file round-trip, metadata-only upload, accept/reject,
  malformed record rejection, lighting profile CRUD, capture sequence CRUD,
  JSON persistence across store reload.

Firmware: logic that can regress (framing, queueing, validation semantics) is
covered via the bridge's mock, which mirrors the firmware contract. On-target
tests would use PlatformIO's Unity runner; the protocol handlers are
structured (RigProtocol class, LedController) to allow that later.

## Manual hardware test checklist

1. **Boot safety**: power the rig — all LEDs must stay dark until commanded.
2. Connect/disconnect the rig from the web UI several times.
3. Run **all-off**, then each zone from the Lighting Test panel; confirm the
   physical zone matches the name (calibration tab automates the record).
4. Run the **test pattern**; confirm it cycles and self-stops.
5. Run a full capture sequence with the mock camera / real camera.
6. **Pull USB mid-sequence**: UI must show the rig error and offer retry;
   the firmware watchdog must blank the LEDs within 30 s.
7. Send malformed JSON over a serial monitor; firmware must answer
   `INVALID_JSON` and keep running.
8. Leave lights on and stop the bridge: watchdog blanks LEDs after
   `FAILSAFE_LIGHTS_OFF_MS`.
9. Kill the bridge process (Ctrl-C) with lights on: bridge sends all-off
   before exiting.
10. Close the browser tab with no session active: lights go off after the
    grace period; with an active capture session they stay on.
11. Emergency Lights Off button: instant blackout even with a queue of
    pending lighting commands.
