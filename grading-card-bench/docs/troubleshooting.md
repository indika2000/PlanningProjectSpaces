# Troubleshooting

## Bridge / connection

| Symptom | Likely cause / fix |
| --- | --- |
| Web UI: "Rig Bridge Service is not reachable" | Bridge isn't running — `cd rig-bridge && npm run dev` (or `dev:mock`). Check `VITE_RIG_BRIDGE_WS` matches the bridge port. |
| "No serial ports found" | USB cable is power-only, missing UART driver (CP210x/CH340), or Linux permissions (`dialout` group). `curl localhost:8787/rig/ports` to see what the bridge sees. |
| Connect succeeds then times out on ping | Wrong baud (firmware and bridge must both be 115200), or another program (serial monitor!) holds the port. |
| `serialport` failed to load native bindings | Reinstall (`npm rebuild serialport`) or run `--mock`. Node major-version changes require a rebuild. |
| Heartbeat "stale" warnings | USB flakiness or firmware crash. The bridge probes with ping and force-disconnects if dead — check `pio device monitor` for reboots (brown-out from LED load is common; separate LED PSU). |
| Command timeout mid-sequence | The step fails with an operator prompt. Check cable, click Retry. Persistent timeouts at high brightness = power brown-out. |

## LEDs

| Symptom | Fix |
| --- | --- |
| Nothing lights, protocol works | `LED_PIN` mismatch, no common ground, DIN connected at the strip's DOUT end. |
| Wrong colors | `COLOR_ORDER` (GRB vs RGB) in `RigConfig.h`. |
| Wrong zone lights up | `ZoneMap.h` pixel ranges don't match physical wiring — run zone verification in the Calibration tab. |
| Flicker / random pixels | Missing level shifter or series resistor; long data lead; noisy PSU. |
| Far end of strip dim/orange | Voltage drop — inject power at both ends. |
| Lights turned off by themselves | That's the firmware watchdog (`WATCHDOG_TIMEOUT` event, 30 s without commands). The bridge heartbeat task normally prevents it — if it fires while the bridge is up, the serial link is dropping. |

## Camera / capture

| Symptom | Fix |
| --- | --- |
| "Camera not ready" | Grant browser permission; camera in use by another app; try another device in the preview dropdown. |
| Every image fails "too dark" | Lighting profile didn't apply (check rig connection/log tab) or camera auto-exposure is fighting the dark box — raise settle time on the step. |
| Every image fails "blurry" | Recalibrate `sharpnessMin` (docs/calibration.md) — thresholds are camera-specific. Check focus and bench vibration. |
| "Card not detected" with card present | Background too bright relative to card (light box background should be dark/matte), or card outside frame. Use the alignment overlay in Calibration. |
| Images stuck "local only" | Backend not running / unreachable. Start `backend`, then re-approve; captures are never lost, they stay in the browser session. |

## Firmware

| Symptom | Fix |
| --- | --- |
| No READY on boot | Wrong monitor baud, or the board is in bootloader mode. |
| `INVALID_JSON` spam | Line noise or wrong baud from the host. |
| Reboots when many LEDs turn on | Power brown-out. Lower `MAX_POWER_MILLIAMPS` / `MAX_HARDWARE_BRIGHTNESS`, use a bigger PSU, never feed strips from the USB 5V. |
