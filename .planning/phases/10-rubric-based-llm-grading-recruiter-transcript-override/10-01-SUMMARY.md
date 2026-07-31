---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 01
subsystem: api
tags: [google-apps-script, backend, rubric, gemini, responseSchema]

# Dependency graph
requires: []
provides:
  - "rubric: { version: 1, criteria: [{name, weight, description}] } block colocated with model_answer on all 40 open_text + 10 hybrid QUESTIONS entries (50 total), using per-section skeleton defaults (30 sentence_correction, 10 macro, 10 closure hybrid) — plan 10-06 replaces skeletons with human-authored criteria"
  - "evaluateWithRubric(gradingRequests, questionsById) in backend/AsyncGrading.gs — Gemini v1beta responseSchema-enforced grader with delimiter-framed candidate answers and local ungraded fallback on every failure path (no key / non-200 / JSON.parse fail / UrlFetchApp exception)"
  - "SECURITY (Phase 10) comment above handleStartAttempt public-question projection making the allowlist trust-boundary explicit — rubric field is absent by construction, not by defensive strip"
  - "@deprecated marker on evaluateOpenTextBatch in backend/Code.gs — retained unmodified for one release cycle for single-file rollback"
affects: [10-02-grading-transcripts, 10-03-override-endpoints, 10-04-mirror-and-sync-check, 10-06-human-rubric-authoring, 10-07-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gemini responseSchema with verdict enum locked to ['correct','incorrect'] — model never self-selects 'ungraded' (Pitfall 1)"
    - "Delimiter-framed candidate answer (<<<ANSWER_START>>>/<<<ANSWER_END>>>) + system-prompt instruction to treat delimited text as data — prompt-injection defense (Pitfall 4)"
    - "Local ungraded fallback on every failure path — no silent-true regression (removes Code.gs L177 pattern)"

key-files:
  created:
    - scripts/add-rubric-skeletons.mjs
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-01-SUMMARY.md
  modified:
    - backend/Code.gs
    - backend/AsyncGrading.gs

key-decisions:
  - "Used a Node.js injection script (scripts/add-rubric-skeletons.mjs) to add 50 rubric blocks in one atomic pass rather than 50 individual Edit calls — script is idempotent (skips entries that already have rubric) and preserves the exact spec (unquoted-key JS style matching plan verify regex)"
  - "Kept evaluateOpenTextBatch entirely unmodified with only a @deprecated header comment — rollback becomes a one-file revert instead of a functional restore, per RESEARCH.md § State of the Art"
  - "Placed evaluateWithRubric immediately above processGradingQueue in AsyncGrading.gs (line 338 originally) so hoisting is trivial and the wiring in plan 10-02 has a stable insertion point"
  - "Task 3's SECURITY comment (not a runtime strip) is intentional per plan — the allowlist projection IS the security guarantee; a defensive delete would be redundant and mask the trust-boundary intent"

patterns-established:
  - "Any future rubric-graded response type must (a) add rubric to its QUESTIONS entry, (b) never appear in handleStartAttempt allowlist, (c) route through evaluateWithRubric not evaluateOpenTextBatch"
  - "Any new client-side projection allowlist in Code.gs should carry an explicit SECURITY (Phase N) comment naming the fields that must NEVER be added (see model_answer, rubric)"

requirements-completed: []
requirements-partial: [GRADE-06, GRADE-07]

coverage:
  - id: T1
    description: "50 rubric blocks (30 sentence_correction + 10 macro + 10 closure hybrid) added to QUESTIONS entries in backend/Code.gs, colocated with model_answer, with per-section skeleton defaults and weights summing to 1.0 ±0.01"
    requirement: "GRADE-06"
    verification:
      - kind: other
        ref: "node -e verify: open_text=40, hybrid=10, rubric blocks=50"
        status: pass
    human_judgment: false
    rationale: "Automated grep + Node parse-and-count is sufficient — content quality of the skeleton is deferred to plan 10-06"
  - id: T2
    description: "evaluateWithRubric added to backend/AsyncGrading.gs with Gemini responseSchema (verdict enum = ['correct','incorrect']), delimiter framing, and 4 ungraded fallbacks (no key / non-200 / JSON.parse / UrlFetchApp exception)"
    requirement: "GRADE-06, GRADE-07"
    verification:
      - kind: other
        ref: "node -e verify: function present, responseSchema wired, enum correct, delimiters present, >=4 ungraded fallbacks"
        status: pass
    human_judgment: true
    rationale: "Apps Script cannot execute locally — actual Gemini response shape and 6-min execution cap behavior can only be confirmed live in plan 10-07 deployment checkpoint (measurement note in RESEARCH.md A6/Open Q2)"
  - id: T3
    description: "SECURITY (Phase 10) comment added above handleStartAttempt public-question projection in backend/Code.gs; allowlist projection continues to omit rubric field entirely (no defensive delete added)"
    requirement: "GRADE-06"
    verification:
      - kind: other
        ref: "node -e verify: SECURITY (Phase 10) comment present within 15 lines above projection; no 'rubric': key in projection block"
        status: pass
    human_judgment: false
    rationale: "Comment presence + allowlist shape is fully verifiable via static grep — no runtime behavior involved"

# Deviations from plan
deviations: []

# Follow-ups
followups:
  - "Plan 10-02 wires evaluateWithRubric into gradeAndFinalizeAttempt in place of the current evaluateOpenTextBatch call — 10-01's rubric shape is the contract that plan reads"
  - "Plan 10-06 replaces the 50 per-section skeleton criteria with human-authored per-question criteria — 10-01's rubric block shape must remain byte-identical or plan 10-04 sync-check breaks"
  - "Plan 10-04 adds sync-check.ts drift assertions for the responseSchema enum and rubric block presence — must be added before any structural change to rubric or verdict enum lands"
