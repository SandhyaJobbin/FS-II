# Deferred Items — Phase 09 (async-grading-report-delivery-pipeline)

## sync-check.ts: stale Code.gs scoring/tier/bank-mapping checks (pre-existing, out of scope for 09-05)

**Found during:** Plan 09-05, Task 1 verification (`npx tsx scripts/sync-check.ts`)

**Symptom:** 7 of the original (Phase 08) sync-check divergence checks fail:
- `Scoring formula uses Math.round (Code.gs)`
- `Strong Fit: overall >= 80 (Code.gs)`
- `Strong Fit: critical >= 75 (Code.gs)`
- `Strong Fit: research >= 75 (Code.gs)`
- `Consider: overall >= 60 (Code.gs)`
- `Bank mapping: attention -> research (Code.gs)`
- `Bank mapping: critical -> critical (Code.gs)`

**Root cause:** Plan 09-01 (`feat(09-01): convert handleSubmitAnswers into fast-enqueue-only handler`, commit `4e03392`) moved the scoring/tier/narrative logic out of `backend/Code.gs` into `backend/AsyncGrading.gs` as part of the async grading redesign. The original Phase 08 sync-check pair (`tests/grading/grading-engine.ts` vs `backend/Code.gs`) still expects that logic to live in `Code.gs`, so it now reports false-positive drift.

**Verified pre-existing:** Confirmed via `git stash` (stashing this plan's `scripts/sync-check.ts` edit and re-running the script) that the same 7 failures occur identically without any 09-05 changes present. This predates plan 09-05 and is unrelated to the `AsyncGrading.gs`/`queue-logic.ts` comparison added by this plan.

**Scope decision:** Not fixed here. Plan 09-05's `files_modified` is scoped to `scripts/sync-check.ts` (extend only) and `package.json` — it does not include `backend/Code.gs`, `tests/grading/grading-engine.ts`, or updating the Phase 08 comparison pair to point at the new post-09-01 location of the scoring logic. That is a separate fix (likely: retarget the existing `MIRROR`/`CODE_GS` pair, or move it to compare `tests/grading/grading-engine.ts` against `backend/AsyncGrading.gs` instead of `backend/Code.gs`).

**New checks added by 09-05 (all passing):**
- `PASS: AsyncGrading retry cap`
- `PASS: AsyncGrading batch cap`
- `PASS: AsyncGrading trigger cadence`

**Recommended follow-up:** A future plan (or a fast-follow to 09-01) should update the Phase 08 `MIRROR`/`CODE_GS` comparison in `scripts/sync-check.ts` to point at `backend/AsyncGrading.gs` (where the scoring/tier/bank-mapping logic now lives) instead of `backend/Code.gs`, restoring `sync-check`'s exit-0 status for the full suite.
