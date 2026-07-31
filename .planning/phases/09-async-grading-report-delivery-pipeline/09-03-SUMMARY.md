---
phase: 09-async-grading-report-delivery-pipeline
plan: 03
subsystem: testing
tags: [vitest, typescript, pure-mirror, apps-script, test-infrastructure]

# Dependency graph
requires:
  - phase: 09-async-grading-report-delivery-pipeline (plan 02)
    provides: backend/AsyncGrading.gs -- stage/retry queue-drain worker and candidate/recruiter email builders
provides:
  - "tests/async/queue-logic.ts -- pure mirror of the Stage/retry/batch-selection state machine"
  - "tests/async/email-content.ts -- pure mirror of candidate/recruiter email content builders + recipient parsing"
  - "tests/async/test_queue.ts, tests/async/test_email.ts -- vitest suites covering ASYNC-02/03/04/05"
  - "vitest.config.ts exclude entries so the two mirror files are importable helpers, not standalone suites"
affects: [09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["GAS-to-Node pure-mirror convention (established in Phase 08, extended to tests/async/)"]

key-files:
  created:
    - tests/async/queue-logic.ts
    - tests/async/test_queue.ts
    - tests/async/email-content.ts
    - tests/async/test_email.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "nextStageAfterFailure(attemptsCount, currentStage) takes the current stage as an explicit second parameter (not inferable from attemptsCount alone) so the 'unchanged current stage' behavior described in the plan's must_haves is directly testable"
  - "buildRecruiterEmailContent's tier-highlight is rendered as an explicit >>> ... <<< marker distinct from the plain 'Recommendation Tier:' line already present in the shared report body, giving the vitest assertion an unambiguous, non-overlapping string to check for 'visibly highlighted'"

patterns-established:
  - "Pure mirror files under tests/async/ follow the exact header-comment + zero-GAS-global convention from tests/grading/grading-engine.ts, substituting the Phase 9 concern"

requirements-completed: [ASYNC-03, ASYNC-04, ASYNC-05]

coverage:
  - id: D1
    description: "Stage/retry state machine (queued -> graded -> done/permanently_failed) and 5-row batch-selection logic covered by fast, dependency-free unit tests"
    requirement: "ASYNC-05"
    verification:
      - kind: unit
        ref: "tests/async/test_queue.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Candidate email content always includes overall score, 3 trait scores, narrative insight, and recommendation tier, and never includes violation data; recruiter email content includes a violation/integrity summary with tier highlighted"
    requirement: "ASYNC-03"
    verification:
      - kind: unit
        ref: "tests/async/test_email.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "parseRecruiterEmails correctly handles comma-separated, empty, and whitespace-heavy RECRUITER_EMAILS input"
    requirement: "ASYNC-04"
    verification:
      - kind: unit
        ref: "tests/async/test_email.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 3: Async Queue & Email Content Test Infrastructure Summary

**Pure TypeScript mirrors (`tests/async/queue-logic.ts`, `tests/async/email-content.ts`) of `backend/AsyncGrading.gs`'s stage/retry/batch-selection state machine and candidate/recruiter email content builders, with 19 new vitest tests running in under a second.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31T09:00:00Z (approx)
- **Completed:** 2026-07-31T09:25:00Z (approx)
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `tests/async/queue-logic.ts` -- pure mirror exporting `selectEligibleRows`, `isPermanentlyFailed`, `nextStageAfterGradingSuccess`, `nextStageAfterCandidateEmailSent`, `nextStageAfterFailure`, matching the eligibility filter, batch cap (5), and retry cap (3) behavior of `readEligiblePendingRows`/`processGradingQueue`/`recordQueueItemFailure` in `backend/AsyncGrading.gs`
- `tests/async/email-content.ts` -- pure mirror exporting `buildCandidateEmailContent`, `buildRecruiterEmailContent`, `parseRecruiterEmails`, matching `buildCandidateEmail`/`buildRecruiterEmail`/`parseRecruiterEmails` in `backend/AsyncGrading.gs`, including the D-04 candidate-never-includes-violations rule and D-06/D-07 recipient parsing
- 19 new vitest tests (10 in `test_queue.ts`, 9 in `test_email.ts`) covering all behaviors listed in the plan, including the batch-cap-of-5, retry-cap-of-3, and D-04 negative-assertion edge cases
- `vitest.config.ts`'s `exclude` array extended with `tests/**/queue-logic.ts` and `tests/**/email-content.ts`, following the exact pattern already used for `grading-engine.ts`/`admin-auth.ts`
- Full suite verified: `npm test` reports 109 tests passing across 6 test files with zero regressions (up from 90 tests / 4 files before this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure mirror of the queue stage/retry/batch-selection logic** - `fb9f552` (test)
2. **Task 2: Pure mirror of candidate/recruiter email content builders** - `af73e21` (test)
3. **Task 3: Wire the new mirror files into vitest.config.ts and confirm zero regressions** - `f60557e` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified
- `tests/async/queue-logic.ts` - Pure mirror of `AsyncGrading.gs`'s stage/retry/batch-selection state machine (zero GAS-global dependencies)
- `tests/async/test_queue.ts` - Vitest suite: batch selection (queued/graded include, done/permanently_failed exclude, cap-at-5), retry cap (0/1/2 false, 3+ true), stage transitions (graded, done, permanently_failed-or-unchanged)
- `tests/async/email-content.ts` - Pure mirror of `AsyncGrading.gs`'s email content builders and recruiter recipient parsing
- `tests/async/test_email.ts` - Vitest suite: candidate content (4 required fields present, violation/integrity absent), recruiter content (superset of candidate + tier-highlighted violation summary), `parseRecruiterEmails` (comma-separated, empty, whitespace-heavy)
- `vitest.config.ts` - Added the two new mirror files to `exclude` so they are importable helpers, not standalone test suites

## Decisions Made
- `nextStageAfterFailure` takes `(attemptsCount, currentStage)` rather than `attemptsCount` alone -- the plan's behavior description ("otherwise returns the unchanged current stage") requires the current stage as input to return it unchanged; this matches `recordQueueItemFailure`'s actual behavior in `AsyncGrading.gs` (stage column is only written when the row transitions to `permanently_failed`, otherwise left as-is)
- `buildRecruiterEmailContent`'s tier-highlight uses a distinct `>>> Recommendation Tier: X <<<` marker in the integrity-summary block, separate from the plain tier line already present in the shared report body -- gives the "tier visibly highlighted" assertion (D-02) an unambiguous string to check without relying on the shared-body tier line also satisfying it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/async/queue-logic.ts` and `tests/async/email-content.ts` are ready for plan 09-05's `scripts/sync-check.ts` drift-checks against `backend/AsyncGrading.gs`
- Full test suite (109 tests, 6 files) green with zero regressions -- Wave 1 test-infrastructure gaps from `09-VALIDATION.md` are closed
- No blockers for subsequent Phase 09 plans

---
*Phase: 09-async-grading-report-delivery-pipeline*
*Completed: 2026-07-31*
