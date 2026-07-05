# Lighting Profiles

A lighting profile describes a complete rig illumination state:

```ts
type LightingProfile = {
  id: string;
  name: string;
  description: string;
  zones: LightingZoneCommand[];   // zones not listed are OFF
  globalBrightness: number;       // 0-100 scaler over all zones
  colorTemperatureHint?: number;  // informational, for camera WB
  purpose: string[];
};

type LightingZoneCommand = {
  zoneId: string;
  enabled: boolean;
  rgb: { r: number; g: number; b: number };  // 0-255
  brightness: number;                        // 0-100 zone-relative
};
```

Defaults live in `web/src/features/capture/lightingProfiles.ts`:
`all_off`, `diffuse_full_front`, `diffuse_full_back`, `raking_left`,
`raking_right`, `raking_top`, `raking_bottom`, `surface_glare`,
`edge_lighting`, `calibration_white`.

## Semantics

- Applying a profile is **exclusive**: zones absent from the profile turn off
  (enforced by firmware `SET_PROFILE`).
- Effective LED value = `rgb × zone brightness% × global brightness%`,
  then clamped by the firmware hardware ceiling (`MAX_HARDWARE_BRIGHTNESS`)
  and FastLED power limiting (`MAX_POWER_MILLIAMPS`).
- Profiles referencing uninstalled zones are filtered client-side
  (`adaptProfileToCapabilities`) with a warning log; the firmware would
  reject them with `ZONE_NOT_INSTALLED` otherwise.
- `fadeMs` (0–5000) is supported per profile/zone application.

## Managing profiles

- **Edit/version/export**: profiles are plain JSON. The backend stores custom
  profiles (`GET/POST/PATCH/DELETE /api/lighting-profiles`); export/import is
  a copy of the JSON document. Give edited profiles a new id
  (`raking_left_v2`) rather than mutating a version referenced by existing
  session metadata — stored images point at profile ids.
- **Per-rig calibration**: brightness values in a profile are calibrated to a
  specific physical rig. Keep rig-specific overrides in a copy of the profile
  and record the rig id in the calibration profile (docs/calibration.md).
- **Linking to sequences**: capture steps reference `lightingProfileId`;
  validation profiles are chosen per step, not per lighting profile.
