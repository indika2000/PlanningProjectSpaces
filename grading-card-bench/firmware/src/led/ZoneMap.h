#pragma once

// ---------------------------------------------------------------------------
// Physical LED zone map. Edit startPixel/pixelCount/installed to match how
// the strips are actually wired in your light box. Zones marked
// installed=false are still reported in capabilities (so the web app can
// show them greyed out) but reject SET_ZONE/SET_PROFILE usage.
//
// Mapping to the rig schematic (docs/hardware-guide.md):
//   D1 (diffused top panel)   -> ZONE_TOP_DIFFUSE (+ the other *_DIFFUSE
//                                zones if your panel is built from several
//                                strips behind one diffuser)
//   R1 (top raking LED bar)   -> ZONE_TOP_RAKING
//   R2 (right raking LED bar) -> ZONE_RIGHT_RAKING
//   R3 (bottom raking bar)    -> ZONE_BOTTOM_RAKING
//   R4 (left raking LED bar)  -> ZONE_LEFT_RAKING
//   O1+O2 (specular lights)   -> ZONE_SURFACE_GLARE
//   White reference patch     -> ZONE_CALIBRATION_WHITE
//
// All bars are chained on ONE data line (DIN->DOUT) in the pixel order below;
// startPixel/pixelCount are positions along that chain.
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
