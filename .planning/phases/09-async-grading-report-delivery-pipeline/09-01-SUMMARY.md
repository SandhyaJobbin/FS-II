---
phase: 09-async-grading-report-delivery-pipeline
plan: 01
subsystem: api
tags: [google-apps-script, backend, queue, async]

# Dependency graph
requires: []
provides:
  - "PendingGrading sheet lazily created by initSheets() with the canonical 9-column schema"
  - "handleSubmitAnswers() as a thin fast-enqueue handler (validation + idempotency guard + PendingGrading append + Attempts status write only)"
  - "READY_STATUSES constant + backward-compatible handleGetAttemptReport() gate"
affects: [09-02-async-grading-worker, 09-04-frontend-polling, 09-06-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fast-enqueue request handler: validate -> single durable-queue append -> single status write -> return, zero inline heavy work"
    - "Status-allowlist gate (READY_STATUSES) instead of single-literal equality check, for backward-compatible multi-terminal-state gating"

key-files:
  created: []
  modified:
    - backend/Code.gs

key-decisions:
  - "Deleted the old LLM/scoring/narrative logic from handleSubmitAnswers entirely rather than commenting it out or stubbing it, per plan instruction -- it is relocated verbatim into backend/AsyncGrading.gs by the parallel plan 09-02"
  - "Kept the not-found guard and attemptRow[5] !== \"active\" idempotency guard byte-for-byte unchanged to preserve the existing double-submit protection"
  - "READY_STATUSES defined as an explicit allowlist (submitted/graded/emailed) rather than a deny-list, so pending_grading and any future terminal-failure status are excluded by default"

patterns-established:
  - "Any future async-worker terminal status must be added to READY_STATUSES explicitly (allowlist, not deny-list)"

requirements-completed: [ASYNC-02]

coverage:
  - id: D1
    description: "initSheets() lazily creates a PendingGrading sheet with the exact 9-column schema (AttemptID, SubmittedAnswersJSON, EnqueuedAt, Stage, AttemptsCount, LastError, LastAttemptAt, CandidateEmailStatus, RecruiterEmailStatus)"
    requirement: "ASYNC-02"
    verification:
      - kind: other
        ref: "grep -c 'insertSheet(\"PendingGrading\")' backend/Code.gs == 1"
        status: pass
    human_judgment: true
    rationale: "Apps Script cannot execute locally -- actual sheet creation and header row can only be confirmed live during the plan 09-06 deployment checkpoint"
  - id: D2
    description: "handleSubmitAnswers is a fast-enqueue-only handler: preserves not-found + active-only idempotency guards, appends one PendingGrading row, writes Attempts.Status = pending_grading, returns { success: true, status: \"pending_grading\" } with no report field and zero inline LLM/scoring work"
    requirement: "ASYNC-02"
    verification:
      - kind: other
        ref: "grep -A 40 'function handleSubmitAnswers' backend/Code.gs | grep -c PendingGrading == 2"
        status: pass
      - kind: unit
        ref: "npm test (90/90 passing, no regression -- Code.gs not imported by current suite)"
        status: pass
    human_judgment: true
    rationale: "Live behavioral confirmation of the enqueue path (actual row shape written, actual Status transition) requires the plan 09-06 deployment checkpoint since Apps Script code cannot execute locally"
  - id: D3
    description: "READY_STATUSES allowlist (['submitted','graded','emailed']) defined near ADMIN_TOKEN and referenced in handleGetAttemptReport's gate, replacing the single-literal 'submitted' equality check"
    requirement: "ASYNC-02"
    verification:
      - kind: other
        ref: "grep -c READY_STATUSES backend/Code.gs == 2"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-31
status: complete
---

# Phase 09 Plan 01: Fast-Enqueue Submission Path & Report-Readiness Gate Summary

**Converted the synchronous `handleSubmitAnswers` LLM/scoring handler in `backend/Code.gs` into a thin fast-enqueue handler backed by a new `PendingGrading` sheet, and made `handleGetAttemptReport`'s gate accept `submitted`/`graded`/`emailed` via a `READY_STATUSES` allowlist.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-31T08:20:00Z (approx)
- **Completed:** 2026-07-31T08:34:01Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- `initSheets()` now lazily creates a 4th sheet, `PendingGrading`, with the canonical 9-column schema, following the identical lazy-creation/styling convention already used for Attempts/Responses/IntegrityLogs
- `handleSubmitAnswers` reduced from a ~215-line synchronous scoring handler to a ~25-line fast-enqueue handler: unchanged not-found + idempotency guards, one `PendingGrading.appendRow`, one `Attempts` E:F status write (`pending_grading`), returns `{ success: true, status: "pending_grading" }`
- `READY_STATUSES` allowlist (`['submitted', 'graded', 'emailed']`) added near `ADMIN_TOKEN`; `handleGetAttemptReport`'s gate now checks membership instead of a single string-equality comparison, so legacy `"submitted"` rows and new `"graded"`/`"emailed"` rows both pass while `"pending_grading"`/`"grading_failed"` are still rejected
- Full existing test suite (90 tests, 4 files) still passes -- zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PendingGrading lazy-init block to initSheets()** - `4ffef1d` (feat)
2. **Task 2: Convert handleSubmitAnswers into a fast-enqueue-only handler** - `4e03392` (feat)
3. **Task 3: Apply backward-compatible READY_STATUSES gate to handleGetAttemptReport** - `e8c82a6` (feat)

_No TDD tasks in this plan -- backend/Code.gs (Apps Script) is not covered by the local test harness; verification relied on grep-based structural checks plus a full `npm test` regression pass._

## Files Created/Modified
- `backend/Code.gs` - Added `PendingGrading` lazy-init block to `initSheets()`; converted `handleSubmitAnswers` to fast-enqueue-only; added `READY_STATUSES` and applied it to `handleGetAttemptReport`'s gate

## Decisions Made
- Deleted the old LLM/scoring/narrative logic outright rather than leaving a stub or comment referencing removed function names, per the plan's explicit instruction -- that logic is relocated verbatim into `backend/AsyncGrading.gs` by the parallel plan 09-02
- Preserved `const timestamp = new Date().toISOString();` in its original position (before any scoring), since it represents "when the candidate submitted"
- Kept `"submitted"` in `READY_STATUSES` rather than replacing it, so pre-Phase-9 rows remain retrievable without a backfill migration (per 09-RESEARCH.md Assumption A2)

## Deviations from Plan

### Auto-fixed Issues (tooling artifact, not scope creep)

**1. [Tooling recovery] Intermediate dead-code stub during Task 2 edit, immediately removed**
- **Found during:** Task 2 (editing `handleSubmitAnswers`)
- **Issue:** The plan's old function body contains literal `’`/`–` escape-sequence text (not real Unicode characters) mixed with real Unicode elsewhere in the same file, which caused the Edit tool's exact-string match to fail on a large single-block replacement. A first attempt used `sed` to isolate the deletion, temporarily renaming the leftover scoring tail into an unused stub function (`__REMOVED_handleSubmitAnswers_gradingTail`) as an intermediate step.
- **Fix:** Immediately deleted the entire stub function (lines 467-647) with `sed -i` in the same task, before committing -- the committed diff contains zero leftover dead code, matching the plan's explicit "do not leave an explanatory comment referencing the removed function names" instruction.
- **Files modified:** backend/Code.gs
- **Verification:** `awk` scan between `handleSubmitAnswers` and `handleGetAttemptReport` returns 0 matches for `evaluateOpenTextBatch`/`overallPercentage`/`recommendationTier`/`narrativeInsight`; `npm test` passes 90/90; git diff for the commit shows only the intended net change (182 deletions, 15 insertions, no stub artifacts)
- **Committed in:** `4e03392` (Task 2 commit -- the committed state never included the stub)

---

**Total deviations:** 1 (tooling-recovery only, not a plan/scope deviation)
**Impact on plan:** None -- final committed code matches the plan's acceptance criteria exactly; the stub never reached a commit.

## Issues Encountered
- Edit tool's exact-string matching failed twice on the large `handleSubmitAnswers` body replacement due to literal escape-sequence text (`’`, `–59%`) embedded in two narrative strings, distinct from the real Unicode characters (em-dash, ≥) used elsewhere in the same file. Resolved by using `sed -i` for the surgical line-range deletion instead of relying on exact text matching for that portion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `PendingGrading` sheet schema and `handleSubmitAnswers` enqueue-row shape are locked and ready for plan 09-02 (`AsyncGrading.gs` / `processGradingQueue`) to consume -- column order/count must not drift
- `READY_STATUSES` gate is ready for plan 09-02/09-03 to add `"graded"`/`"emailed"` writes without any further gate changes
- Live behavioral confirmation (actual PendingGrading row write, actual Status transition, actual gate behavior against real sheet data) deferred to the plan 09-06 deployment checkpoint, since Apps Script cannot execute locally

---
*Phase: 09-async-grading-report-delivery-pipeline*
*Completed: 2026-07-31*

## Self-Check: PASSED
- FOUND: 4ffef1d
- FOUND: 4e03392
- FOUND: e8c82a6
- FOUND: SUMMARY.md
