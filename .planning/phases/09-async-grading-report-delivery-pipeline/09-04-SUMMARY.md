---
phase: 09-async-grading-report-delivery-pipeline
plan: 04
subsystem: ui
tags: [react, nextjs, framer-motion, phosphor-icons, async-reporting]

# Dependency graph
requires:
  - phase: 09-async-grading-report-delivery-pipeline
    provides: "09-01's fast-enqueue-only handleSubmitAnswers (no inline report field) and READY_STATUSES allowlist in backend/Code.gs; 09-02's AsyncGrading.gs deferred grading/email pipeline that eventually writes 'graded'/'emailed'/'grading_failed' statuses"
provides:
  - "ThankYouScreen.tsx candidate confirmation component (no report/score prop, no polling)"
  - "page.tsx submit flow rewired to stop expecting an inline report in the API response"
  - "admin/page.tsx READY_STATUSES-based report-readiness check matching backend/Code.gs"
  - "admin/page.tsx distinct 'Grading Failed' badge for grading_failed status"
affects: [09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "READY_STATUSES allowlist kept as an identical plain-array literal on both backend/Code.gs and admin/page.tsx (no shared package between the two runtimes)"
    - "ThankYouScreen reuses ReportScreen's fadeUp Variants and card-shell className verbatim for visual continuity across post-test screens"

key-files:
  created:
    - assessment-app/src/components/ThankYouScreen.tsx
  modified:
    - assessment-app/src/app/page.tsx
    - assessment-app/src/app/admin/page.tsx

key-decisions:
  - "ThankYouScreen takes an optional candidateName prop (sourced from page.tsx's existing name state) for a personalized greeting, but no report/score-shaped prop of any kind (D-15)"
  - "grading_failed renders as a distinct red/pulsing badge with 'Grading Failed' label text, reusing the same visual treatment already used for the violation-count warning badge, so it can't be missed while scanning the status column (D-12)"

patterns-established:
  - "Status-readiness allowlists (READY_STATUSES) must be updated in lockstep on both the Apps Script backend and the admin frontend since no shared type/package exists between them"

requirements-completed: [ASYNC-01, ASYNC-02]

coverage:
  - id: D1
    description: "ThankYouScreen.tsx renders a static confirmation + turnaround-time message with zero report/score data and zero polling/fetch calls"
    requirement: "ASYNC-01"
    verification:
      - kind: unit
        ref: "grep -c \"setInterval|setTimeout|fetch(\" assessment-app/src/components/ThankYouScreen.tsx (0 matches)"
        status: pass
    human_judgment: true
    rationale: "Visual/animation correctness and gamified-tone fidelity require a human click-through (assessment-app has no configured test runner per 09-VALIDATION.md); deferred to the 09-06 checkpoint"
  - id: D2
    description: "page.tsx no longer references reportData or the 'report' screen state; handleTestSubmit transitions to 'thankyou' without reading result.report"
    requirement: "ASYNC-01"
    verification:
      - kind: unit
        ref: "grep -c reportData assessment-app/src/app/page.tsx (0 matches)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit -p tsconfig.json (assessment-app) — no type errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "admin/page.tsx classifies 'submitted'/'graded'/'emailed' as report-ready via READY_STATUSES, and renders a distinct 'Grading Failed' badge for grading_failed rows"
    requirement: "ASYNC-02"
    verification:
      - kind: unit
        ref: "grep -c READY_STATUSES assessment-app/src/app/admin/page.tsx (2 matches: definition + usage)"
        status: pass
    human_judgment: true
    rationale: "Correct visual classification of live admin-panel rows across all four status literals requires a human click-through against real/seeded data; deferred to the 09-06 checkpoint"

duration: 25min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 04: Frontend Async Confirmation & Admin Readiness Summary

**Replaced the candidate's instant on-screen report with a static ThankYouScreen confirmation, rewired page.tsx's submit flow to match 09-01's report-less API response, and made admin/page.tsx's report-readiness check recognize the new pending_grading/graded/emailed/grading_failed status literals via a shared READY_STATUSES allowlist.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-31T09:30:00Z
- **Completed:** 2026-07-31T09:55:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `ThankYouScreen.tsx` created as a static, no-polling confirmation screen reusing `ReportScreen.tsx`'s `fadeUp` animation and card-shell styling, showing "within a few minutes" turnaround copy per D-13
- `page.tsx`'s screen-state union and submit handler updated so nothing in the candidate UI expects or reads an inline `report` field anymore, matching 09-01's fast-enqueue-only backend response shape
- `admin/page.tsx`'s report-readiness gate now uses the same `READY_STATUSES = ['submitted', 'graded', 'emailed']` allowlist as `backend/Code.gs`, plus a visually distinct "Grading Failed" badge for `grading_failed` attempts (D-12)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ThankYouScreen.tsx** - `808cfe0` (feat)
2. **Task 2: Replace the 'report' screen with 'thankyou' in page.tsx** - `b57adee` (feat)
3. **Task 3: Apply the READY_STATUSES allowlist to admin/page.tsx's report-readiness check** - `106522c` (feat)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `assessment-app/src/components/ThankYouScreen.tsx` - New static confirmation screen; optional `candidateName` prop only, no report/score prop, no `setInterval`/`setTimeout`/`fetch`
- `assessment-app/src/app/page.tsx` - Screen-state union `'report'` → `'thankyou'`; `reportData` state removed; `handleTestSubmit` sets `screen('thankyou')` without reading `result.report`; render branch mounts `ThankYouScreen` instead of `ReportScreen`
- `assessment-app/src/app/admin/page.tsx` - Added `READY_STATUSES` module-scope constant; `isSubmitted` now `READY_STATUSES.includes(row.status)`; status badge ternary extended with a `grading_failed` branch (red/pulsing, "Grading Failed" label)

## Decisions Made
- `ThankYouScreen` accepts `candidateName?: string` (sourced from `page.tsx`'s existing `name` state) for a personalized greeting — not a new field, and not report/score-shaped, so it does not conflict with D-15's "no score teaser" rule.
- The `grading_failed` badge reuses the same red/pulsing visual treatment already established for the violation-count warning badge in this file, rather than inventing a new color convention, to keep the admin table's visual language consistent.

## Deviations from Plan

None - plan executed exactly as written. `backend/Code.gs` was read directly (per the context note) and confirmed to already match the plan's assumed post-09-01 shape: `READY_STATUSES` is defined at line 55, `handleSubmitAnswers` returns `{ success: true, status: "pending_grading" }` with no `report` field, and `handleGetAttemptReport` gates on `READY_STATUSES.includes(...)`. No adjustments were needed to the plan's excerpts.

## Issues Encountered
None. `npx tsc --noEmit` confirmed no type errors after removing the `Report` import/`reportData` state from `page.tsx` and adding the `ThankYouScreen` import. `@phosphor-icons/react`'s `CheckCircle` export was confirmed available via the package's ESM entry point (the package is ESM-only; a CommonJS `require()` probe returned `undefined` but a dynamic `import()` probe correctly resolved the named export).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend candidate/admin surfaces are now consistent with 09-01's async response contract and 09-02's status-literal set (`pending_grading`/`graded`/`emailed`/`grading_failed`).
- Full behavioral confirmation (ThankYouScreen renders correctly, no polling fires, admin panel correctly gates/badges each status) is deferred to the manual click-through checkpoint in plan 09-06, per 09-VALIDATION.md's ASYNC-01/ASYNC-02 manual-only justification — no automated test runner is configured for `assessment-app/`.
- Ready for 09-05 (remaining phase 9 work) and 09-06 (verification checkpoint).

---
*Phase: 09-async-grading-report-delivery-pipeline*
*Completed: 2026-07-31*

## Self-Check: PASSED

All created/modified files exist on disk and all three task commit hashes (808cfe0, b57adee, 106522c) are present in git history.
