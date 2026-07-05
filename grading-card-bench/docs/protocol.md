# Serial Protocol (Bridge ↔ ESP32)

Transport: USB serial, 115200 baud. Framing: **newline-delimited JSON** —
one JSON object per line, UTF-8, `\n` terminated. Lines that are not valid
JSON objects (boot noise) are ignored by the bridge; malformed commands get an
`INVALID_JSON` error from the firmware.

Source of truth in code:
- Bridge: `rig-bridge/src/protocol/RigProtocol.ts`, `schemas.ts`
- Firmware: `firmware/src/protocol/RigProtocol.{h,cpp}`

## Command envelope (bridge → rig)

```json
{
  "id": "cmd_0001",
  "type": "SET_PROFILE",
  "timestamp": "2026-07-05T00:00:00.000Z",
  "payload": { }
}
```

`timestamp` is informational; the ESP32 has no wall clock and ignores it.

## Response envelope (rig → bridge)

```json
{
  "id": "cmd_0001",
  "type": "result",          // ack | result | error | event
  "status": "ok",            // ok | error
  "timestamp": 1234567,      // firmware uptime in ms
  "payload": { }
}
```

- `ack` (optional) = received, still working; the final answer follows.
- Events carry `"type": "event"` plus an `"event"` field and an `evt_N` id.

## Commands

| Type | Payload | Result payload |
| --- | --- | --- |
| `PING` | `{}` | `{pong: true, uptimeMs}` |
| `GET_INFO` | `{}` | `{firmwareVersion, board, ledType, ledCount, uptimeMs, freeHeap}` |
| `GET_CAPABILITIES` | `{}` | see below |
| `GET_STATUS` | `{}` | `{activeProfileId, globalBrightness, anyLightOn, zones[], uptimeMs}` |
| `SET_PROFILE` | `{profileId, globalBrightness 0-100, zones[], fadeMs?}` | `{profileApplied, activeProfileId}` |
| `SET_ZONE` | `{zoneId, enabled, rgb{r,g,b 0-255}, brightness 0-100, fadeMs?}` | `{zoneApplied, zoneId}` |
| `SET_ALL_OFF` | `{}` | `{allOff: true}` |
| `RUN_TEST_PATTERN` | `{durationMs?}` (clamped to 15 s max) | `{testPatternStarted, durationMs}` |
| `SET_BRIGHTNESS` | `{globalBrightness 0-100}` | `{globalBrightness}` |
| `START_HEARTBEAT` | `{intervalMs >= 250}` | `{heartbeatStarted, intervalMs}` |
| `STOP_HEARTBEAT` | `{}` | `{heartbeatStopped}` |
| `RESET_CONTROLLER` | `{}` | `{resetting: true}` then reboot + `READY` |
| `SAVE_CONFIG` / `LOAD_CONFIG` | — | `UNKNOWN_COMMAND` in this firmware build (NVS persistence is a TODO) |

`SET_PROFILE` is **atomic and exclusive**: every zone is validated before any
LED changes, zones not listed go dark, and a failure leaves the rig all-off.

### Capabilities result

```json
{
  "firmwareVersion": "0.1.0",
  "board": "ESP32-S3",
  "ledType": "WS2812B",
  "maxBrightness": 200,
  "zones": [
    {"zoneId": "ZONE_TOP_DIFFUSE", "name": "Top Diffuse", "startPixel": 0, "pixelCount": 20, "installed": true},
    {"zoneId": "ZONE_EDGE_LEFT", "name": "Edge Left", "startPixel": 0, "pixelCount": 0, "installed": false}
  ],
  "supportsFade": true,
  "supportsProfiles": true,
  "supportsSavedConfig": false
}
```

Uninstalled zones are still listed so the UI can show them greyed out; using
them returns `ZONE_NOT_INSTALLED`.

## Events (rig → bridge, unsolicited)

| Event | When | Payload |
| --- | --- | --- |
| `READY` | after boot / reset | `{firmwareVersion, board}` |
| `HEARTBEAT` | every interval once started | `{uptimeMs, activeProfileId, anyLightOn, freeHeap}` |
| `LIGHTS_UPDATED` | after profile/all-off | `{activeProfileId, anyLightOn}` |
| `WATCHDOG_TIMEOUT` | failsafe fired (30 s silence with lights on) | `{reason, timeoutMs}` |
| `STATUS_CHANGED` | reserved | — |
| `ERROR` | async firmware error | `{code, message}` |

## Error codes

`INVALID_JSON`, `UNKNOWN_COMMAND`, `INVALID_PAYLOAD`, `UNKNOWN_ZONE`,
`ZONE_NOT_INSTALLED`, `PROFILE_APPLY_FAILED`, `BRIGHTNESS_OUT_OF_RANGE`,
`INTERNAL_ERROR`.

The bridge adds synthetic codes for its own failures: `COMMAND_TIMEOUT`,
`NOT_CONNECTED`, `WRITE_FAILED`.

Error response shape:

```json
{
  "id": "cmd_123",
  "type": "error",
  "status": "error",
  "timestamp": 123456,
  "payload": {"code": "UNKNOWN_ZONE", "message": "Zone ID ZONE_FAKE does not exist"}
}
```

## WebSocket API (web app ↔ bridge)

Client → bridge message types (JSON, optional `requestId` echoes back on the
reply): `rig:connect {portPath?}`, `rig:disconnect`, `rig:ping`,
`rig:get-info`, `rig:get-capabilities`, `rig:get-status`,
`rig:set-profile {profile}`, `rig:set-zone {zone}`, `rig:all-off`,
`rig:test-pattern {durationMs?}`, `rig:emergency-stop`, `rig:list-ports`,
`rig:capture-session {active, sessionId?}`.

Bridge → client events: `rig:connected`, `rig:disconnected`, `rig:status`,
`rig:capabilities`, `rig:profile-applied`, `rig:zone-updated`, `rig:ports`,
`rig:error`, `rig:heartbeat`, `rig:log`, `rig:ack`.

HTTP diagnostics: `GET /health`, `GET /rig/status`, `GET /rig/ports`,
`POST /rig/connect`, `POST /rig/disconnect`, `POST /rig/all-off`,
`POST /rig/test-pattern`.

## Timing & reliability rules

- One command in flight at a time (bridge command queue enforces this).
- Bridge command timeout: 3 s default (`RIG_COMMAND_TIMEOUT_MS`).
- Queued lighting commands coalesce latest-wins per target
  (`lighting:profile`, `lighting:zone:<id>`), so UI sliders can't flood the wire.
- Emergency stop flushes the queue and jumps to the front.
- Opening the serial port usually reboots the dev board (DTR/RTS); the bridge
  waits 300 ms and retries the first ping up to 3 times.
