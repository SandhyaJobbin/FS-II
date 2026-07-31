---
phase: 09-async-grading-report-delivery-pipeline
plan: 02
subsystem: api
tags: [google-apps-script, mailapp, lockservice, async-queue, email]

# Dependency graph
requires:
  - phase: 09-01
    provides: "PendingGrading queue sheet (9-column schema), fast-enqueue-only handleSubmitAnswers, READY_STATUSES gate on handleGetAttemptReport"
provides:
  - "gradeAndFinalizeAttempt/buildReportFromAttemptsRow: the deferred scoring + report-assembly step"
  - "buildCandidateEmail/buildRecruiterEmail/buildReportHtml/parseRecruiterEmails: HTML email content builders"
  - "processGradingQueue/processQueueItem/readEligiblePendingRows: LockService-guarded PendingGrading queue drain"
  - "sendCandidateEmailIfNeeded/sendRecruiterEmailIfNeeded/recordQueueItemFailure: retry-capped email dispatch and failure bookkeeping"
  - "installGradingTrigger: idempotent one-time trigger installer (5-minute cadence)"
affects: [09-03, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateless recurring-trigger worker draining a sheet-backed queue under LockService.tryLock (non-blocking, 5s timeout)"
    - "Single includeViolations boolean as the sole content-divergence point between candidate and recruiter emails"
    - "3-state email_status enum (pending/sent/failed) with retry state fully represented by PendingGrading.AttemptsCount/Stage instead of a 4th 'retried' literal"

key-files:
  created: [backend/AsyncGrading.gs]
  modified: []

key-decisions:
  - "Both plan tasks (grading/email builders, and queue-drain/retry/trigger) were implemented and committed as a single commit because they build the same new file with no independently-testable intermediate state -- a synthetic split would not add verification value."
  - "Recruiter/candidate email-status column writes (PendingGrading columns 8/9) route through a small internal setPendingGradingColumn(rowIndex, column, value) helper (not explicitly named in the plan) to avoid duplicating the getRange/setValue call site 4 times -- purely an internal implementation detail, does not change any externally-observed behavior or column layout."

patterns-established:
  - "Async worker files in this Apps Script project follow AsyncGrading.gs's shape: PropertiesService config constant at top, extracted business logic, then queue-drain/retry/trigger-install section at the bottom."

requirements-completed: [ASYNC-02, ASYNC-03, ASYNC-04, ASYNC-05]

coverage:
  - id: D1
    description: "gradeAndFinalizeAttempt moved verbatim from the pre-09-01 synchronous handleSubmitAnswers, writing only Attempts.Status=graded (never touching EndTime)"
    requirement: "ASYNC-02"
    verification:
      - kind: unit
        ref: "npm test (90/90 passing, zero regressions -- no existing suite exercises AsyncGrading.gs directly; pure-mirror unit coverage lands in plan 09-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildCandidateEmail never includes violation/integrity data; buildRecruiterEmail always does, with recommendation tier highlighted"
    requirement: "ASYNC-03"
    verification: []
    human_judgment: true
    rationale: "Content-shape correctness (email HTML rendering, tier highlighting) requires visual/behavioral confirmation of an actual MailApp send, which only happens at the plan 09-06 deployment checkpoint -- no Apps Script local test runner exists for this file."
  - id: D3
    description: "processGradingQueue drains up to 5 eligible PendingGrading rows per run under a 5-second LockService.tryLock, with per-row fault isolation"
    requirement: "ASYNC-04"
    verification: []
    human_judgment: true
    rationale: "Trigger-based execution and LockService behavior cannot be exercised outside a live Apps Script deployment; confirmed at the plan 09-06 checkpoint."
  - id: D4
    description: "Failed items retry up to 3 attempts before Stage flips to permanently_failed and Attempts.Status flips to grading_failed, with no alert email ever sent on that path"
    requirement: "ASYNC-05"
    verification: []
    human_judgment: true
    rationale: "Same as D3 -- retry/failure state machine requires live trigger runs against real sheet data to confirm end to end; mirrored and unit-tested as pure logic in plan 09-03."

duration: 20min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 02: Async Grading Worker & Email Delivery Summary

**New `backend/AsyncGrading.gs` (484 lines) implementing the deferred half of the async pipeline: grading logic moved verbatim from the old synchronous handler, HTML candidate/recruiter email builders with a single boolean gating violation-data exposure, and a LockService-guarded 5-row batch queue drain with a 3-attempt retry cap.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-31
- **Tasks:** 2
- **Files modified:** 1 (new file)

## Accomplishments
- `gradeAndFinalizeAttempt`/`buildReportFromAttemptsRow` reproduce the exact scoring/report shape the old inline `handleSubmitAnswers` produced (LLM open-text batch grading, per-bank trait percentages, recommendation tier, narrative insight), now writing only `Attempts.Status = "graded"` without touching `EndTime`
- `buildReportHtml`/`buildCandidateEmail`/`buildRecruiterEmail`/`parseRecruiterEmails` give candidate emails zero violation/integrity data and recruiter emails a tier-highlighted violation summary, both driven by one `includeViolations` boolean
- `processGradingQueue`/`processQueueItem`/`readEligiblePendingRows` drain up to 5 eligible `PendingGrading` rows per run under a non-blocking `tryLock(5000)`, with per-row `try/catch` fault isolation so one malformed row cannot stall the batch
- `sendCandidateEmailIfNeeded`/`sendRecruiterEmailIfNeeded`/`recordQueueItemFailure` implement idempotent email sends, `MailApp` daily-quota deferral (no wasted retry budget), a 3-attempt retry cap to `permanently_failed`/`grading_failed`, and a fail-safe (`RecruiterEmailStatus = "failed"`) when `RECRUITER_EMAILS` is empty -- with no `MailApp.sendEmail` call anywhere in the failure path
- `installGradingTrigger` is idempotent and unreachable from any HTTP-triggered code path (`doPost`/`doGet`/`initSheets`)

## Task Commits

Both tasks build the same single new file (`backend/AsyncGrading.gs`) with no independently-verifiable intermediate state, so they were implemented together and committed as one atomic commit:

1. **Task 1 + Task 2: AsyncGrading.gs (grading extraction, email builders, queue-drain worker)** - `7414dad` (feat)

## Files Created/Modified
- `backend/AsyncGrading.gs` - New file: `gradeAndFinalizeAttempt`, `buildReportFromAttemptsRow`, `buildReportHtml`, `buildCandidateEmail`, `buildRecruiterEmail`, `parseRecruiterEmails`, `readEligiblePendingRows`, `processGradingQueue`, `processQueueItem`, `sendCandidateEmailIfNeeded`, `sendRecruiterEmailIfNeeded`, `recordQueueItemFailure`, `setPendingGradingStage`, `setPendingGradingColumn`, `setAttemptsStatus`, `installGradingTrigger`

## Decisions Made
- Combined Task 1 and Task 2 into a single commit (see `key-decisions` above) since both build one new file with no meaningful intermediate checkpoint.
- Kept the 3-state `email_status` enum (`pending`/`sent`/`failed`) per the plan's explicit discretion note -- did not add a 4th `"retried"` literal since `AttemptsCount`/`Stage` already fully represent retry state.
- Added a small internal `setPendingGradingColumn(rowIndex, column, value)` helper (beyond the two helpers the plan explicitly names) purely to avoid repeating the same `getRange(...).setValue(...)` call shape 4 times across the candidate/recruiter status writes -- no behavioral or schema change.

## Deviations from Plan

None requiring Rule 1-4 action. One process note: the plan's `<read_first>` for Task 1 pointed at `backend/Code.gs` lines 411-624 as the location of the original scoring logic to extract, but plan 09-01 (already executed) had fully removed that inline logic from `Code.gs` (converting `handleSubmitAnswers` to fast-enqueue-only), exactly as the `<context_note>` in this execution's prompt warned. The verbatim scoring/tier/narrative logic was instead recovered from `git show 4e03392` (the 09-01 commit that deleted it) and moved into `AsyncGrading.gs` byte-for-byte, satisfying the plan's "moved, not rewritten" requirement without needing to guess or reconstruct the logic from scratch.

## Issues Encountered
None - `npm test` passes 90/90 with zero regressions after adding the new file.

## User Setup Required
**External service configuration required before live use.** Per this plan's `user_setup` frontmatter: `RECRUITER_EMAILS` must be set as a comma-separated Script Property (Apps Script editor -> Project Settings -> Script Properties, same location as `GEMINI_API_KEY`) before the first live trigger run, or recruiter notifications will be skipped (fail-safe) while candidate emails continue sending normally. `installGradingTrigger()` also still needs a manual one-time run from the Apps Script editor -- that action is plan 09-06's checkpoint, not this plan's.

## Next Phase Readiness
- `backend/AsyncGrading.gs` is ready for the pure-logic TypeScript mirrors and unit tests in plan 09-03 (`tests/async/queue-logic.ts`, `tests/async/email-content.ts`)
- Ready for `scripts/sync-check.ts` drift-checking in plan 09-05 (retry cap `3`, batch cap `5`, `everyMinutes(5)` literals all present and grep-able)
- Live behavioral confirmation (actual trigger firing, actual `MailApp` emails arriving, `installGradingTrigger()` one-time run) is deferred to the plan 09-06 deployment checkpoint as designed

---
*Phase: 09-async-grading-report-delivery-pipeline*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: backend/AsyncGrading.gs
- FOUND: .planning/phases/09-async-grading-report-delivery-pipeline/09-02-SUMMARY.md
- FOUND: commit 7414dad
