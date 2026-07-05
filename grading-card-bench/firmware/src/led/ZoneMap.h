#pragma once

// ---------------------------------------------------------------------------
// Physical LED zone map. Edit startPixel/pixelCount/installed to match how
// the strips are actually wired in your light box. Zones marked
// installed=false are still reported in capabilities (so the web app can
// show them greyed out) but reject SET_ZONE/SET_PROFILE usage.
// ---------------------------------------------------------------------------

struct LedZone {
  const char* zoneId;
  const char* name;
  int startPixel;
  int pixelCount;
  bool installed;
};

static const LedZone ZONES[] = {
  { "ZONE_TOP_DIFFUSE",       "Top Diffuse",       0,   20, true  },
  { "ZONE_BOTTOM_DIFFUSE",    "Bottom Diffuse",    20,  20, true  },
  { "ZONE_LEFT_DIFFUSE",      "Left Diffuse",      40,  20, true  },
  { "ZONE_RIGHT_DIFFUSE",     "Right Diffuse",     60,  20, true  },
  { "ZONE_FRONT_FILL",        "Front Fill",        80,  10, true  },
  { "ZONE_LEFT_RAKING",       "Left Raking",       90,  10, true  },
  { "ZONE_RIGHT_RAKING",      "Right Raking",      100, 10, true  },
  { "ZONE_TOP_RAKING",        "Top Raking",        110, 10, true  },
  { "ZONE_BOTTOM_RAKING",     "Bottom Raking",     120, 10, true  },
  { "ZONE_SURFACE_GLARE",     "Surface Glare",     130, 15, true  },
  { "ZONE_CALIBRATION_WHITE", "Calibration White", 145, 15, true  },
  // Future modules — wired later, discoverable now:
  { "ZONE_BACK_FILL",         "Back Fill",         0,   0,  false },
  { "ZONE_EDGE_LEFT",         "Edge Left",         0,   0,  false },
  { "ZONE_EDGE_RIGHT",        "Edge Right",        0,   0,  false },
  { "ZONE_EDGE_TOP",          "Edge Top",          0,   0,  false },
  { "ZONE_EDGE_BOTTOM",       "Edge Bottom",       0,   0,  false },
};

static const int ZONE_COUNT = sizeof(ZONES) / sizeof(ZONES[0]);

inline const LedZone* findZone(const char* zoneId) {
  if (zoneId == nullptr) return nullptr;
  for (int i = 0; i < ZONE_COUNT; i++) {
    if (strcmp(ZONES[i].zoneId, zoneId) == 0) return &ZONES[i];
  }
  return nullptr;
}
