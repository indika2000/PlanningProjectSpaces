// Grading Card Bench — Photo Rig Controller
//
// Boot behavior: all LEDs off, then READY event on serial.
// Failsafe: if lights are on and no command arrives for
// FAILSAFE_LIGHTS_OFF_MS, everything turns off and WATCHDOG_TIMEOUT is sent.

#include <Arduino.h>
#include "config/RigConfig.h"
#include "led/LedController.h"
#include "protocol/RigProtocol.h"
#include "state/RigState.h"

RigState g_state;  // referenced by LedController's fade engine
static LedController g_leds;
static RigProtocol g_protocol(g_leds, g_state);

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  Serial.setRxBufferSize(2048);

  // Safety first: LEDs dark before anything else happens.
  g_leds.begin();
  g_leds.setAllOff(g_state);

  g_state.lastCommandAtMs = millis();
  delay(50);
  g_protocol.emitReady();
}

void loop() {
  // 1. Process any inbound commands.
  g_protocol.service();

  // 2. Step fades and the test pattern.
  g_leds.service();
  g_leds.serviceTestPattern(g_state);

  // 3. Heartbeat.
  uint32_t now = millis();
  if (g_state.heartbeatEnabled &&
      (now - g_state.lastHeartbeatAtMs) >= g_state.heartbeatIntervalMs) {
    g_state.lastHeartbeatAtMs = now;
    g_protocol.emitHeartbeat();
  }

  // 4. Failsafe watchdog: lights on + silent host => go dark.
  if (g_state.anyLightOn &&
      (now - g_state.lastCommandAtMs) >= FAILSAFE_LIGHTS_OFF_MS) {
    g_leds.setAllOff(g_state);
    g_protocol.emitWatchdogTimeout();
  }
}
