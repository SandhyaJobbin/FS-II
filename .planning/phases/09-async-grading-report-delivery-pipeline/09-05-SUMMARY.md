---
phase: 09-async-grading-report-delivery-pipeline
plan: 05
subsystem: testing
tags: [vitest, drift-detection, ci, apps-script, sync-check]

# Dependency graph
requires:
  - phase: 09-async-grading-report-delivery-pipeline (plan 09-02)
    provides: backend/AsyncGrading.gs (queue drain, retry cap, batch cap, trigger cadence)
  - phase: 09-async-grading-report-delivery-pipeline (plan 09-03)
    provides: tests/async/queue-logic.ts, tests/async/email-content.ts, tests/async/test_queue.ts, tests/async/test_email.ts
provides:
  - "scripts/sync-check.ts 2nd file-pair comparison (AsyncGrading.gs vs queue-logic.ts) covering retry cap, batch cap, trigger cadence"
  - "package.json test:async script running both async test files"
affects: [phase-08-cleanup-followups, future-async-grading-edits]

# Tech tracking
tech-stack:
  added: []
  patterns: [regex-extract-then-check() for numeric-literal drift detection, matching the existing ADMIN_TOKEN check() pattern]

key-files:
  created: [.planning/phases/09-async-grading-report-delivery-pipeline/deferred-items.md]
  modified: [scripts/sync-check.ts, package.json]

key-decisions:
  - "Used check() (extract-then-compare) rather than paired has() calls for retry cap and batch cap, matching the existing ADMIN_TOKEN pattern -- this produces a genuine equality-based divergence check (fails if the literal changes on only one side) with a single label per assertion, matching the plan's '3 new labeled checks' acceptance criteria"
  - "Trigger cadence check is single-sided (has() against AsyncGrading.gs only) since installGradingTrigger's everyMinutes(5) is the sole authoritative call site; queue-logic.ts's TRIGGER_CADENCE_MINUTES constant is documentation-only and not consumed by any tested function"
  - "Left the 7 pre-existing Code.gs sync-check failures (from Phase 09-01 moving scoring logic to AsyncGrading.gs) unfixed and logged to deferred-items.md -- out of scope per this plan's files_modified (scripts/sync-check.ts extend-only, package.json), confirmed pre-existing via git stash before/after comparison"

patterns-established:
  - "sync-check.ts drift assertions: prefer check() with regex-extracted literals over paired has() calls when checking a single numeric constant against its consuming logic in another file -- gives one label per assertion and a real equality comparison instead of two independent presence checks"

requirements-completed: [ASYNC-02, ASYNC-05]

coverage:
  - id: D1
    description: "sync-check.ts detects drift between AsyncGrading.gs and queue-logic.ts on retry cap (3), batch cap (5), and trigger cadence (5min)"
    requirement: "ASYNC-05"
    verification:
      - kind: automated_ui
        ref: "npx tsx scripts/sync-check.ts (PASS: AsyncGrading retry cap / batch cap / trigger cadence)"
        status: pass
    human_judgment: false
  - id: D2
    description: "test:async npm script runs both new async test files"
    requirement: "ASYNC-02"
    verification:
      - kind: unit
        ref: "npm run test:async (2 files, 19 tests passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full npm test suite passes with zero regressions after adding the async mirrors, sync-check extension, and test:async script"
    verification:
      - kind: unit
        ref: "npm test (6 files, 109 tests passing)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 05: Async sync-check drift detection + test:async script Summary

**Extended scripts/sync-check.ts with a 2nd file-pair drift gate (AsyncGrading.gs vs queue-logic.ts, covering retry cap/batch cap/trigger cadence) and added a test:async npm script -- both wired into the existing Phase 08 CI convention with zero new dependencies.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T09:57:19Z
- **Completed:** 2026-07-31T10:05:00Z
- **Tasks:** 2
- **Files modified:** 2 (scripts/sync-check.ts, package.json), 1 file created (deferred-items.md)

## Accomplishments
- `scripts/sync-check.ts` now reads `backend/AsyncGrading.gs` and `tests/async/queue-logic.ts` and runs 3 labeled divergence checks (retry cap, batch cap, trigger cadence) alongside the existing Phase 08 grading/admin-auth checks
- `package.json` gained a `test:async` script matching the `test:grading`/`test:assembly` naming and invocation convention
- Verified zero regressions: full `npm test` suite (109 tests across 6 files) passes after this plan's changes plus the Phase 09-02/09-03 async work

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend sync-check.ts with the AsyncGrading.gs / queue-logic.ts comparison** - `66457f2` (feat)
2. **Task 2: Add test:async npm script and run the full suite** - `9573ca5` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/sync-check.ts` - Added `ASYNC_MIRROR`/`ASYNC_GS` readFileSync pair and 3 new divergence checks: retry cap (`newCount >= 3` in `recordQueueItemFailure` vs `RETRY_CAP = 3` in `queue-logic.ts`), batch cap (`.slice(0, 5)` in `processGradingQueue` vs `BATCH_CAP = 5`), trigger cadence (`everyMinutes(5)` in `installGradingTrigger`)
- `package.json` - Added `"test:async": "vitest run tests/async/test_queue.ts tests/async/test_email.ts"` alongside `test:grading`/`test:assembly`
- `.planning/phases/09-async-grading-report-delivery-pipeline/deferred-items.md` - Logged the 7 pre-existing (Phase 09-01-caused) stale Code.gs sync-check failures as out-of-scope for this plan

## Decisions Made
- Used `check()` (regex-extract-then-compare) for the retry-cap and batch-cap assertions instead of paired `has()` calls, mirroring the existing `ADMIN_TOKEN` check pattern in the same file -- this gives one label per assertion (matching the plan's acceptance criteria of "3 new labeled checks") while still being a genuine cross-file equality check, not just two independent presence tests
- Trigger cadence check is single-sided (`has()` against `AsyncGrading.gs` only), since `installGradingTrigger`'s `everyMinutes(5)` is the only place that literal is operationally consumed; `queue-logic.ts`'s `TRIGGER_CADENCE_MINUTES` constant exists but isn't read by any tested function, so there's no consuming logic on the mirror side to cross-check against
- Did not touch the pre-existing 7 failing Code.gs checks (Scoring formula, tier thresholds, bank mapping) -- confirmed via `git stash` that these fail identically without this plan's changes, root-caused to Phase 09-01 moving that logic to `AsyncGrading.gs`; fixing them would require modifying `backend/Code.gs` or retargeting the Phase 08 comparison pair, both outside this plan's `files_modified` scope

## Deviations from Plan

### Auto-fixed Issues

None - both tasks implemented exactly as specified in the plan.

### Deferred (out of scope, logged not fixed)

**1. [Scope Boundary] Pre-existing Code.gs sync-check divergence from Phase 09-01**
- **Found during:** Task 1 verification (`npx tsx scripts/sync-check.ts`)
- **Issue:** 7 of the original Phase 08 checks (scoring formula, tier thresholds x4, bank mapping x2) fail because Phase 09-01 moved the scoring/tier/narrative logic out of `backend/Code.gs` into `backend/AsyncGrading.gs`, but the Phase 08 comparison pair still points at `Code.gs`
- **Verification it's pre-existing:** `git stash` (removing this plan's edits) then re-ran the script -- identical 7 failures occurred without any 09-05 changes present
- **Not fixed:** Outside this plan's `files_modified` (`scripts/sync-check.ts` extend-only + `package.json`); logged to `.planning/phases/09-async-grading-report-delivery-pipeline/deferred-items.md` with a recommended follow-up (retarget the Phase 08 pair to `backend/AsyncGrading.gs`)

---

**Total deviations:** 0 auto-fixed, 1 deferred (pre-existing, out of scope)
**Impact on plan:** No scope creep. This plan's 3 new checks all pass cleanly against the real Phase 09-02/09-03 artifacts.

## Issues Encountered
- `npx tsx scripts/sync-check.ts` exits 1 overall due to the 7 pre-existing Code.gs failures documented above (unrelated to this plan's changes) -- see Deviations section and `deferred-items.md`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 08's existing CI workflow (already gated on `sync-check.ts`) now also runs the async drift checks with no workflow-file changes needed
- `npm run test:async` and `npm test` both verified green (2/2 and 6/6 files respectively)
- Follow-up recommended (not blocking): retarget the Phase 08 `MIRROR`/`CODE_GS` comparison pair in `sync-check.ts` to `backend/AsyncGrading.gs` so the script returns to a full exit-0 state; tracked in `deferred-items.md`

---
*Phase: 09-async-grading-report-delivery-pipeline*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: scripts/sync-check.ts
- FOUND: package.json
- FOUND: .planning/phases/09-async-grading-report-delivery-pipeline/deferred-items.md
- FOUND: .planning/phases/09-async-grading-report-delivery-pipeline/09-05-SUMMARY.md
- FOUND commit: 66457f2
- FOUND commit: 9573ca5
