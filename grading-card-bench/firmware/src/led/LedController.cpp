#include "LedController.h"

#include <FastLED.h>
#include "../config/RigConfig.h"

static CRGB pixels[LED_COUNT];

// Per-zone fade bookkeeping (simple linear interpolation toward a target).
struct ZoneFade {
  bool active = false;
  uint32_t startMs = 0;
  uint16_t durationMs = 0;
  ZoneState from;
  ZoneState to;
};
static ZoneFade fades[ZONE_COUNT];

static int zoneIndexOf(const char* zoneId) {
  for (int i = 0; i < ZONE_COUNT; i++) {
    if (strcmp(ZONES[i].zoneId, zoneId) == 0) return i;
  }
  return -1;
}

void LedController::begin() {
  FastLED.addLeds<WS2812B, LED_PIN, COLOR_ORDER>(pixels, LED_COUNT);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, MAX_POWER_MILLIAMPS);
  FastLED.setBrightness(MAX_HARDWARE_BRIGHTNESS);
  fill_solid(pixels, LED_COUNT, CRGB::Black);
  FastLED.show();
}

void LedController::setAllOff(RigState& state) {
  for (int i = 0; i < ZONE_COUNT; i++) fades[i].active = false;
  state.clearAllZones();
  fill_solid(pixels, LED_COUNT, CRGB::Black);
  show();
}

// Scale a color channel by zone brightness %, global brightness %.
// The hardware ceiling (MAX_HARDWARE_BRIGHTNESS) is applied by FastLED's
// global brightness set in begin().
static uint8_t scaleChannel(uint8_t channel, uint8_t zonePct, uint8_t globalPct) {
  uint32_t value = (uint32_t)channel * zonePct * globalPct;
  return (uint8_t)(value / (100UL * 100UL));
}

void LedController::renderZone(const RigState& state, int zoneIndex) {
  const LedZone& zone = ZONES[zoneIndex];
  if (!zone.installed || zone.pixelCount == 0) return;
  const ZoneState& zs = state.zones[zoneIndex];
  CRGB color = CRGB::Black;
  if (zs.enabled && zs.brightnessPct > 0) {
    color = CRGB(scaleChannel(zs.r, zs.brightnessPct, state.globalBrightnessPct),
                 scaleChannel(zs.g, zs.brightnessPct, state.globalBrightnessPct),
                 scaleChannel(zs.b, zs.brightnessPct, state.globalBrightnessPct));
  }
  int end = min(zone.startPixel + zone.pixelCount, (int)LED_COUNT);
  for (int p = zone.startPixel; p < end; p++) pixels[p] = color;
}

void LedController::renderAll(const RigState& state) {
  fill_solid(pixels, LED_COUNT, CRGB::Black);
  for (int i = 0; i < ZONE_COUNT; i++) renderZone(state, i);
}

bool LedController::setZoneColor(RigState& state, const char* zoneId, bool enabled,
                                 uint8_t r, uint8_t g, uint8_t b,
                                 uint8_t brightnessPct, uint16_t fadeMs) {
  int idx = zoneIndexOf(zoneId);
  if (idx < 0) return false;
  if (!ZONES[idx].installed) return false;

  ZoneState target;
  target.enabled = enabled;
  target.r = r; target.g = g; target.b = b;
  target.brightnessPct = brightnessPct > 100 ? 100 : brightnessPct;

  if (fadeMs > 0) {
    fades[idx].active = true;
    fades[idx].startMs = millis();
    fades[idx].durationMs = fadeMs;
    fades[idx].from = state.zones[idx];
    fades[idx].to = target;
    // Fade target becomes the committed state immediately so status queries
    // and the failsafe see where we're headed.
    state.zones[idx] = target;
  } else {
    fades[idx].active = false;
    state.zones[idx] = target;
    renderZone(state, idx);
    show();
  }
  state.recomputeAnyLightOn();
  return true;
}

void LedController::setGlobalBrightness(RigState& state, uint8_t brightnessPct) {
  state.globalBrightnessPct = brightnessPct > 100 ? 100 : brightnessPct;
  renderAll(state);
  show();
}

void LedController::service() {
  bool dirty = false;
  uint32_t now = millis();
  for (int i = 0; i < ZONE_COUNT; i++) {
    if (!fades[i].active) continue;
    ZoneFade& f = fades[i];
    uint32_t elapsed = now - f.startMs;
    float t = f.durationMs == 0 ? 1.0f : (float)elapsed / (float)f.durationMs;
    if (t >= 1.0f) {
      t = 1.0f;
      f.active = false;
    }
    // Interpolate in a scratch copy, render it directly to pixels.
    const LedZone& zone = ZONES[i];
    if (zone.installed && zone.pixelCount > 0) {
      auto lerp8 = [t](uint8_t a, uint8_t b) -> uint8_t {
        return (uint8_t)(a + (int)((b - a) * t));
      };
      uint8_t zonePct = lerp8(f.from.enabled ? f.from.brightnessPct : 0,
                              f.to.enabled ? f.to.brightnessPct : 0);
      // Note: global brightness of the *current* state applies.
      extern RigState g_state;  // defined in main.cpp
      CRGB color(scaleChannel(lerp8(f.from.r, f.to.r), zonePct, g_state.globalBrightnessPct),
                 scaleChannel(lerp8(f.from.g, f.to.g), zonePct, g_state.globalBrightnessPct),
                 scaleChannel(lerp8(f.from.b, f.to.b), zonePct, g_state.globalBrightnessPct));
      int end = min(zone.startPixel + zone.pixelCount, (int)LED_COUNT);
      for (int p = zone.startPixel; p < end; p++) pixels[p] = color;
      dirty = true;
    }
  }
  if (dirty) show();
}

void LedController::startTestPattern(RigState& state, uint32_t durationMs) {
  if (durationMs == 0) durationMs = TEST_PATTERN_DEFAULT_DURATION_MS;
  if (durationMs > TEST_PATTERN_MAX_DURATION_MS) durationMs = TEST_PATTERN_MAX_DURATION_MS;
  state.testPatternActive = true;
  state.testPatternEndsAtMs = millis() + durationMs;
  state.testPatternStepAtMs = 0;
  state.testPatternZoneIndex = -1;
  state.recomputeAnyLightOn();
}

void LedController::serviceTestPattern(RigState& state) {
  if (!state.testPatternActive) return;
  uint32_t now = millis();
  if ((int32_t)(now - state.testPatternEndsAtMs) >= 0) {
    // Auto-stop: pattern must never run indefinitely.
    setAllOff(state);
    return;
  }
  if (now - state.testPatternStepAtMs < 500) return;
  state.testPatternStepAtMs = now;

  // Advance to the next installed zone and light only it, dim white.
  fill_solid(pixels, LED_COUNT, CRGB::Black);
  for (int step = 0; step < ZONE_COUNT; step++) {
    state.testPatternZoneIndex = (state.testPatternZoneIndex + 1) % ZONE_COUNT;
    const LedZone& zone = ZONES[state.testPatternZoneIndex];
    if (zone.installed && zone.pixelCount > 0) {
      int end = min(zone.startPixel + zone.pixelCount, (int)LED_COUNT);
      for (int p = zone.startPixel; p < end; p++) pixels[p] = CRGB(64, 64, 64);
      break;
    }
  }
  show();
}

void LedController::show() {
  FastLED.show();
}
