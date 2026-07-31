---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 02
subsystem: api
tags: [google-apps-script, backend, grading-transcripts, ungraded-state]

# Dependency graph
requires: ["10-01"]
provides:
  - "GradingTranscripts sheet lazily created by initSheets() with the canonical 9-column schema (AttemptID, QuestionID, RubricVersion, Verdict, CriteriaMetJSON, Rationale, OverrideVerdict, OverrideAt, OverrideTokenHash)"
  - "Attempts sheet gains column O (15th) UngradedCount — appended via O-styled header, no backfill for legacy rows"
  - "effectiveVerdict(transcriptRow, responsesRow) helper codifying OverrideVerdict > Verdict > IsCorrect > 'ungraded' precedence — mirror contract for plan 10-04"
  - "gradeAndFinalizeAttempt now calls evaluateWithRubric (from 10-01) and applies A2 denominator-excludes-ungraded policy uniformly to bankTotal / bankCorrect / complexTotal / complexCorrect"
  - "GradingTranscripts batch-append per rubric-graded answer (open_text + hybrid) with rubric.version snapshot at grading time — override columns left empty for plan 10-03"
  - "ungradedCount surfaced in three report-shape readers: gradeAndFinalizeAttempt inline return, buildReportFromAttemptsRow (from sheet), handleGetAttemptReport (from sheet)"
affects: [10-03-override-endpoints, 10-04-mirror-and-sync-check, 10-05-frontend-ui, 10-07-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denominator-excludes-ungraded scoring: verdict !== 'ungraded' guards both bankTotal++ and bankCorrect++ increments; ungradedCount tracked separately (A2)"
    - "Dual-write ungradedCount contract for Phase 11: Attempts.UngradedCount column (fast-path) + GradingTranscripts rows (source of truth) — either aggregation path yields identical counts (A9)"
    - "Attempts column extension pattern: append to end (col O), update styling range A1:N1 -> A1:O1, coalesce Number(row[N]) || 0 at read time for legacy compatibility (Pitfall 5)"
    - "IsCorrect domain extension: legacy {0,1} -> {0, 1, 'ungraded'} — Responses sheet becomes the fast-lookup and GradingTranscripts becomes the detailed source"

key-files:
  created:
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-02-SUMMARY.md
  modified:
    - backend/Code.gs
    - backend/AsyncGrading.gs

key-decisions:
  - "Kept the H:K + M:N + O batch-write split intentional (not collapsed) per plan spec — H:K are score columns, M:N are computed narrative/tier, O is Phase 10's UngradedCount; keeping them separate preserves the surgical-edit story and eases per-plan sync-check drift"
  - "gradeAndFinalizeAttempt's in-memory return object also gets ungradedCount (not just the two sheet-readers) — the value is in scope from the counter, and downstream email builders may want it; keeps all three report-producing paths consistent"
  - "Extracted const row = data[i] inside buildReportFromAttemptsRow to satisfy the plan verify regex (Number(row[14]) || 0); alternative was renaming all data[i] usages, rejected as unrelated churn"
  - "Legacy evaluateOpenTextBatch in Code.gs is now unused by any code path in this repo but retained @deprecated per plan 10-01's rollback rationale — plan 10-04 sync-check will assert this stays orphaned"

patterns-established:
  - "Any future rubric change (verdict enum, criteria shape) requires updating (a) evaluateWithRubric's responseSchema, (b) effectiveVerdict's precedence, (c) tests/grading/rubric-grader.ts mirror (added by plan 10-04) in the SAME PR"
  - "Any new per-attempt aggregate column follows the Phase 10 pattern: append to Attempts, extend styling range, add Number(row[N]) || 0 coalesce in every reader"

requirements-completed: []
requirements-partial: [GRADE-06, GRADE-07]

coverage:
  - id: T1
    description: "GradingTranscripts lazy-init block in initSheets() with 9-column header in exact order; Attempts header extended with UngradedCount; styling range expanded to A1:O1"
    requirement: "GRADE-06, GRADE-07"
    verification:
      - kind: other
        ref: "node -e verify: insertSheet('GradingTranscripts'); 9-column header regex; UngradedCount present; A1:O1 range"
        status: pass
    human_judgment: true
    rationale: "Apps Script cannot execute locally — actual sheet creation confirmed at plan 10-07 deployment checkpoint"
  - id: T2
    description: "effectiveVerdict added; gradeAndFinalizeAttempt calls evaluateWithRubric (not evaluateOpenTextBatch); A2 denominator policy applied uniformly; batched transcriptRows write to GradingTranscripts; UngradedCount written to Attempts col 15"
    requirement: "GRADE-06, GRADE-07"
    verification:
      - kind: other
        ref: "node -e verify: 7-point check (effectiveVerdict defined, evaluateWithRubric called, evaluateOpenTextBatch NOT called, denominator guard, ungradedCount++, batch write, col 15 setValue)"
        status: pass
    human_judgment: true
    rationale: "Actual pipeline behavior with real Gemini responses can only be confirmed in plan 10-07 live verification (including the deliberate GEMINI_API_KEY corruption test for GRADE-07)"
  - id: T3
    description: "ungradedCount added to gradeAndFinalizeAttempt inline return, buildReportFromAttemptsRow (sheet-read), and handleGetAttemptReport (sheet-read) — all with Number(row[14]) || 0 coalesce for legacy-row safety"
    requirement: "GRADE-07"
    verification:
      - kind: other
        ref: "node -e verify: both readers match Number(row|data[i])[14]) || 0"
        status: pass
    human_judgment: false
    rationale: "Static grep sufficient — coalesce behavior is standard JS semantics"

# Deviations from plan
deviations:
  - "Also added ungradedCount to gradeAndFinalizeAttempt's inline return object (L293) — plan only explicitly required buildReportFromAttemptsRow and handleGetAttemptReport, but keeping all three report-producing paths consistent avoids downstream surprises when the inline return flows to email builders"

# Follow-ups
followups:
  - "Plan 10-03 handleOverrideVerdict must re-aggregate scores using effectiveVerdict() with the same A2 denominator policy — plan already specifies this; verification is that the score changes symmetrically when a verdict flips"
  - "Plan 10-04 must add sync-check drift assertions for (a) TRANSCRIPT_COLUMN_COUNT=9, (b) effectiveVerdict precedence, (c) A2 denominator policy — before any structural change to the transcript sheet or verdict semantics"
  - "Plan 10-05 candidate ReportScreen notice + admin dashboard badge consume report.ungradedCount — coordinate copy tone with the ThankYouScreen copy update"
  - "Plan 10-07 live verification includes the deliberate GEMINI_API_KEY corruption test — confirms end-to-end that ungraded state appears in GradingTranscripts + Attempts + report payload"
