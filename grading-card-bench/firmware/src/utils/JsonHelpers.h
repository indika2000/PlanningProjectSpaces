#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

// Small helpers for building protocol responses. Responses are written
// straight to Serial to avoid holding two large buffers.

inline void sendJson(JsonDocument& doc) {
  serializeJson(doc, Serial);
  Serial.println();
}

// Extract a uint8 in [0, maxValue]; returns false when missing/out of range.
inline bool readUint8(JsonVariantConst v, uint8_t maxValue, uint8_t& out) {
  if (v.isNull() || !v.is<int>()) return false;
  int value = v.as<int>();
  if (value < 0 || value > maxValue) return false;
  out = (uint8_t)value;
  return true;
}
