---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 04
subsystem: tests
tags: [vitest, sync-check, mirror, drift-detection, rubric]

# Dependency graph
requires: ["10-01", "10-02", "10-03"]
provides:
  - "tests/grading/grading-engine.ts mirror widened: llmResults typed as Record<string, 'correct'|'incorrect'|'ungraded'>; GradeResult now includes ungradedCount; A2 denominator-excludes-ungraded policy applied uniformly across bankTotal/bankCorrect/complex tallies"
  - "tests/grading/rubric-grader.ts (new, vitest-excluded) — pure mirror exporting parseGeminiRubricResponse (verdict enum guard), effectiveVerdict (OverrideVerdict>Verdict>IsCorrect precedence), TRANSCRIPT_COLUMN_COUNT=9 constant"
  - "tests/grading/test_rubric_grader.ts (new) — asserts valid-schema parse, ungraded-fallback on malformed/off-enum, rationale verbatim persistence, effectiveVerdict precedence table"
  - "tests/admin/test_override.ts (new) — asserts SHA-256 hash invariants (hex, 64 chars, differs from plaintext), score re-aggregation math (correct→incorrect strictly decreases overall), ungraded-excluded-from-denominator, override reversibility via effectiveVerdict"
  - "scripts/sync-check.ts extended with 9 new drift checks: rubric verdict enum discipline, evaluateWithRubric responseSchema presence, TRANSCRIPT_COLUMN_COUNT parity, no-silent-true regression guard, ungraded-verdict propagation, handleOverrideVerdict LockService(10000ms), SHA-256 pattern, mirror llmResults type, ungradedCount in GradeResult"
  - "vitest.config.ts exclude list extended for tests/**/rubric-grader.ts so vitest does not treat the pure mirror as a test file"
affects: [10-05-frontend-ui, 10-07-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure mirror pattern: rubric-grader.ts is byte-equivalent semantically to AsyncGrading.gs's evaluateWithRubric verdict-resolution + effectiveVerdict, excluded from vitest run so it functions as sync-check drift baseline rather than a test"
    - "Sync-check has()/check() extension for structural asserts (regex-presence) and value-parity asserts (mirror-vs-Code.gs numeric constants)"

key-files:
  created:
    - tests/grading/rubric-grader.ts
    - tests/grading/test_rubric_grader.ts
    - tests/admin/test_override.ts
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-04-SUMMARY.md
  modified:
    - tests/grading/grading-engine.ts
    - scripts/sync-check.ts
    - vitest.config.ts

key-decisions:
  - "Widened llmResults type in grading-engine.ts rather than adding a parallel path — keeps a single grading path in the mirror and avoids a boolean/verdict dual-source"
  - "rubric-grader.ts is treated as pure-mirror (excluded from vitest) rather than as production code — sync-check.ts asserts drift between it and AsyncGrading.gs, so it functions as the enforcement half of the mirror-contract"
  - "sync-check.ts checks 7-15 added at the tail so pre-existing checks 1-6 stay stable — plan 10-04 additions are a suffix, not a rewrite"
  - "Ungraded fallback in parseGeminiRubricResponse also guards non-enum verdicts locally (verdict === 'maybe' → 'ungraded') — mirrors the local guard added post-deploy in AsyncGrading.gs (see 10-07-SUMMARY for the enum-leak incident that motivated the guard)"

patterns-established:
  - "Any future rubric-shape change (verdict enum, criteria field, transcript column count) must land in AsyncGrading.gs + rubric-grader.ts + sync-check.ts assertion in the same PR — the mirror is the contract, not documentation"
  - "New sync-check assertions follow the numbered-section convention (── N. Title ── ) and reuse has()/check() helpers — no new abstraction introduced"

requirements-completed: []
requirements-partial: [GRADE-06, GRADE-07, GRADE-08, GRADE-09]

coverage:
  - id: T1
    description: "grading-engine.ts mirror widened for verdict-string llmResults + A2 denominator policy + ungradedCount field on GradeResult"
    requirement: "GRADE-06, GRADE-07"
    verification:
      - kind: unit
        ref: "npx vitest run tests/grading/"
        status: pass
    human_judgment: false
    rationale: "Vitest suite green after widening; existing grading tests updated to new shape"
  - id: T2
    description: "rubric-grader.ts pure mirror + test_rubric_grader.ts + test_override.ts assert schema parse, ungraded fallback, effectiveVerdict precedence, audit-hash invariants, denominator policy"
    requirement: "GRADE-06, GRADE-08, GRADE-09"
    verification:
      - kind: unit
        ref: "npx vitest run tests/grading/test_rubric_grader.ts tests/admin/test_override.ts"
        status: pass
    human_judgment: false
    rationale: "Both new vitest suites pass in isolation and in the full run"
  - id: T3
    description: "sync-check.ts checks 7-15 catch verdict-enum drift, missing responseSchema, transcript-column-count drift, silent-true regression, ungraded-verdict absence, LockService timeout, SHA-256 pattern, mirror llmResults type, ungradedCount presence"
    requirement: "GRADE-06, GRADE-07, GRADE-08, GRADE-09"
    verification:
      - kind: other
        ref: "npx tsx scripts/sync-check.ts — exits 0"
        status: pass
    human_judgment: false
    rationale: "Static drift asserts, deterministically pass or fail against the committed backend files"

# Deviations from plan
deviations: []

# Follow-ups
followups:
  - "Plan 10-07 live verification step 10 re-runs both npm test + sync-check against the post-deploy state — the assertions land here so that step is meaningful"
  - "If a future plan changes the OpenRouter model or response_format shape (json_object → json_schema), sync-check.ts should gain a check asserting the enum is enforced server-side, not just locally — currently the local guard is the only line of defense (see 10-07 enum-leak incident)"
