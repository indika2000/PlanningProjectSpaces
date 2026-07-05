#pragma once

#include <Arduino.h>
#include "../config/RigConfig.h"
#include "../led/ZoneMap.h"

// Runtime state of one zone as last commanded.
struct ZoneState {
  bool enabled = false;
  uint8_t r = 0, g = 0, b = 0;
  uint8_t brightnessPct = 0;  // 0-100
};

// Global controller state. One instance, owned by main.cpp.
struct RigState {
  ZoneState zones[ZONE_COUNT];
  char activeProfileId[64] = "all_off";
  uint8_t globalBrightnessPct = 0;      // 0-100
  bool anyLightOn = false;

  // Heartbeat
  bool heartbeatEnabled = false;
  uint32_t heartbeatIntervalMs = HEARTBEAT_DEFAULT_INTERVAL_MS;
  uint32_t lastHeartbeatAtMs = 0;

  // Failsafe watchdog: last time a valid command was processed.
  uint32_t lastCommandAtMs = 0;

  // Test pattern
  bool testPatternActive = false;
  uint32_t testPatternEndsAtMs = 0;
  uint32_t testPatternStepAtMs = 0;
  int testPatternZoneIndex = 0;

  void recomputeAnyLightOn() {
    anyLightOn = false;
    if (testPatternActive) { anyLightOn = true; return; }
    for (int i = 0; i < ZONE_COUNT; i++) {
      if (zones[i].enabled && zones[i].brightnessPct > 0) {
        anyLightOn = true;
        return;
      }
    }
  }

  void setProfileId(const char* id) {
    strncpy(activeProfileId, id, sizeof(activeProfileId) - 1);
    activeProfileId[sizeof(activeProfileId) - 1] = '\0';
  }

  void clearAllZones() {
    for (int i = 0; i < ZONE_COUNT; i++) zones[i] = ZoneState{};
    testPatternActive = false;
    anyLightOn = false;
    setProfileId("all_off");
  }
};
