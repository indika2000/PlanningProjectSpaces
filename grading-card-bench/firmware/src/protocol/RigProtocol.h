#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include "../led/LedController.h"
#include "../state/RigState.h"

// RigProtocol: newline-delimited JSON command parser + dispatcher.
//
// Wire format (bridge -> rig):
//   {"id":"cmd_0001","type":"SET_PROFILE","timestamp":"...","payload":{...}}\n
// Replies (rig -> bridge):
//   {"id":"cmd_0001","type":"result|error","status":"ok|error","timestamp":<uptime ms>,"payload":{...}}\n
// Unsolicited events:
//   {"id":"evt_7","type":"event","event":"HEARTBEAT","status":"ok","timestamp":...,"payload":{...}}\n
class RigProtocol {
 public:
  RigProtocol(LedController& leds, RigState& state) : leds_(leds), state_(state) {}

  // Read available serial bytes; dispatch complete lines. Call from loop().
  void service();

  // Unsolicited events.
  void emitReady();
  void emitHeartbeat();
  void emitWatchdogTimeout();
  void emitLightsUpdated();

 private:
  void handleLine(char* line);
  void dispatch(JsonDocument& doc);

  // Command handlers ---------------------------------------------------------
  void handlePing(const char* id);
  void handleGetInfo(const char* id);
  void handleGetCapabilities(const char* id);
  void handleGetStatus(const char* id);
  void handleSetProfile(const char* id, JsonVariantConst payload);
  void handleSetZone(const char* id, JsonVariantConst payload);
  void handleSetAllOff(const char* id);
  void handleRunTestPattern(const char* id, JsonVariantConst payload);
  void handleSetBrightness(const char* id, JsonVariantConst payload);
  void handleResetController(const char* id);
  void handleStartHeartbeat(const char* id, JsonVariantConst payload);
  void handleStopHeartbeat(const char* id);

  // Response builders ---------------------------------------------------------
  void sendResult(const char* id, JsonVariantConst payload);
  void sendOkFlag(const char* id, const char* flagName);
  void sendError(const char* id, const char* code, const char* message);
  void sendEvent(const char* eventName, JsonVariantConst payload);

  // Returns true and fills zone command fields, or sends an error and returns false.
  bool applyZoneCommand(const char* id, JsonVariantConst zoneJson, uint16_t fadeMs);

  LedController& leds_;
  RigState& state_;
  char lineBuffer_[MAX_COMMAND_LENGTH];
  size_t lineLength_ = 0;
  bool lineOverflow_ = false;
  uint32_t eventCounter_ = 0;
};
