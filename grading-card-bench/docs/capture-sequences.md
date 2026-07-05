# Capture Sequences

A capture sequence is pure data (`web/src/features/capture/captureSequences.ts`)
executed by the `CaptureSequenceEngine`. Each step names a lighting profile, a
validation profile, settle time and retry budget.

## Why each shot exists (diagnostic philosophy)

| Shot | Lighting | Reveals |
| --- | --- | --- |
| Front/Back diffuse | all diffuse zones | centering, borders, print registration, color, obvious corner/edge damage |
| Left/Right raking | single low-angle zone | scratches, dents, impressions, foil defects, roller marks, gloss disruption |
| Top/Bottom raking (optional) | single low-angle zone | vertical scratches, waves, creases |
| Controlled glare | glare zone + weak top raking | surface waves, bends, gloss inconsistency, creases, pressing defects |
| Edge lighting (future) | perimeter zones | edge wear, whitening, layer separation, cut quality |
| Calibration white | calibration zone | white balance, exposure consistency, uniformity |

Every image is stored with the lighting profile, zone states, settle time,
camera metadata and validation result, so downstream analysis knows exactly
what illumination produced each frame.

## Engine lifecycle per step

```
lighting → settling → capturing → validating → accepted
                                     │
                        (fail, retries left) → retry
                                     │
                        (retries exhausted / hardware error)
                                     ↓
                    awaiting_operator: retry / skip / accept anyway / abort
```

Between the last front step and the first back step the engine turns all
lights off and waits for the operator to confirm the flip
(`awaiting_flip` → `confirmCardFlipped()`).

Session-level states: `capturing`, `paused`, `awaiting_flip`,
`awaiting_operator`, `review` (all shots done, awaiting approval),
`completed`, `failed`, `cancelled`.

Controls exposed by the engine (all wired into the UI):
`start`, `pause`, `resume`, `cancel`, `resolveOperatorDecision`,
`confirmCardFlipped`, `skipCurrentStep`, `rerunStep(stepId)`,
`captureManual(profileId)`, `acceptImage`, `rejectImage`,
`markSessionCompleted`.

## Failure handling matrix

| Failure | Engine behavior |
| --- | --- |
| Rig disconnected mid-sequence | step fails → operator prompt; `retry` re-runs `ensureConnected()` first |
| Camera unavailable | same path; `ensureReady()` re-checked on retry |
| Blurry / dark / card missing / clipped | validation fails → auto retry up to `maxRetries`, then operator prompt with the specific check message |
| ESP command timeout | surfaces as rig error → operator prompt |
| Cancel | current phase aborts, lights off, session `cancelled` |
| Pause | engine holds before the next phase/step |
| Browser refresh | session state was mirrored to localStorage + backend after every step (`BrowserCaptureStorage.loadLocalSession`) |
| Backend storage failure | capture continues; image kept locally and flagged "local only" in review |

## Adding a custom sequence

```ts
const mysequence: CaptureSequenceDefinition = {
  id: "premium_slab_v1",
  name: "Premium Slab Set",
  description: "…",
  version: 1,
  steps: [ /* CaptureStep[] — see capture.types.ts */ ],
};
```

Register it in `CAPTURE_SEQUENCES` or POST it to
`/api/capture-sequences` and merge at load time. Steps referencing lighting
zones the rig doesn't have are still runnable — profiles are filtered to
installed zones with a logged warning.
