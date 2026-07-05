#include "RigProtocol.h"

#include "../config/RigConfig.h"
#include "../led/ZoneMap.h"
#include "../utils/JsonHelpers.h"

// ---------------------------------------------------------------------------
// Serial line assembly
// ---------------------------------------------------------------------------

void RigProtocol::service() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n') {
      if (lineOverflow_) {
        lineOverflow_ = false;
        lineLength_ = 0;
        sendError("unknown", "INVALID_JSON", "Command exceeded max length");
        continue;
      }
      lineBuffer_[lineLength_] = '\0';
      if (lineLength_ > 0) handleLine(lineBuffer_);
      lineLength_ = 0;
    } else if (c != '\r') {
      if (lineLength_ < MAX_COMMAND_LENGTH - 1) {
        lineBuffer_[lineLength_++] = c;
      } else {
        lineOverflow_ = true;  // discard until next newline
      }
    }
  }
}

void RigProtocol::handleLine(char* line) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) {
    sendError("unknown", "INVALID_JSON", err.c_str());
    return;
  }
  dispatch(doc);
}

void RigProtocol::dispatch(JsonDocument& doc) {
  const char* id = doc["id"] | "unknown";
  const char* type = doc["type"] | "";
  JsonVariantConst payload = doc["payload"];

  // Any valid command resets the failsafe watchdog.
  state_.lastCommandAtMs = millis();

  if (strcmp(type, "PING") == 0)                return handlePing(id);
  if (strcmp(type, "GET_INFO") == 0)            return handleGetInfo(id);
  if (strcmp(type, "GET_CAPABILITIES") == 0)    return handleGetCapabilities(id);
  if (strcmp(type, "GET_STATUS") == 0)          return handleGetStatus(id);
  if (strcmp(type, "SET_PROFILE") == 0)         return handleSetProfile(id, payload);
  if (strcmp(type, "SET_ZONE") == 0)            return handleSetZone(id, payload);
  if (strcmp(type, "SET_ALL_OFF") == 0)         return handleSetAllOff(id);
  if (strcmp(type, "RUN_TEST_PATTERN") == 0)    return handleRunTestPattern(id, payload);
  if (strcmp(type, "SET_BRIGHTNESS") == 0)      return handleSetBrightness(id, payload);
  if (strcmp(type, "RESET_CONTROLLER") == 0)    return handleResetController(id);
  if (strcmp(type, "START_HEARTBEAT") == 0)     return handleStartHeartbeat(id, payload);
  if (strcmp(type, "STOP_HEARTBEAT") == 0)      return handleStopHeartbeat(id);
  if (strcmp(type, "SAVE_CONFIG") == 0 || strcmp(type, "LOAD_CONFIG") == 0) {
    // TODO: persist zone map / brightness limits to NVS (Preferences.h).
    return sendError(id, "UNKNOWN_COMMAND", "Saved config not supported in this firmware build");
  }
  sendError(id, "UNKNOWN_COMMAND", type[0] ? type : "missing command type");
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

void RigProtocol::handlePing(const char* id) {
  JsonDocument doc;
  doc["pong"] = true;
  doc["uptimeMs"] = millis();
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleGetInfo(const char* id) {
  JsonDocument doc;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["board"] = RIG_BOARD_NAME;
  doc["ledType"] = LED_TYPE_STR;
  doc["ledCount"] = LED_COUNT;
  doc["uptimeMs"] = millis();
  doc["freeHeap"] = ESP.getFreeHeap();
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleGetCapabilities(const char* id) {
  JsonDocument doc;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["board"] = RIG_BOARD_NAME;
  doc["ledType"] = LED_TYPE_STR;
  doc["maxBrightness"] = MAX_HARDWARE_BRIGHTNESS;
  JsonArray zones = doc["zones"].to<JsonArray>();
  for (int i = 0; i < ZONE_COUNT; i++) {
    JsonObject z = zones.add<JsonObject>();
    z["zoneId"] = ZONES[i].zoneId;
    z["name"] = ZONES[i].name;
    z["startPixel"] = ZONES[i].startPixel;
    z["pixelCount"] = ZONES[i].pixelCount;
    z["installed"] = ZONES[i].installed;
  }
  doc["supportsFade"] = true;
  doc["supportsProfiles"] = true;
  doc["supportsSavedConfig"] = false;
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleGetStatus(const char* id) {
  JsonDocument doc;
  doc["activeProfileId"] = state_.activeProfileId;
  doc["globalBrightness"] = state_.globalBrightnessPct;
  doc["anyLightOn"] = state_.anyLightOn;
  doc["testPatternActive"] = state_.testPatternActive;
  doc["uptimeMs"] = millis();
  JsonArray zones = doc["zones"].to<JsonArray>();
  for (int i = 0; i < ZONE_COUNT; i++) {
    if (!ZONES[i].installed) continue;
    JsonObject z = zones.add<JsonObject>();
    z["zoneId"] = ZONES[i].zoneId;
    z["enabled"] = state_.zones[i].enabled;
    JsonObject rgb = z["rgb"].to<JsonObject>();
    rgb["r"] = state_.zones[i].r;
    rgb["g"] = state_.zones[i].g;
    rgb["b"] = state_.zones[i].b;
    z["brightness"] = state_.zones[i].brightnessPct;
  }
  sendResult(id, doc.as<JsonVariantConst>());
}

bool RigProtocol::applyZoneCommand(const char* id, JsonVariantConst zoneJson, uint16_t fadeMs) {
  const char* zoneId = zoneJson["zoneId"] | (const char*)nullptr;
  if (zoneId == nullptr) {
    sendError(id, "INVALID_PAYLOAD", "zone command missing zoneId");
    return false;
  }
  const LedZone* zone = findZone(zoneId);
  if (zone == nullptr) {
    char msg[96];
    snprintf(msg, sizeof(msg), "Zone ID %s does not exist", zoneId);
    sendError(id, "UNKNOWN_ZONE", msg);
    return false;
  }
  if (!zone->installed) {
    char msg[96];
    snprintf(msg, sizeof(msg), "Zone %s is not installed", zoneId);
    sendError(id, "ZONE_NOT_INSTALLED", msg);
    return false;
  }

  bool enabled = zoneJson["enabled"] | false;
  uint8_t r, g, b, brightness;
  if (!readUint8(zoneJson["rgb"]["r"], 255, r) ||
      !readUint8(zoneJson["rgb"]["g"], 255, g) ||
      !readUint8(zoneJson["rgb"]["b"], 255, b)) {
    sendError(id, "INVALID_PAYLOAD", "rgb values must be integers 0-255");
    return false;
  }
  if (!readUint8(zoneJson["brightness"], 100, brightness)) {
    sendError(id, "BRIGHTNESS_OUT_OF_RANGE", "zone brightness must be 0-100");
    return false;
  }
  if (!leds_.setZoneColor(state_, zoneId, enabled, r, g, b, brightness, fadeMs)) {
    sendError(id, "PROFILE_APPLY_FAILED", "Failed to apply zone command");
    return false;
  }
  return true;
}

void RigProtocol::handleSetProfile(const char* id, JsonVariantConst payload) {
  const char* profileId = payload["profileId"] | (const char*)nullptr;
  JsonArrayConst zones = payload["zones"].as<JsonArrayConst>();
  if (profileId == nullptr || zones.isNull()) {
    return sendError(id, "INVALID_PAYLOAD", "SET_PROFILE requires profileId and zones[]");
  }
  uint8_t globalBrightness;
  if (!readUint8(payload["globalBrightness"], 100, globalBrightness)) {
    return sendError(id, "BRIGHTNESS_OUT_OF_RANGE", "globalBrightness must be 0-100");
  }
  uint16_t fadeMs = payload["fadeMs"] | 0;

  // Validate every zone BEFORE touching the LEDs so a profile applies
  // atomically or not at all.
  for (JsonVariantConst zoneJson : zones) {
    const char* zoneId = zoneJson["zoneId"] | (const char*)nullptr;
    const LedZone* zone = zoneId ? findZone(zoneId) : nullptr;
    if (zone == nullptr) {
      char msg[96];
      snprintf(msg, sizeof(msg), "Zone ID %s does not exist", zoneId ? zoneId : "(missing)");
      return sendError(id, "UNKNOWN_ZONE", msg);
    }
    if (!zone->installed) {
      char msg[96];
      snprintf(msg, sizeof(msg), "Zone %s is not installed", zoneId);
      return sendError(id, "ZONE_NOT_INSTALLED", msg);
    }
  }

  // Profiles are exclusive: zones not listed go dark.
  state_.testPatternActive = false;
  for (int i = 0; i < ZONE_COUNT; i++) state_.zones[i] = ZoneState{};
  state_.globalBrightnessPct = globalBrightness;

  for (JsonVariantConst zoneJson : zones) {
    if (!applyZoneCommand(id, zoneJson, fadeMs)) {
      // applyZoneCommand already sent the error; leave a safe state behind.
      leds_.setAllOff(state_);
      return;
    }
  }
  leds_.setGlobalBrightness(state_, globalBrightness);
  state_.setProfileId(profileId);
  state_.recomputeAnyLightOn();

  JsonDocument doc;
  doc["profileApplied"] = true;
  doc["activeProfileId"] = profileId;
  sendResult(id, doc.as<JsonVariantConst>());
  emitLightsUpdated();
}

void RigProtocol::handleSetZone(const char* id, JsonVariantConst payload) {
  uint16_t fadeMs = payload["fadeMs"] | 0;
  if (!applyZoneCommand(id, payload, fadeMs)) return;
  state_.setProfileId("custom");
  JsonDocument doc;
  doc["zoneApplied"] = true;
  doc["zoneId"] = payload["zoneId"].as<const char*>();
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleSetAllOff(const char* id) {
  leds_.setAllOff(state_);
  sendOkFlag(id, "allOff");
  emitLightsUpdated();
}

void RigProtocol::handleRunTestPattern(const char* id, JsonVariantConst payload) {
  uint32_t durationMs = payload["durationMs"] | (uint32_t)TEST_PATTERN_DEFAULT_DURATION_MS;
  leds_.startTestPattern(state_, durationMs);
  JsonDocument doc;
  doc["testPatternStarted"] = true;
  doc["durationMs"] = min(durationMs, (uint32_t)TEST_PATTERN_MAX_DURATION_MS);
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleSetBrightness(const char* id, JsonVariantConst payload) {
  uint8_t globalBrightness;
  if (!readUint8(payload["globalBrightness"], 100, globalBrightness)) {
    return sendError(id, "BRIGHTNESS_OUT_OF_RANGE", "globalBrightness must be 0-100");
  }
  leds_.setGlobalBrightness(state_, globalBrightness);
  JsonDocument doc;
  doc["globalBrightness"] = globalBrightness;
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleResetController(const char* id) {
  leds_.setAllOff(state_);
  sendOkFlag(id, "resetting");
  Serial.flush();
  delay(100);
  ESP.restart();
}

void RigProtocol::handleStartHeartbeat(const char* id, JsonVariantConst payload) {
  uint32_t intervalMs = payload["intervalMs"] | (uint32_t)HEARTBEAT_DEFAULT_INTERVAL_MS;
  if (intervalMs < 250) intervalMs = 250;
  state_.heartbeatEnabled = true;
  state_.heartbeatIntervalMs = intervalMs;
  state_.lastHeartbeatAtMs = 0;  // fire immediately
  JsonDocument doc;
  doc["heartbeatStarted"] = true;
  doc["intervalMs"] = intervalMs;
  sendResult(id, doc.as<JsonVariantConst>());
}

void RigProtocol::handleStopHeartbeat(const char* id) {
  state_.heartbeatEnabled = false;
  sendOkFlag(id, "heartbeatStopped");
}

// ---------------------------------------------------------------------------
// Response / event builders
// ---------------------------------------------------------------------------

void RigProtocol::sendResult(const char* id, JsonVariantConst payload) {
  JsonDocument doc;
  doc["id"] = id;
  doc["type"] = "result";
  doc["status"] = "ok";
  doc["timestamp"] = millis();
  doc["payload"] = payload;
  sendJson(doc);
}

void RigProtocol::sendOkFlag(const char* id, const char* flagName) {
  JsonDocument doc;
  doc["id"] = id;
  doc["type"] = "result";
  doc["status"] = "ok";
  doc["timestamp"] = millis();
  doc["payload"][flagName] = true;
  sendJson(doc);
}

void RigProtocol::sendError(const char* id, const char* code, const char* message) {
  JsonDocument doc;
  doc["id"] = id;
  doc["type"] = "error";
  doc["status"] = "error";
  doc["timestamp"] = millis();
  doc["payload"]["code"] = code;
  doc["payload"]["message"] = message;
  sendJson(doc);
}

void RigProtocol::sendEvent(const char* eventName, JsonVariantConst payload) {
  JsonDocument doc;
  eventCounter_++;
  char idBuf[24];
  snprintf(idBuf, sizeof(idBuf), "evt_%lu", (unsigned long)eventCounter_);
  doc["id"] = idBuf;
  doc["type"] = "event";
  doc["event"] = eventName;
  doc["status"] = "ok";
  doc["timestamp"] = millis();
  if (!payload.isNull()) doc["payload"] = payload;
  else doc["payload"].to<JsonObject>();
  sendJson(doc);
}

void RigProtocol::emitReady() {
  JsonDocument doc;
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["board"] = RIG_BOARD_NAME;
  sendEvent("READY", doc.as<JsonVariantConst>());
}

void RigProtocol::emitHeartbeat() {
  JsonDocument doc;
  doc["uptimeMs"] = millis();
  doc["activeProfileId"] = state_.activeProfileId;
  doc["anyLightOn"] = state_.anyLightOn;
  doc["freeHeap"] = ESP.getFreeHeap();
  sendEvent("HEARTBEAT", doc.as<JsonVariantConst>());
}

void RigProtocol::emitWatchdogTimeout() {
  JsonDocument doc;
  doc["reason"] = "No commands received; lights forced off";
  doc["timeoutMs"] = FAILSAFE_LIGHTS_OFF_MS;
  sendEvent("WATCHDOG_TIMEOUT", doc.as<JsonVariantConst>());
}

void RigProtocol::emitLightsUpdated() {
  JsonDocument doc;
  doc["activeProfileId"] = state_.activeProfileId;
  doc["anyLightOn"] = state_.anyLightOn;
  sendEvent("LIGHTS_UPDATED", doc.as<JsonVariantConst>());
}
