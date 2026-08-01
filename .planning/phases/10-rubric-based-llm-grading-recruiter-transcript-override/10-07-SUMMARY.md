---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 07
subsystem: deployment
tags: [manual-deploy, apps-script, live-verification, deferred]
status: partial

# Dependency graph
requires: ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06"]
provides:
  - "Live Apps Script deployment carrying Phase 10 backend: rubric data model on 50 QUESTIONS, evaluateWithRubric (OpenRouter path), GradingTranscripts sheet, UngradedCount column, effectiveVerdict resolver, handleGetAttemptTranscript, handleOverrideVerdict, computeAggregatesForAttempt"
  - "OpenRouter-adapted grading path serving live (google/gemini-2.5-flash via OpenRouter Chat Completions API) — replaces the plan's Gemini v1beta path since Gemini free-tier stopped working mid-execution"
  - "Post-deploy enum-guard patch in AsyncGrading.gs (evaluateWithRubric result-parse block) — coerces any off-enum verdict returned by the model to 'ungraded' locally, restoring the Pitfall 1 defense that OpenRouter's json_object response_format weakened"
  - "Manual migrateAttemptsHeader_Phase10() one-off patch — added UngradedCount column O to the pre-existing Attempts sheet (initSheets() lazy-init skipped extension of the existing 14-column sheet)"
affects: [Phase 11 — analytics dashboard aggregation over GradingTranscripts + UngradedCount]

# Tech tracking
tech-stack:
  added:
    - "OpenRouter as the sole LLM provider — model google/gemini-2.5-flash accessed via OpenRouter Chat Completions"
  patterns:
    - "OpenRouter response_format: json_object — LOOSER than plan 10-01's responseSchema enum contract. Local verdict-enum guard is the only line of defense against off-enum verdicts under this mode. If a strict enforcement is needed, upgrade to response_format: json_schema with strict=true"
    - "Sheet-schema migration for lazy-init sheets: initSheets() only sets the header when creating fresh, so an existing pre-Phase-10 Attempts sheet needs a one-off migrate script to add UngradedCount as column O. Legacy rows show blank in column O and Number(row[14]) || 0 coalesces at read time"

key-files:
  created:
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-07-SUMMARY.md
  modified:
    - backend/AsyncGrading.gs

key-decisions:
  - "Task 2 (11-step live end-to-end verification) DEFERRED by user. Task 1 (deploy) complete. Partial status recorded here so the phase state is honest and resumable rather than falsely marked done."
  - "Enum-guard patch was authored post-deploy in response to observed leak: the first live test attempt landed a Verdict='not_applicable' row in GradingTranscripts because OpenRouter's json_object mode does not enforce the response schema's enum, and evaluateWithRubric's parse block trusted parsed.verdict verbatim. The 5-line guard collapses any verdict not in ['correct','incorrect'] to 'ungraded' locally. Redeployed to Apps Script; a re-run test attempt would confirm the fix but is part of the deferred Task 2 verification."
  - "Attempts sheet migration was NOT automated in initSheets() — kept the migration as a one-off script pasted into the editor because auto-extending existing sheets on every initSheets() call could accidentally re-add columns after a rollback. Left initSheets() as-is (lazy for new sheets only) and treat header-extension as an explicit, per-phase operation."

patterns-established:
  - "For OpenRouter deployments, evaluateWithRubric MUST have a local verdict-enum guard because json_object mode is looser than Gemini's responseSchema. If future providers offer strict schema mode (json_schema), the local guard becomes defense-in-depth rather than the primary defense"
  - "Sheet-schema evolution: additive column changes on existing sheets are one-off migration scripts, not initSheets() edits. Reader coalesce (Number(row[N]) || 0) is the durable pattern; the migration is the one-time step"

requirements-completed: []
requirements-partial: [GRADE-06, GRADE-07, GRADE-08, GRADE-09, GRADE-10]

coverage:
  - id: T1
    description: "Manual deploy: paste updated Code.gs + AsyncGrading.gs into Apps Script editor, run initSheets(), migrate Attempts header, deploy new web app version"
    requirement: "GRADE-06, GRADE-07, GRADE-08, GRADE-09, GRADE-10"
    verification:
      - kind: manual
        ref: "GradingTranscripts sheet visible in Google Sheets with 9-col header + real per-question rubric verdicts written for a test attempt (ATT-E64BB01A)"
        status: pass
    human_judgment: true
    rationale: "Screenshot of GradingTranscripts sheet showed rows landing with correct/incorrect verdicts (and one off-enum not_applicable leak that motivated the enum-guard patch)"
  - id: T2
    description: "11-step live end-to-end walkthrough (candidate submit → rubric grading → transcript persistence → recruiter view → override → reversibility → deliberate GEMINI_API_KEY corruption → sync-check gate → wall-clock measurement)"
    requirement: "GRADE-06, GRADE-07, GRADE-08, GRADE-09, GRADE-10"
    verification:
      - kind: manual
        ref: "10-07-PLAN.md Task 2 how-to-verify steps 1-11"
        status: deferred
    human_judgment: true
    rationale: "Deferred by user during 2026-08-01 close-out session. Live verification remains the only gate confirming GRADE-06/07/08/09/10 in production. Phase 10 is not fully closed until Task 2 completes."

# Deviations from plan
deviations:
  - "OpenRouter substitution — Gemini free-tier stopped working, so all LLM traffic routes through OpenRouter's Chat Completions API with google/gemini-2.5-flash. Backend calls are semantically equivalent; response_format shape shifted from Gemini's responseSchema to OpenAI-style json_object, which required the post-deploy enum-guard patch to restore Pitfall 1 protection"
  - "initSheets() Attempts-header migration — plan implicitly assumed initSheets() extends existing sheets; it does not. Manual migrateAttemptsHeader_Phase10() one-off patched the deployed sheet. Not folded into initSheets() to preserve rollback safety"
  - "Enum-guard patch to evaluateWithRubric — not in original plan, added mid-deploy after screenshot evidence of an off-enum leak. Guard is 5 lines and preserves the plan's ungraded-fallback contract"

# Follow-ups
followups:
  - "BLOCKER for Phase 10 closure: 10-07 Task 2 11-step live walkthrough. User deferred; resume when ready"
  - "Consider upgrading OpenRouter response_format to json_schema (strict) so the verdict enum is enforced server-side, not just locally. Backlog: track as separate infrastructure enhancement"
  - "Task 2 step 8 (deliberate OPENROUTER_API_KEY corruption test) is the highest-risk step — set a reminder to RESTORE the key immediately after"
  - "Task 2 step 11 wall-clock measurement (RESEARCH.md Pitfall 3) — capture actual OpenRouter batch grading duration to inform Phase 11 batch cap or Phase 999.x cap-reduction decision"
