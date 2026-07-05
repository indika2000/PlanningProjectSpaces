# Photo Rig Hardware Guide (Complete Beginner Edition)

This guide takes you from a box of parts to a working photo rig that matches
your schematic — the lighting box with a diffused top panel (**D1**), four
raking LED bars (**R1** top, **R2** right, **R3** bottom, **R4** left),
optional specular lights (**O1/O2**), a fixed overhead camera, and a card
tray inside a matte-black enclosure.

No electronics experience is assumed. Read it once end-to-end before buying
or soldering anything.

---

## 1. How the electronics work (2-minute version)

- The LED bars are **WS2812B "addressable" LED strips**. Every LED on a strip
  has a tiny chip. You send data down ONE wire and each LED takes its own
  color/brightness instructions.
- All your bars are connected in **one long chain**: the data wire goes out
  of bar 1 into bar 2, out of bar 2 into bar 3, and so on. To the software
  the whole rig is just "LED number 0 to 159", and a **zone map** says
  "LEDs 90–99 are the left raking bar".
- The **ESP32** is a small computer that generates that data signal. It
  listens on its USB cable for JSON commands from your PC ("turn on zone
  R2 at 90% white") and drives the LEDs.
- LEDs run on **5 volts** and can draw a LOT of current. The ESP32 cannot
  power them — a separate **5 V power supply** does. The USB cable only
  carries data + power for the ESP32 itself.

```
   PC (USB) ──── ESP32 ──data──► [D1 strips] ─► [R1] ─► [R2] ─► [R3] ─► [R4] ─► [O1/O2] ─► [white ref]
                                    ▲                                                        
   5V PSU ══════ 5V + GND ══════════╝  (power injected at the strip chain, NOT from the ESP32)
```

---

## 2. Shopping list (BOM)

| # | Part | Qty | Notes |
| --- | --- | --- | --- |
| 1 | ESP32-S3 DevKitC (or classic ESP32 DevKit) | 1 | Any dev board with USB. ~£8–15. The firmware supports both (`esp32s3` / `esp32dev` build envs). |
| 2 | WS2812B LED strip, 60 LEDs/m, IP30 (non-waterproof) | ~3 m | 160 LEDs total for the default zone map. Buy 5 m; spare matters. White PCB looks tidier in a light box. |
| 3 | 5 V power supply, **10 A (50 W)** | 1 | Sized in §4. Get one with a proper barrel jack or screw terminals, CE marked. |
| 4 | DC barrel jack adapter (screw terminal) | 1 | To connect the PSU to your wiring without soldering mains-side anything. |
| 5 | 74AHCT125 level shifter (or a "logic level converter" board) | 1 | Converts the ESP32's 3.3 V data signal to the 5 V the LEDs want. ~£1. |
| 6 | 330–470 Ω resistor | 1 | Goes in the data line right before the first LED. Protects the first LED. |
| 7 | 1000 µF electrolytic capacitor (6.3 V+) | 1–2 | Across 5V/GND at the strip's power input. Smooths turn-on surges. |
| 8 | Hookup wire, 18 AWG (power) + 22–24 AWG (data) | few m | Red/black for power, another color for data. |
| 9 | 3-pin JST-SM connectors (usually pre-fitted on strips) | ~8 pairs | Lets you unplug each bar. |
| 10 | Breadboard + jumper wires (prototyping) or a small perfboard (final) | 1 | The level shifter + resistor live here. |
| 11 | USB data cable for the ESP32 (USB-C or micro-USB per board) | 1 | Must be a DATA cable — many charge-only cables exist and cause "no port found". |
| 12 | Frosted acrylic / diffusion sheet | per box | For D1 and in front of each raking bar if you want softer raking. |
| 13 | Matte black paint / self-adhesive black felt | per box | Interior of the box, per the schematic. |
| 14 | USB webcam, 1080p+ with manual-focus or good close-focus | 1 | Mounted fixed overhead. |

Optional now, supported by the software later: extra strips for the edge
lighting modules (ZONE_EDGE_*), UV, turntable.

**Tools**: soldering iron + solder (strip cut points need soldering unless
you buy pre-wired segments), wire strippers, small screwdriver, multimeter
(cheap one is fine — you'll use it to check polarity before power-on).

---

## 3. Cutting the strips into bars (zone plan)

The default firmware zone map (`firmware/src/led/ZoneMap.h`) expects this
chain order. Cut your 60 LED/m strip **only at the marked cut lines**
(scissor icon between copper pads):

| Chain order | Schematic label | Zone id | LEDs | Pixel range | Where it goes |
| --- | --- | --- | --- | --- | --- |
| 1 | D1 (part 1) | ZONE_TOP_DIFFUSE | 20 | 0–19 | Behind the top diffuser panel |
| 2 | D1 (part 2) | ZONE_BOTTOM_DIFFUSE | 20 | 20–39 | Diffuser panel, second row* |
| 3 | D1 (part 3) | ZONE_LEFT_DIFFUSE | 20 | 40–59 | Diffuser panel, third row* |
| 4 | D1 (part 4) | ZONE_RIGHT_DIFFUSE | 20 | 60–79 | Diffuser panel, fourth row* |
| 5 | fill | ZONE_FRONT_FILL | 10 | 80–89 | Front fill near the camera side |
| 6 | R4 | ZONE_LEFT_RAKING | 10 | 90–99 | Left low-angle bar |
| 7 | R2 | ZONE_RIGHT_RAKING | 10 | 100–109 | Right low-angle bar |
| 8 | R1 | ZONE_TOP_RAKING | 10 | 110–119 | Top low-angle bar |
| 9 | R3 | ZONE_BOTTOM_RAKING | 10 | 120–129 | Bottom/front low-angle bar |
| 10 | O1+O2 | ZONE_SURFACE_GLARE | 15 | 130–144 | Specular/inspection lights |
| 11 | white ref | ZONE_CALIBRATION_WHITE | 15 | 145–159 | Lights the white reference patch |

\* Your schematic draws D1 as ONE diffused panel. Building it from four
20-LED rows behind one frosted sheet gives the same even panel **and** lets
software balance each row individually (that's how the uniformity
calibration fixes hot spots). If you build D1 differently (e.g. a COB mini
dome), just change the pixel counts in `ZoneMap.h` — it's the single source
of truth, and the web app discovers whatever you define.

**Raking bar placement (matters a lot)**: mount R1–R4 low, roughly at card
level, aiming across the card surface at a 10–20° grazing angle. Raking
light works because scratches and dents cast micro-shadows at those angles.

**O1/O2**: mount up high near the camera, angled so their reflection off the
card surface bounces into the lens (that's the "controlled glare" that
reveals waves and gloss breaks). If you're not building them yet, set
`installed = false` for `ZONE_SURFACE_GLARE` in `ZoneMap.h`; the shot-matrix
sequence marks Shot F optional so everything still runs.

---

## 4. Power supply sizing (why 10 A)

Worst case, one WS2812B at full white ≈ 60 mA.

```
160 LEDs × 60 mA = 9.6 A absolute worst case
```

You will never run everything at full white (the software's profiles run
60–95% on a few zones at a time), and the firmware enforces two ceilings:
`MAX_HARDWARE_BRIGHTNESS 200/255` and FastLED power limiting at
`MAX_POWER_MILLIAMPS 4000` (4 A). So:

- **10 A PSU** = comfortable, silent, cool. Recommended.
- **5 A PSU** = workable IF you keep `MAX_POWER_MILLIAMPS 4000`.
- Phone chargers / USB power = **no. Never.**

Rules:

1. **Never power the strips from the ESP32's 5V pin.** It can supply tens of
   mA; the strips want thousands.
2. **Always connect the grounds together** — PSU ground, strip ground, and
   ESP32 GND must all be one continuous ground. Data signals are measured
   against ground; without a shared ground the LEDs see gibberish.
3. If a far bar looks dim or orange-ish at high brightness, run a second
   pair of power wires from the PSU directly to that bar ("power
   injection"). Data stays as one chain; power can be fed at many points.

---

## 5. Wiring, step by step

### 5.1 ESP32 pin connections

The firmware default is **GPIO 5** for LED data (`LED_PIN` in
`RigConfig.h`). Pin numbers are printed on the dev board.

| ESP32 pin | Connects to | Wire |
| --- | --- | --- |
| GPIO 5 | Level shifter input (74AHCT125 pin 1A/2) | data (24 AWG) |
| GND | Level shifter GND **and** PSU/strip GND | black |
| USB port | The bench PC | USB data cable |
| 5V/VIN | *(nothing — leave unconnected)* | — |

74AHCT125 hookup (it has 4 identical buffers; we use one):

| 74AHCT125 pin | Connects to |
| --- | --- |
| VCC (pin 14) | +5 V from PSU |
| GND (pin 7) | common ground |
| 1OE (pin 1) | GND (enables the buffer) |
| 1A (pin 2) | ESP32 GPIO 5 |
| 1Y (pin 3) | → 330–470 Ω resistor → first strip's **DIN** |

If you bought a 2-channel "logic level converter" board instead: LV→3.3 V
from the ESP32's 3V3 pin, HV→5 V from the PSU, GND both sides common,
LV1 = GPIO 5, HV1 → resistor → DIN.

### 5.2 Strip chain

Every WS2812B segment has 3 pads on each end: **+5V**, **DIN/DOUT** (data),
**GND**. Arrows printed on the strip show data direction — **data only
flows in the arrow direction**, this is the #1 beginner mistake.

For each of the 11 bars in the §3 table, in chain order:

1. Solder/plug the previous bar's **DOUT** to this bar's **DIN** (data wire).
2. Connect **+5V to +5V** and **GND to GND** between bars (18 AWG), or run
   both from a power bus — either is fine as long as every bar gets 5 V and
   shares ground.
3. Keep each data hop short (< 30 cm ideally). Long hops: twist the data
   wire with a ground wire.

### 5.3 Power input

1. PSU 5 V → barrel adapter → **+5V rail** and **GND rail**.
2. Solder the **1000 µF capacitor** across +5V/GND right where power enters
   the first strip (stripe on the cap = negative = GND. Get this right;
   electrolytics vent if reversed).
3. PSU GND rail → ESP32 GND (one jumper wire).

### 5.4 Pre-power checklist (do this every time you rewire)

- [ ] Multimeter continuity: PSU GND ↔ ESP32 GND ↔ last bar's GND all beep.
- [ ] No continuity between +5V and GND (that would be a short).
- [ ] Data path: GPIO5 → shifter → resistor → **DIN** (arrow pointing away)
      of the FIRST bar in chain order.
- [ ] Capacitor polarity correct.
- [ ] Strips are IP30 stuck to a surface that can take a little warmth (the
      aluminum tape / bar profiles help).

First power-on: LEDs should do **nothing** (firmware boots dark — that's
correct and deliberate). If anything lights up bright white at power-on,
power off and check wiring; unprogrammed strips can latch random colors, so
flash the ESP32 before judging.

---

## 6. Flash the firmware and test each channel

1. Install [PlatformIO](https://platformio.org/install/cli) (`pip install platformio`).
2. Edit `firmware/src/config/RigConfig.h` if your build differs:
   `LED_PIN`, `LED_COUNT`, `MAX_POWER_MILLIAMPS` (match your PSU).
3. Edit `firmware/src/led/ZoneMap.h` if your pixel counts differ from §3.
4. Plug in the ESP32 and flash:
   ```bash
   cd firmware
   pio run -t upload            # ESP32-S3
   pio run -e esp32dev -t upload  # classic ESP32
   ```
5. Open the monitor: `pio device monitor -b 115200`. You should see the
   `READY` event as one line of JSON.
6. Paste this line into the monitor and press enter — the left raking bar
   (R4) should light white:
   ```
   {"id":"t1","type":"SET_ZONE","timestamp":"","payload":{"zoneId":"ZONE_LEFT_RAKING","enabled":true,"rgb":{"r":255,"g":255,"b":255},"brightness":50}}
   ```
7. And off again:
   ```
   {"id":"t2","type":"SET_ALL_OFF","timestamp":"","payload":{}}
   ```
8. Once the software stack is up (see
   [install-and-integration.md](install-and-integration.md)), use the web
   app's **Calibration → Zone verification** to walk every zone and confirm
   the right physical bar lights for each name. Wrong bar = swap entries in
   `ZoneMap.h`, reflash.

---

## 7. The box itself (from your schematic)

- **Matte black interior** everywhere — walls, floor, tray, baffles. Gloss
  black still reflects; use matte paint or black felt. This is what makes
  card detection and the raking shots work.
- **Card tray**: fixed, centered under the camera, with a shallow recess or
  corner guides so every card sits in the same spot (repeatability is what
  makes centering measurements comparable between cards).
- **Camera**: fixed overhead, never moves; ~25–35 cm above the tray so a
  63.5 × 88.9 mm card fills roughly ⅓–½ of the frame. Lock focus once
  (manual focus ring or the software's focus lock) and leave it.
- **D1 diffuser**: frosted acrylic 3–6 cm below the D1 LEDs so individual
  LEDs blur into one even panel. Leave a camera hole/slot.
- **Baffles**: small matte flags between the raking bars and the lens so no
  bar shines directly into the camera — you want light *across the card*,
  not into the lens (except O1/O2, whose whole job is a controlled
  reflection *off the card*).

## 8. Safety recap

- The 5 V side is low-voltage and safe to touch; the **mains side of the
  PSU is not** — use a sealed adapter-style PSU or put screw-terminal PSUs
  in an enclosure.
- The firmware boots dark, clamps brightness and total current, kills the
  lights after 30 s without commands, and the bridge/web add three more
  layers of "lights off when anything goes wrong" — see
  [architecture.md §6](architecture.md).
- LEDs at high brightness get warm. The default ceilings keep them well
  inside safe territory; still, stick strips to something solid, not bare
  foam.
