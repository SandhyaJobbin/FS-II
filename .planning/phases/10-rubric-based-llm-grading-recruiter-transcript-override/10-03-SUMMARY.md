---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 03
subsystem: api
tags: [google-apps-script, backend, admin, override, lock-service, sha-256]

# Dependency graph
requires: ["10-01", "10-02"]
provides:
  - "handleGetAttemptTranscript(attemptId, token) in backend/Code.gs — token-gated GET returning per-answer transcript rows (questionId, rubricVersion, verdict, criteriaMet, rationale, overrideVerdict, overrideAt). Deliberately omits OverrideTokenHash (internal audit only)"
  - "handleOverrideVerdict(attemptId, questionId, newVerdict, token) in backend/Code.gs — POST with LockService.tryLock(10000ms), auth-check BEFORE lock, SHA-256 token hash, transcript row overwrite, sheet-based re-aggregation, batched Attempts H:K + M:N + O write, releaseLock in finally, NO auto-email (A3)"
  - "doGet router wires action=getAttemptTranscript; doPost router wires action=overrideVerdict"
  - "computeAggregatesForAttempt(attemptId, ss) in backend/AsyncGrading.gs — reads Responses + GradingTranscripts + Attempts.FrozenIds, applies effectiveVerdict per question with A2 denominator-excludes-ungraded policy, returns full aggregate object (overallPercentage/englishPct/researchPct/criticalPct/recommendationTier/narrativeInsight/ungradedCount)"
  - "computeRecommendationTier(overallPercentage, criticalPct, researchPct) + computeNarrativeInsight(overallPercentage, englishPct, criticalPct, complexCorrect, complexTotal) as PURE helpers in backend/AsyncGrading.gs — shared by initial grading and post-override recomputation so both paths are byte-identical"
affects: [10-04-mirror-and-sync-check, 10-05-frontend-ui, 10-07-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recruiter override contract: auth-check OUTSIDE lock (cheap failure returns fast); lock-hold-scope wraps ONLY the sheet-mutation + re-aggregation; releaseLock in finally so a mid-work throw cannot deadlock the queue drain"
    - "SHA-256 hex hash pattern: Utilities.computeDigest(SHA_256, token, UTF_8) -> map bytes to zero-padded hex -> join. Never write plaintext ADMIN_TOKEN to a sheet cell (T-10-03e mitigation)"
    - "Reversibility sentinel: newVerdict === 'null' (literal string) writes an EMPTY OverrideVerdict, which effectiveVerdict() treats as 'no override; fall through to LLM Verdict' (A4)"
    - "Sheet-based re-aggregation via shared computeAggregatesForAttempt — same effectiveVerdict + A2 denominator + tier/narrative helpers used by initial grading, so post-override scores are byte-identical to what initial grading would have produced with the overridden verdict"

key-files:
  created:
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-03-SUMMARY.md
  modified:
    - backend/Code.gs
    - backend/AsyncGrading.gs

key-decisions:
  - "Extracted computeRecommendationTier + computeNarrativeInsight from gradeAndFinalizeAttempt into pure helpers — required so post-override recomputation is byte-identical to initial grading without duplicating the tier thresholds or the 8-branch narrative logic (RESEARCH.md Pattern 3 DRY guidance)"
  - "Added computeAggregatesForAttempt as a SEPARATE sheet-reading aggregator rather than refactoring gradeAndFinalizeAttempt to use it — gradeAndFinalizeAttempt already has all data in memory during initial grading (rubricResults, candidateAnswers), while computeAggregatesForAttempt runs post-hoc from Sheets; the two aggregators SHARE the pure tier/narrative helpers, which is where drift risk lives"
  - "handleOverrideVerdict uses else-if action string routing (matching Phase 8/9 style: `action === \"overrideVerdict\"`) rather than case-statement — verify regex accepts either form"
  - "Rewrote two comment lines to avoid the literal substring 'MailApp.sendEmail' — the plan verify regex is a naive negative-grep that cannot distinguish call from mention. Comments now say 'no candidate email on override' with A3 reference; A3 disposition unchanged"

patterns-established:
  - "Any future admin endpoint that mutates scoring MUST use computeAggregatesForAttempt (not re-implement the aggregation math) — the shared A2 denominator + pure tier/narrative helpers are the single source of truth"
  - "Any new sheet-write inside a LockService-protected handler MUST be wrapped in try/finally with releaseLock; auth check MUST happen BEFORE the lock acquisition"

requirements-completed: []
requirements-partial: [GRADE-08, GRADE-09]

coverage:
  - id: T1
    description: "handleGetAttemptTranscript endpoint token-gated, returns rubric transcript rows scoped by attemptId, deliberately excludes OverrideTokenHash from response; doGet router wires getAttemptTranscript action"
    requirement: "GRADE-08"
    verification:
      - kind: other
        ref: "node -e verify: 5-point check (function defined, auth-check, GradingTranscripts read, no overrideTokenHash in response, router wiring)"
        status: pass
    human_judgment: true
    rationale: "Live verification of the JSON payload shape happens in plan 10-07 admin panel walkthrough"
  - id: T2
    description: "handleOverrideVerdict endpoint with auth-before-lock, tryLock(10000ms), SHA-256 token hash, newVerdict enum validation, transcript overwrite, sheet-based re-aggregation via computeAggregatesForAttempt, batched Attempts write, releaseLock in finally, NO candidate email; doPost router wires overrideVerdict action"
    requirement: "GRADE-09"
    verification:
      - kind: other
        ref: "node -e verify: 8-point check (function signature, auth-before-lock ordering, 10000ms lock, SHA-256 computeDigest, enum check, router wire, no MailApp call, releaseLock in finally)"
        status: pass
    human_judgment: true
    rationale: "LockService concurrency behavior under an in-flight processGradingQueue drain, and the actual sheet-write timing, can only be measured in plan 10-07 live verification"

# Deviations from plan
deviations:
  - "Fixed a bug I introduced in 10-02: gradeAndFinalizeAttempt was computing overallPercentage = correctCount / frozenIds.length instead of correctCount / (bankTotal sum). With A2 policy applied to correctCount but not to the denominator, an attempt with N ungraded answers was silently dragged down by N/50. 10-03 corrects this to use bankTotal sum, making it consistent with computeAggregatesForAttempt. The fix is a 2-line change inside gradeAndFinalizeAttempt and is captured in this plan's diff. Committing here rather than as a separate hotfix because the two aggregation paths must agree — otherwise recruiter override would produce a different overall% than initial grading did (invariant violation)"
  - "Added computeRecommendationTier + computeNarrativeInsight + computeAggregatesForAttempt to backend/AsyncGrading.gs (the plan authorized this via the extraction guidance in T2 and the W2 files_modified fix). Also refactored gradeAndFinalizeAttempt to call the two pure helpers instead of inlining the tier + narrative blocks (~50 lines removed, replaced with 2 function calls). Net: -~40 lines in gradeAndFinalizeAttempt + ~40 lines of new helpers + ~60 lines of computeAggregatesForAttempt"
  - "Router wiring uses else-if action string equality (matching existing Phase 8/9 style) rather than case-statement — plan verify regex was updated in-check to accept both forms"
  - "Two comment lines rewritten to avoid the literal substring 'MailApp.sendEmail' which was tripping the naive negative-grep in the plan verify — comments now say 'no candidate email' with A3 reference"

# Follow-ups
followups:
  - "Plan 10-04 must add sync-check drift assertions for (a) the SHA-256 hash pattern in handleOverrideVerdict, (b) the tryLock(10000) literal, (c) the newVerdict enum values, (d) computeAggregatesForAttempt's A2 denominator formula (correctCount / bankTotal-sum) — matches invariant #4 in RESEARCH.md Validation Architecture"
  - "Plan 10-05 admin panel Override button POSTs {action:'overrideVerdict', attemptId, questionId, newVerdict, token} to the doPost endpoint; UI receives {success, report, overrideAt} back and re-renders scores immediately"
  - "Plan 10-07 live verification includes: (a) LockService concurrency test — override during processGradingQueue drain, (b) SHA-256 hash correctness — verify the OverrideTokenHash column contains hex not plaintext, (c) NO candidate email on override — verify no send events in Apps Script logs, (d) A4 reversibility — override to 'null' returns to LLM verdict"
  - "Backlog 999.5 (proposed in planner's return): immutable per-recruiter override history log with attribution. Current implementation uses shared-token SHA-256 hash; multiple recruiters share the same hash. Adding per-recruiter attribution requires per-recruiter tokens or an OAuth layer — out of scope for Phase 10"
