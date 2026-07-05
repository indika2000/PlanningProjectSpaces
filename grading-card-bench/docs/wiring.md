# Wiring Assumptions

```
                 5V PSU (sized for LED_COUNT × 60 mA worst case)
                  │
        ┌─────────┴──────────┐
        │                    │
   LED strips (5V)      ESP32 VIN (or separate USB power)
        │
   DIN ─┤◄── 330–470 Ω series resistor ◄── level shifter (74AHCT125) ◄── GPIO 5
        │
   1000 µF electrolytic across 5V/GND at the strip head
```

- **Common ground** between PSU, ESP32 and strips — always.
- WS2812B data is 5 V logic; the ESP32 outputs 3.3 V. A 74AHCT125 (or similar)
  level shifter is strongly recommended; short runs sometimes work without it,
  but flicker under load is the classic symptom.
- One continuous strip is assumed, zones are logical pixel ranges
  (`ZoneMap.h`). Physically separate strips/panels can be chained DIN→DOUT as
  long as pixel indexes line up with the zone map.
- Inject 5 V power at both ends (or every ~100 LEDs) to avoid brown-out
  dimming at the far end — that shows up as the uniformity check failing on
  one side.
- `MAX_POWER_MILLIAMPS` in `RigConfig.h` lets FastLED throttle total draw;
  set it below your PSU rating.
- USB from the bench computer to the ESP32 carries only serial, not LED power.

Zone layout (edit `ZoneMap.h` to match your box):

| Zone | Pixels | Purpose |
| --- | --- | --- |
| ZONE_TOP/BOTTOM/LEFT/RIGHT_DIFFUSE | 20 each | even illumination behind diffusers |
| ZONE_FRONT_FILL | 10 | fill from camera side |
| ZONE_*_RAKING | 10 each | low-angle strips at ~10–20° to the card plane |
| ZONE_SURFACE_GLARE | 15 | positioned to reflect off the card into the lens |
| ZONE_CALIBRATION_WHITE | 15 | lights a white reference patch |
| ZONE_EDGE_* / ZONE_BACK_FILL | 0 (not installed) | future modules |
