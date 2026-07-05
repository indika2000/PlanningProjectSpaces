#pragma once

// ---------------------------------------------------------------------------
// Grading Card Bench rig controller configuration
// ---------------------------------------------------------------------------

#define FIRMWARE_VERSION "0.1.0"

#ifndef RIG_BOARD_NAME
#define RIG_BOARD_NAME "ESP32"
#endif

// LED hardware -----------------------------------------------------------------
#define LED_PIN 5
#define LED_COUNT 160
#define LED_TYPE_STR "WS2812B"   // reported in capabilities
#define COLOR_ORDER GRB

// Brightness / power safety ------------------------------------------------------
// Hard ceiling applied AFTER profile/global scaling. Protects the PSU and
// prevents an accidental full-white blast. Raise only after verifying the
// supply can feed LED_COUNT * 60mA.
#define MAX_HARDWARE_BRIGHTNESS 200   // of 255
#define DEFAULT_BRIGHTNESS 128
// FastLED power management: limit total draw (mA at 5V). Tune per PSU.
#define MAX_POWER_MILLIAMPS 4000

// Serial protocol ----------------------------------------------------------------
#define SERIAL_BAUD_RATE 115200
#define MAX_COMMAND_LENGTH 4096     // longest accepted JSON line
#define JSON_DOC_CAPACITY 8192      // ArduinoJson working memory

// Timing / safety ----------------------------------------------------------------
#define HEARTBEAT_DEFAULT_INTERVAL_MS 1000
// Failsafe: if no valid command arrives for this long while any LED is on,
// turn everything off and emit WATCHDOG_TIMEOUT. Heartbeat traffic from the
// bridge does NOT reset this on its own — only real commands do — so a wedged
// bridge can't keep lights on forever. START_HEARTBEAT counts as a command.
#define FAILSAFE_LIGHTS_OFF_MS 30000
// Test pattern always self-terminates:
#define TEST_PATTERN_MAX_DURATION_MS 15000
#define TEST_PATTERN_DEFAULT_DURATION_MS 5000
