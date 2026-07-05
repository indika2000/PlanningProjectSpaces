# Testing

## Automated

```bash
cd rig-bridge && npm test    # 24 tests
cd web && npm test           # 19 tests
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

Web (`web/test/`):
- `captureSequenceEngine.test.ts` — full sequence completion with lights-off,
  retry-then-pass, operator skip after exhausted retries, flip prompt (with
  lights off during flip), rig failure mid-sequence + operator retry, cancel,
  pause/resume, camera-failure session failure, session/image metadata
  correctness (lighting profile attached to every image).
- `imageValidation.test.ts` — card detection on synthetic frames, black/white
  frame rejection, low resolution, clipped card with operator-friendly
  message, missing card, raking-profile darkness tolerance, zero-size frame
  safety.

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
