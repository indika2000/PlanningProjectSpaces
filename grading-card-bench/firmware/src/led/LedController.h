#pragma once

#include <Arduino.h>
#include "../state/RigState.h"
#include "../led/ZoneMap.h"

// LedController owns the FastLED pixel buffer and translates zone-level
// commands into pixel writes. All safety clamping (brightness ceiling,
// power limit) happens here so no caller can bypass it.
class LedController {
 public:
  void begin();

  // Immediately turn every pixel off and clear zone state.
  void setAllOff(RigState& state);

  // Set one zone. Returns false if the zone is unknown or not installed.
  bool setZoneColor(RigState& state, const char* zoneId, bool enabled,
                    uint8_t r, uint8_t g, uint8_t b, uint8_t brightnessPct,
                    uint16_t fadeMs);

  // Apply global brightness (0-100) and re-render all zones.
  void setGlobalBrightness(RigState& state, uint8_t brightnessPct);

  // Test pattern: cycles through installed zones one at a time.
  void startTestPattern(RigState& state, uint32_t durationMs);
  void serviceTestPattern(RigState& state);  // call from loop()

  // Fade engine: call from loop(); steps active fades and shows when dirty.
  void service();

  // Push the pixel buffer to the strip.
  void show();

 private:
  void renderZone(const RigState& state, int zoneIndex);
  void renderAll(const RigState& state);
};
