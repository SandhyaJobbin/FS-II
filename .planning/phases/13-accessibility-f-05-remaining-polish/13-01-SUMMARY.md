---
phase: 13-accessibility-f-05-remaining-polish
plan: 01
subsystem: frontend
tags: [refactor, testscreen, extract-first]

# Dependency graph
requires: []
provides:
  - "ZONE_CONFIG, ZONE_ORDER, and getZoneKey extracted to assessment-app/src/data/zone-config.tsx"
  - "QuestionHeader, ScenarioBlock, OptionsList, ZoneOverlays, CaseFilePanel presentational sub-components"
  - "useWebcamProctoring custom hook containing TF.js/BlazeFace webcam proctoring loop"
  - "useIntegrityMonitoring custom hook containing user activity tracking effects"
  - "TestScreen.tsx line count reduced to 496 lines (<500 line limit)"
affects: [13-03-aria-report, 13-04-light-theme, 13-05-ux-upgrades]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component split: decompose monolithic React component into presentational sub-components and client-side custom hooks"
    - "Custom state hooks: group related client-side monitoring side effects (webcam, tab focus) into specialized hooks"

key-files:
  created:
    - assessment-app/src/data/zone-config.tsx
    - assessment-app/src/components/test-screen/QuestionHeader.tsx
    - assessment-app/src/components/test-screen/ScenarioBlock.tsx
    - assessment-app/src/components/test-screen/OptionsList.tsx
    - assessment-app/src/components/test-screen/ZoneOverlays.tsx
    - assessment-app/src/components/test-screen/CaseFilePanel.tsx
    - assessment-app/src/components/test-screen/useWebcamProctoring.ts
    - assessment-app/src/components/test-screen/useIntegrityMonitoring.ts
    - tests/e2e/testscreen-refactor-snapshot.md
  modified:
    - assessment-app/src/components/TestScreen.tsx

key-decisions:
  - "Extracted zone configuration data into a TSX file due to embedded inline React JSX icon nodes"
  - "Extracted webcam face detection and proctoring scripts loading to useWebcamProctoring hook to maintain a clean TestScreen component body"
  - "Extracted candidate activity tracking (copy-paste, devtools, fullscreen exits) into useIntegrityMonitoring hook, saving over 80 lines and removing multiple side-effects from the main component"

patterns-established:
  - "All future additions to TestScreen.tsx must happen within modular sub-components or dedicated custom hooks to keep TestScreen.tsx under the 500-line cap"

requirements-completed: [A11Y-01, UX-01, UX-02, UX-03, UX-04, UX-05]

coverage:
  - id: D1
    description: "ZONE_CONFIG constant, ZONE_ORDER list, and getZoneKey helper successfully moved to a separate file zone-config.tsx"
    requirement: "A11Y-01"
    verification:
      - kind: other
        ref: "tsc check and build pass"
        status: pass
  - id: D2
    description: "Monolithic JSX structure in TestScreen split into QuestionHeader, ScenarioBlock, OptionsList, ZoneOverlays, and CaseFilePanel"
    requirement: "UX-01"
    verification:
      - kind: other
        ref: "tsc check and build pass"
        status: pass
  - id: D3
    description: "Webcam initialization and face tracking moved to useWebcamProctoring.ts"
    requirement: "UX-02"
    verification:
      - kind: other
        ref: "tsc check and build pass"
        status: pass
  - id: D4
    description: "Tab switch, copy-paste block, devtools detection and fullscreen monitoring moved to useIntegrityMonitoring.ts"
    requirement: "UX-02"
    verification:
      - kind: other
        ref: "tsc check and build pass"
        status: pass

duration: 40min
completed: 2026-08-01
status: complete
---

# Phase 13 Plan 01: Monolithic TestScreen.tsx Decompilation & Extraction Summary

**Extracted static data configuration, 5 presentational sub-components, and 2 custom hooks from `TestScreen.tsx` to modularize the candidate testing interface and successfully reduce the file size below the 500-line limit.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 5
- **Files created:** 9
- **Files modified:** 1

## Accomplishments
- Extracted `ZONE_CONFIG` data structures to a modular [zone-config.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/data/zone-config.tsx) file.
- Created [QuestionHeader.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/QuestionHeader.tsx), [ScenarioBlock.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/ScenarioBlock.tsx), [OptionsList.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/OptionsList.tsx), [ZoneOverlays.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/ZoneOverlays.tsx), and [CaseFilePanel.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/CaseFilePanel.tsx) presentational components to isolate layout sections.
- Created [useWebcamProctoring.ts](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/useWebcamProctoring.ts) and [useIntegrityMonitoring.ts](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/test-screen/useIntegrityMonitoring.ts) custom hooks to isolate webcam model loading/face presence loops and candidate action monitoring handlers.
- Reduced [TestScreen.tsx](file:///c:/Users/anoop/OneDrive/Desktop/FS-gamified-assessment/assessment-app/src/components/TestScreen.tsx) from **1179 to 496 lines** (satisfying the `<500` line cap check).
- Successfully completed type checks, Next.js build compilation, and all unit tests with no regressions.
