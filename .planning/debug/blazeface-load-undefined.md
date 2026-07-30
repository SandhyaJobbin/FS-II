---
slug: blazeface-load-undefined
status: investigating
trigger: "Console TypeError: Cannot read properties of undefined (reading 'loadGraphModel') at TestScreen.tsx initModel + Runtime AbortError: The play() request was interrupted by a new load request. Next.js 16.2.12 (Turbopack)"
created: 2026-07-29
updated: 2026-07-29
---

# Debug Session: blazeface-load-undefined

## Trigger

DATA_START
## Error Type
Console TypeError

## Error Message
Cannot read properties of undefined (reading 'loadGraphModel')

    at new Promise (<anonymous>:null:null)
    at TestScreen.useEffect.initModel (src/components/TestScreen.tsx:202:61)

## Code Frame
  200 | ...dScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazefac...
  201 | ...ve) return;
> 202 | ...dedModel = await (window as any).blazeface.load();
      |                                               ^
  203 | ...loadedModel);
  204 | ...r) {
  205 | ...rror('Failed to load BlazeFace model:', err);

Next.js version: 16.2.12 (Turbopack)

## Error Type
Runtime AbortError

## Error Message
The play() request was interrupted by a new load request.

Next.js version: 16.2.12 (Turbopack)
DATA_END

## Symptoms

- **Expected behavior:** BlazeFace face-detection model loads on TestScreen; webcam video plays
- **Actual behavior:** Console TypeError `Cannot read properties of undefined (reading 'loadGraphModel')` at `window.blazeface.load()` (TestScreen.tsx:202); Runtime AbortError `The play() request was interrupted by a new load request.`
- **Error messages:** See Trigger block (verbatim paste)
- **Timeline:** Unknown — surfaced right after previous fix (turbopack.root) made page load; possibly always present, previously masked by page never loading
- **Reproduction:** `npm run dev` → open localhost:3000 → navigate to test screen (webcam/face-detection step)

## Initial Hypothesis Seeds

- `loadGraphModel` of undefined strongly suggests the global `tf` (TensorFlow.js core + converter) is missing when `blazeface.load()` runs — blazeface UMD bundle calls `tf.loadGraphModel` internally. Check whether `@tensorflow/tfjs-core`/`tfjs-converter` CDN scripts are loaded BEFORE the blazeface script in the dynamic script loader (TestScreen.tsx ~line 200).
- AbortError `play() interrupted by a new load request` is the classic React StrictMode double-effect / srcObject-reassignment race in webcam setup — likely needs play() promise `.catch()` or effect-cleanup guard. Possibly secondary/independent.

## Current Focus

- hypothesis: fix-1 ineffective — `tfconv` alias not reaching blazeface UMD closure. Suspects: (a) stale `window.blazeface` from pre-fix script parse survives hot-reload; guard skips re-injection → old closure (tfconv=undefined at parse) still used; (b) alias ordering wrong relative to blazeface script parse (UMD captures globals at parse, not at load() call); (c) union tf.min.js build actually lacks loadGraphModel (verify `typeof window.tf.loadGraphModel`).
- test: hard refresh browser (clear stale globals); if persists, log `typeof window.tf`, `typeof window.tfconv`, `typeof window.tfconv?.loadGraphModel` immediately before blazeface.load()
- expecting: after hard refresh either error gone (stale closure) or tfconv.loadGraphModel confirmed undefined (alias/build issue)
- next_action: verify recurrence under hard refresh; inspect actual alias placement in TestScreen.tsx current code

## Recurrence (2026-07-29)

DATA_START
## Error Type
Console TypeError

## Error Message
Cannot read properties of undefined (reading 'loadGraphModel')

    at new Promise (<anonymous>:null:null)
    at TestScreen.useEffect.initModel (src/components/TestScreen.tsx:224:61)

## Code Frame
  222 | ...ve) return;
  223 | ...dow as any).blazeface) throw new Error('blazeface global not available after script lo...
> 224 | ...dedModel = await (window as any).blazeface.load();
      |                                               ^
  225 | ...ve) return;
  226 | ...loadedModel);
  227 | ...r) {

Next.js version: 16.2.12 (Turbopack)
DATA_END

Key facts: new guard code at :223 present and passed (blazeface global exists) → failure is INSIDE blazeface.load(), `loadGraphModel` dereference on undefined. Same error after fix cycle 1.

## Current Focus (fix cycle 2)

- hypothesis: CONFIRMED — race, not stale closure, not tfconv. blazeface@0.0.7 UMD factory args are `e(t.blazeface={}, t.tf, t.tf)` (bundle fetched and inspected; zero `tfconv` refs). `window.tf` captured at PARSE time. Old loadScript dedupe resolved immediately for in-flight scripts → StrictMode double-effect Run B appended blazeface script while tf still downloading → blazeface parsed with `t.tf === undefined` → `n.loadGraphModel` throws inside `load()`.
- fix applied: module-scope `scriptLoadPromises` map shares in-flight promise across effect re-runs; `script.async = false` forces insertion-order execution for dynamic scripts; `dataset.loaded` marker covers hot-reload remount path; removed bogus `tfconv` alias; added `tf.loadGraphModel` assertion before blazeface load.
- verification: `npx tsc --noEmit` exit 0. Runtime: pending user hard refresh.

## Evidence

- timestamp: 2026-07-29T00:00Z
  - source: code inspection — TestScreen.tsx:199-202
  - finding: union `tf.min.js@4.22.0` exposes only global `tf`. blazeface@0.0.7 UMD bundle expects legacy split globals `tf` (tfjs-core) AND `tfconv` (tfjs-converter); internally calls `tfconv.loadGraphModel(...)` → `tfconv` undefined → exact reported TypeError.
  - confirms: hypothesis 1 (missing tfjs-converter global)
- timestamp: 2026-07-29T00:00Z
  - source: code inspection — TestScreen.tsx:171-184 (webcam effect)
  - finding: `videoRef.current.play()` promise unhandled; no cancelled-guard on async getUserMedia. StrictMode double-effect / srcObject reassignment interrupts pending play() → AbortError surfaces as unhandled rejection.
  - confirms: hypothesis 2 (play()/srcObject race)
- timestamp: 2026-07-29T00:00Z
  - source: package.json grep
  - finding: no @tensorflow/* npm deps — CDN script route only, so UMD global contract is load-bearing.
- timestamp: 2026-07-29T00:00Z
  - source: `npx tsc --noEmit` after fix
  - finding: no TypeScript errors.
- timestamp: 2026-07-29 (cycle 2)
  - source: fetched blazeface@0.0.7/dist/blazeface.min.js (7996 bytes) and inspected UMD header
  - finding: global branch is `e(t.blazeface={}, t.tf, t.tf)` — BOTH factory args are `window.tf`. Zero `tfconv` references in bundle. Cycle-1 alias was a no-op against wrong diagnosis.
  - confirms: `n.loadGraphModel` undefined ⇒ `window.tf` undefined at blazeface parse time.
- timestamp: 2026-07-29 (cycle 2)
  - source: code inspection — loadScript (old lines 48-61)
  - finding: dedupe path `if (document.querySelector(script[src])) resolve()` resolves for IN-FLIGHT scripts. StrictMode double-effect → Run B skips past tf await before tf parsed → appends blazeface script early → async download race → blazeface can parse first → captures tf=undefined permanently in closure.
  - confirms: race mechanism explains recurrence even after hard refresh.

## Eliminated

- stale `window.blazeface` closure from pre-fix parse (hypothesis a) — plausible but not required; race (b′) sufficient and mechanism-confirmed
- `tfconv` missing-global theory (cycle-1 root cause) — bundle has no tfconv refs; alias was inert
- union tf.min.js lacking loadGraphModel — not reached; tf never present at parse time in failing runs

## Specialist Review

- specialist_hint: typescript/react → typescript-expert
- result: SKIPPED — skill not installed in this environment; no mapped skill available.

## Resolution

- root_cause (corrected, cycle 2): Two independent bugs: (1) blazeface@0.0.7 UMD captures `window.tf` at script PARSE time (`e(t.blazeface={}, t.tf, t.tf)`); loadScript dedupe resolved immediately for in-flight scripts, so StrictMode double-effect Run B appended the blazeface script before tf.min.js finished loading → blazeface parsed with `tf === undefined` → `loadGraphModel` dereference on undefined inside `load()`. (2) unhandled `video.play()` promise + missing effect-cancel guard → StrictMode/srcObject race → AbortError unhandled rejection (fixed cycle 1, stands).
- fix (cycle 2): module-scope `scriptLoadPromises` cache shares the in-flight load promise across effect re-runs (dedupe now waits for actual parse); `script.async = false` forces insertion-order execution for dynamically inserted scripts; `dataset.loaded` marker handles hot-reload remount (module state reset, tags persist); removed inert `tfconv` alias; added explicit `tf.loadGraphModel` assertion before blazeface script load.
- verification: `npx tsc --noEmit` exit 0 (cycle 2). Runtime verification pending user hard refresh of localhost:3000.
- files_changed: assessment-app/src/components/TestScreen.tsx
- guardrail: runtime repro check — model loads, face detection runs, no TypeError/AbortError in console.
