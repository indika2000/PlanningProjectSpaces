# Grading Card Bench

A trading-card grading workstation: a web app that runs automated diagnostic
photo sequences of a card inside a custom LED light box, driven by an ESP32
photo-rig controller.

```
Web App UI (React)
   ↓ Rig Control Client (WebSocket)
Local Rig Bridge Service (Node.js)
   ↓ USB Serial (newline-delimited JSON)
ESP32 Firmware (FastLED)
   ↓
LED Zones (diffuse / raking / glare / edge / calibration)
```

The camera is driven by the browser (`getUserMedia`) in v1; the capture
orchestrator is camera-agnostic so a DSLR/gPhoto2/industrial camera adapter
can replace it later.

## Packages

| Directory | What it is | Stack |
| --- | --- | --- |
| `web/` | Operator app: rig control, capture bench, validation, review, calibration | React + TypeScript + Vite |
| `rig-bridge/` | Local hardware bridge: serial ↔ WebSocket/HTTP, command queue, failsafes | Node.js + TypeScript, `serialport`, `ws`, `zod`, `pino` |
| `firmware/` | ESP32 rig controller: LED zones, JSON protocol, watchdog | PlatformIO, Arduino, FastLED, ArduinoJson |
| `backend/` | Session/image storage API (no rig access — supports many stations) | Node.js + Express |
| `docs/` | Protocol, wiring, calibration, testing, troubleshooting | — |

## Quick start (no hardware needed)

```bash
# 1. Rig bridge with a simulated ESP32
cd rig-bridge && npm install && npm run dev:mock

# 2. Backend (optional — the web app degrades gracefully without it)
cd backend && npm install && npm run dev

# 3. Web app
cd web && npm install && npm run dev
# open http://localhost:5173, click "Connect rig", then "Start capture sequence"
```

With real hardware: flash `firmware/` with PlatformIO (`pio run -t upload`),
plug the rig in over USB, and run the bridge without `--mock`
(`npm run dev`). See [docs/setup.md](docs/setup.md).

## Reading order

1. [docs/setup.md](docs/setup.md) — install, flash, run
2. [docs/protocol.md](docs/protocol.md) — the JSON serial protocol
3. [docs/capture-sequences.md](docs/capture-sequences.md) — the diagnostic shot model
4. [docs/lighting-profiles.md](docs/lighting-profiles.md) — zones and profiles
5. [docs/calibration.md](docs/calibration.md) — bench calibration workflow
6. [docs/testing.md](docs/testing.md) — automated + manual hardware tests
7. [docs/troubleshooting.md](docs/troubleshooting.md)

## Safety model (read before powering LEDs)

- Firmware boots with all LEDs off and clamps brightness/power
  (`MAX_HARDWARE_BRIGHTNESS`, `MAX_POWER_MILLIAMPS` in `RigConfig.h`).
- A firmware watchdog turns lights off after 30 s without commands.
- Test patterns always self-terminate.
- The bridge sends all-off on shutdown, emergency stop, disconnect, and when
  the last web client leaves (unless a capture session is active).
- The web UI keeps an Emergency Lights Off button visible at all times.
