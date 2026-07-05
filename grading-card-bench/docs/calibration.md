# Calibration

Run calibration when a rig is first assembled, whenever the camera or holder
moves, and periodically (weekly) as drift insurance. Tools live in the
web app's **Calibration** tab.

## 1. Zone verification

For each installed zone the panel lights that zone alone at dim white and asks
the operator to confirm the correct physical area lit up. Results are saved in
the calibration profile (`zoneVerification`). A "wrong zone" answer almost
always means `ZoneMap.h` pixel ranges don't match the physical wiring order.

## 2. Camera / card alignment

Place a reference card in the holder under `diffuse_full_front`. The overlay
in the review panel draws the detected card bounds; verify:

- the card is centered (bounds roughly symmetric in frame),
- it occupies ~15–60% of the frame area,
- skew < 3° (straighten the holder otherwise),
- no side is within 2% of the frame edge.

These same thresholds are what validation enforces at capture time
(`web/src/features/validation/imageValidationService.ts`), so a bench that
passes alignment will pass capture validation.

## 3. Exposure / white reference

"Exposure / white reference" applies `calibration_white`, captures a frame and
reports mean brightness + clipping. Target: mean 100–230, minimal blown-out
pixels. If it's off, adjust `calibration_white` profile brightness or camera
exposure, not the validation thresholds.

The captured white frame's average RGB is the white-balance reference — store
it in the calibration profile (`whiteBalanceReference`) so later color work
can normalize per-rig.

## 4. Lighting uniformity

"Lighting uniformity" applies the diffuse profile and compares mean luma of
left/right and top/bottom bands. Imbalance > 30 luma points indicates uneven
zones: check diffuser seating, per-zone brightness in the profile, and power
injection (far strip ends dim first — see wiring.md).

## 5. Sharpness threshold calibration

The sharpness check is a variance-of-Laplacian on a ~512 px downsampled gray
image. Absolute values depend on camera + optics, so calibrate per rig:

1. Capture a well-focused diffuse shot; note the sharpness score in the
   review panel (typically hundreds+).
2. Defocus slightly; note the score again.
3. Set `sharpnessMin` in the validation profiles between the two.

## Calibration profile

Saved to localStorage today (`RigCalibrationProfile` in
`CalibrationPanel.tsx`); the type is designed to move to the backend later:

```ts
type RigCalibrationProfile = {
  calibrationId: string;
  rigId?: string;
  cameraDeviceId?: string;
  createdAt: string;
  cardGuideBounds?: Rect;
  expectedCardAreaPercentage?: number;
  brightnessTarget?: number;
  whiteBalanceReference?: { r: number; g: number; b: number };
  zoneVerification: Record<string, boolean>;
  notes?: string;
};
```
